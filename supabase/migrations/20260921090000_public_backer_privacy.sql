-- Backing privacy is a per-payment presentation preference. Financial state,
-- funding totals, fees, rewards, and Stripe identifiers are intentionally
-- unchanged by this migration.
alter table public.checkout_backing_intents
  add column if not exists is_private boolean not null default false;

alter table public.backings
  add column if not exists is_private boolean not null default false;

comment on column public.backings.is_private is
  'When true, this backing still counts normally but its backer identity is hidden from public presentation.';

create index if not exists backings_public_project_feed_idx
  on public.backings (project_id, status, is_private, paid_at desc);

-- Older authenticated backers can predate complete profile initialization.
-- Fill only missing presentation fields for paid backers from their verified
-- Supabase Auth identity; never use Stripe customer or receipt information.
update public.profiles profile
set
  display_name = coalesce(
    nullif(trim(profile.display_name), ''),
    nullif(trim(auth_user.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(auth_user.raw_user_meta_data ->> 'name'), '')
  ),
  avatar_url = coalesce(
    nullif(trim(profile.avatar_url), ''),
    nullif(trim(auth_user.raw_user_meta_data ->> 'avatar_url'), ''),
    nullif(trim(auth_user.raw_user_meta_data ->> 'picture'), '')
  ),
  updated_at = now()
from auth.users auth_user
where profile.id = auth_user.id
  and profile.deleted_at is null
  and exists (
    select 1
    from public.backings backing
    where backing.backer_id = profile.id
      and backing.status = 'paid'
  )
  and (
    nullif(trim(profile.display_name), '') is null
    or nullif(trim(profile.avatar_url), '') is null
  );

create or replace function public.finalize_stripe_checkout(
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_processing_fee_amount integer,
  p_backer_email text,
  p_stripe_charge_id text default null
) returns table(backing_id uuid, project_id uuid, email_delivery_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  intent public.checkout_backing_intents%rowtype;
  new_backing_id uuid;
  delivery_id uuid;
  existing_project_id uuid;
  platform_fee integer;
  creator_proceeds integer;
begin
  select backing.id, backing.project_id
  into new_backing_id, existing_project_id
  from public.backings backing
  where backing.stripe_checkout_session_id = p_checkout_session_id;

  if found then
    return query select new_backing_id, existing_project_id, null::uuid;
    return;
  end if;

  select *
  into intent
  from public.checkout_backing_intents checkout_intent
  where checkout_intent.checkout_session_id = p_checkout_session_id
  for update;

  if not found
     or intent.released_at is not null
     or intent.converted_at is not null
     or intent.expires_at <= now()
  then
    raise exception 'checkout_not_active';
  end if;

  platform_fee := ((intent.amount * 5 + 50) / 100)::integer;
  creator_proceeds := greatest(
    0,
    intent.amount - platform_fee - greatest(0, p_processing_fee_amount)
  );

  insert into public.backings (
    project_id,
    reward_id,
    backer_id,
    reservation_id,
    backer_email,
    gross_amount,
    platform_fee_amount,
    processing_fee_amount,
    creator_proceeds_amount,
    net_creator_proceeds_amount,
    currency,
    status,
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    stripe_charge_id,
    transfer_status,
    paid_at,
    is_private
  ) values (
    intent.project_id,
    intent.reward_id,
    intent.backer_id,
    intent.reservation_id,
    p_backer_email,
    intent.amount,
    platform_fee,
    greatest(0, p_processing_fee_amount),
    creator_proceeds,
    creator_proceeds,
    intent.currency,
    'paid',
    p_checkout_session_id,
    p_payment_intent_id,
    p_stripe_charge_id,
    'pending',
    now(),
    intent.is_private
  )
  returning id into new_backing_id;

  if intent.reservation_id is not null then
    update public.rewards
    set
      reserved_quantity = greatest(0, reserved_quantity - 1),
      claimed_quantity = claimed_quantity + 1
    where id = intent.reward_id;

    update public.reward_reservations
    set converted_at = now()
    where id = intent.reservation_id;
  end if;

  update public.checkout_backing_intents
  set converted_at = now()
  where checkout_session_id = p_checkout_session_id;

  update public.projects
  set
    successful_backed_amount = successful_backed_amount + intent.amount,
    successful_backer_count = successful_backer_count + 1
  where id = intent.project_id;

  insert into public.email_deliveries (
    dedupe_key,
    event_type,
    backing_id,
    recipient_email
  ) values (
    'backing-confirmation:' || new_backing_id::text,
    'backing_confirmation',
    new_backing_id,
    p_backer_email
  )
  on conflict (dedupe_key) do nothing
  returning id into delivery_id;

  return query select new_backing_id, intent.project_id, delivery_id;
end;
$$;

revoke all on function public.finalize_stripe_checkout(text, text, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.finalize_stripe_checkout(text, text, integer, text, text)
  to service_role;

-- Anonymous callers receive only safe presentation columns. Private identities
-- never cross this function boundary. Public repeat backings aggregate by
-- canonical backer, while every private backing remains a separate anonymous
-- entry so its amount cannot leak through a public cumulative total.
create or replace function public.get_public_project_backers(p_slug text)
returns table (
  entry_key text,
  is_private boolean,
  display_name text,
  username text,
  avatar_url text,
  amount integer,
  currency text,
  backed_at timestamptz,
  reward_title text
)
language sql
stable
security definer
set search_path = ''
as $$
  with eligible as (
    select
      backing.id,
      backing.backer_id,
      backing.is_private,
      backing.gross_amount,
      backing.currency,
      coalesce(backing.paid_at, backing.created_at) as backed_at,
      reward.id as reward_id,
      reward.title as reward_title,
      case when profile.deleted_at is null then profile.display_name end as display_name,
      case when profile.deleted_at is null then lower(profile.username) end as username,
      case when profile.deleted_at is null then profile.avatar_url end as avatar_url
    from public.backings backing
    join public.projects project on project.id = backing.project_id
    left join public.profiles profile on profile.id = backing.backer_id
    left join public.rewards reward on reward.id = backing.reward_id
    where project.slug = p_slug
      and project.status in ('live', 'funded', 'completed')
      and project.admin_archived_at is null
      and project.admin_suspended_at is null
      and project.creator_archived_at is null
      and backing.status = 'paid'
  ), grouped as (
    select
      case
        when eligible.is_private then 'private:' || eligible.id::text
        when eligible.backer_id is not null then 'public-user:' || eligible.backer_id::text
        else 'public-backing:' || eligible.id::text
      end as grouping_key,
      bool_or(eligible.is_private) as private_entry,
      sum(eligible.gross_amount)::integer as total_amount,
      min(eligible.currency) as entry_currency,
      max(eligible.backed_at) as latest_backed_at,
      case when bool_or(eligible.is_private) then null else max(eligible.display_name) end as safe_display_name,
      case when bool_or(eligible.is_private) then null else max(eligible.username) end as safe_username,
      case when bool_or(eligible.is_private) then null else max(eligible.avatar_url) end as safe_avatar_url,
      case
        when count(distinct eligible.reward_id) = 1 then max(eligible.reward_title)
        else null
      end as safe_reward_title
    from eligible
    group by
      case
        when eligible.is_private then 'private:' || eligible.id::text
        when eligible.backer_id is not null then 'public-user:' || eligible.backer_id::text
        else 'public-backing:' || eligible.id::text
      end
  )
  select
    case
      when grouped.private_entry then 'private:' || md5(grouped.grouping_key)
      else 'public:' || md5(grouped.grouping_key)
    end,
    grouped.private_entry,
    grouped.safe_display_name,
    grouped.safe_username,
    grouped.safe_avatar_url,
    grouped.total_amount,
    grouped.entry_currency,
    grouped.latest_backed_at,
    grouped.safe_reward_title
  from grouped
  order by grouped.latest_backed_at desc, grouped.grouping_key;
$$;

revoke all on function public.get_public_project_backers(text) from public;
grant execute on function public.get_public_project_backers(text) to anon, authenticated;

-- Project creators receive the per-payment identity and privacy state needed
-- for reward fulfilment. The creator check is enforced inside the data boundary;
-- payment-provider identifiers and email are intentionally not returned.
create or replace function public.get_creator_project_backers(p_slug text)
returns table (
  entry_key text,
  is_private boolean,
  display_name text,
  username text,
  avatar_url text,
  amount integer,
  currency text,
  backed_at timestamptz,
  reward_title text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    'backing:' || backing.id::text,
    backing.is_private,
    case when profile.deleted_at is null then profile.display_name end,
    case when profile.deleted_at is null then lower(profile.username) end,
    case when profile.deleted_at is null then profile.avatar_url end,
    backing.gross_amount,
    backing.currency,
    coalesce(backing.paid_at, backing.created_at),
    reward.title
  from public.backings backing
  join public.projects project on project.id = backing.project_id
  left join public.profiles profile on profile.id = backing.backer_id
  left join public.rewards reward on reward.id = backing.reward_id
  where project.slug = p_slug
    and project.creator_id = (select auth.uid())
    and backing.status = 'paid'
  order by coalesce(backing.paid_at, backing.created_at) desc, backing.id;
$$;

revoke all on function public.get_creator_project_backers(text) from public, anon;
grant execute on function public.get_creator_project_backers(text) to authenticated;

create or replace function public.set_backing_privacy(
  p_backing_id uuid,
  p_is_private boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_rows integer;
begin
  update public.backings
  set
    is_private = p_is_private,
    updated_at = now()
  where id = p_backing_id
    and backer_id = (select auth.uid())
    and status = 'paid';

  get diagnostics changed_rows = row_count;
  return changed_rows = 1;
end;
$$;

revoke all on function public.set_backing_privacy(uuid, boolean) from public, anon;
grant execute on function public.set_backing_privacy(uuid, boolean) to authenticated;
