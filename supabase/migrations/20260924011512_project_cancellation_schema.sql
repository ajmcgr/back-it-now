-- Backed uses immediate platform charges followed by separate per-backing
-- Connect transfers. Project cancellation closes checkout first, then tracks
-- recovery/refund work per backing without deleting financial history.

create table public.project_cancellations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete restrict,
  initiated_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'processing'
    check (status in ('processing', 'attention_required', 'completed')),
  eligible_refund_count integer not null default 0 check (eligible_refund_count >= 0),
  eligible_refund_amount integer not null default 0 check (eligible_refund_amount >= 0),
  initiated_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.project_cancellation_refunds (
  id uuid primary key default gen_random_uuid(),
  cancellation_id uuid not null references public.project_cancellations(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  backing_id uuid not null unique references public.backings(id) on delete restrict,
  requested_amount integer not null check (requested_amount > 0),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'pending', 'succeeded', 'failed', 'excluded')),
  stripe_refund_id text unique,
  stripe_transfer_reversal_id text unique,
  transfer_reversal_amount integer not null default 0 check (transfer_reversal_amount >= 0),
  failure_code text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempt_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cancellation_id, backing_id)
);

create index project_cancellation_refunds_work_idx
  on public.project_cancellation_refunds (status, updated_at)
  where status in ('queued', 'failed', 'pending');
create index project_cancellation_refunds_project_idx
  on public.project_cancellation_refunds (project_id, status);

alter table public.project_cancellations enable row level security;
alter table public.project_cancellation_refunds enable row level security;
revoke all on public.project_cancellations from public, anon, authenticated;
revoke all on public.project_cancellation_refunds from public, anon, authenticated;

alter table public.backing_refunds
  add column if not exists project_cancellation_id uuid
    references public.project_cancellations(id) on delete restrict;

create index if not exists backing_refunds_project_cancellation_idx
  on public.backing_refunds(project_cancellation_id)
  where project_cancellation_id is not null;

create or replace function public.create_checkout_backing_intent(
  p_pending_key text,
  p_project_id uuid,
  p_reward_id uuid,
  p_reservation_id uuid,
  p_backer_id uuid,
  p_amount integer,
  p_currency text,
  p_expires_at timestamptz,
  p_is_private boolean
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare target public.projects%rowtype;
begin
  if p_pending_key !~ '^pending_[0-9a-f-]{36}$' or p_amount < 500 then
    raise exception 'invalid_checkout_intent';
  end if;
  select project.* into target
  from public.projects project
  where project.id = p_project_id
  for update;
  if not found or target.status <> 'live' or target.deadline_at is null or target.deadline_at <= now() then
    raise exception 'project_unavailable';
  end if;
  insert into public.checkout_backing_intents(
    checkout_session_id, project_id, reward_id, reservation_id, backer_id,
    amount, currency, expires_at, is_private
  ) values (
    p_pending_key, p_project_id, p_reward_id, p_reservation_id, p_backer_id,
    p_amount, p_currency, p_expires_at, coalesce(p_is_private, false)
  );
  return true;
end;
$$;
revoke all on function public.create_checkout_backing_intent(text, uuid, uuid, uuid, uuid, integer, text, timestamptz, boolean)
  from public, anon, authenticated;
grant execute on function public.create_checkout_backing_intent(text, uuid, uuid, uuid, uuid, integer, text, timestamptz, boolean)
  to service_role;

create or replace function private.refresh_project_cancellation(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.project_cancellations%rowtype;
  unresolved_count integer;
  failed_count integer;
begin
  select cancellation.* into target
  from public.project_cancellations cancellation
  where cancellation.project_id = p_project_id
  for update;
  if not found then return; end if;

  update public.project_cancellations cancellation
  set
    eligible_refund_count = summary.refund_count,
    eligible_refund_amount = summary.refund_amount,
    updated_at = now()
  from (
    select
      count(*) filter (where refund.status <> 'excluded')::integer as refund_count,
      coalesce(sum(refund.requested_amount) filter (where refund.status <> 'excluded'), 0)::integer as refund_amount
    from public.project_cancellation_refunds refund
    where refund.cancellation_id = target.id
  ) summary
  where cancellation.id = target.id;

  select
    count(*) filter (where refund.status in ('queued', 'processing', 'pending')),
    count(*) filter (where refund.status = 'failed')
  into unresolved_count, failed_count
  from public.project_cancellation_refunds refund
  where refund.cancellation_id = target.id;

  if failed_count > 0 then
    update public.project_cancellations
    set status = 'attention_required', updated_at = now(), completed_at = null
    where id = target.id;
    update public.projects set status = 'cancelling', updated_at = now()
    where id = p_project_id and status <> 'cancelling';
  elsif unresolved_count > 0 then
    update public.project_cancellations
    set status = 'processing', updated_at = now(), completed_at = null
    where id = target.id;
    update public.projects set status = 'cancelling', updated_at = now()
    where id = p_project_id and status <> 'cancelling';
  else
    update public.project_cancellations
    set status = 'completed', updated_at = now(), completed_at = coalesce(completed_at, now())
    where id = target.id;
    update public.projects set status = 'cancelled', updated_at = now()
    where id = p_project_id and status <> 'cancelled';
  end if;
end;
$$;

create or replace function private.begin_project_cancellation(
  p_project_id uuid,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.projects%rowtype;
  v_cancellation_id uuid;
  released record;
begin
  if p_actor_id is null then raise exception 'authentication_required'; end if;

  select project.* into target
  from public.projects project
  where project.id = p_project_id
  for update;
  if not found then raise exception 'project_not_found'; end if;
  if target.creator_id <> p_actor_id and not exists (
    select 1 from private.backed_admins admin where admin.user_id = p_actor_id
  ) then
    raise exception 'project_cancellation_forbidden';
  end if;

  select cancellation.id into v_cancellation_id
  from public.project_cancellations cancellation
  where cancellation.project_id = target.id;
  if v_cancellation_id is not null then return v_cancellation_id; end if;
  if target.status <> 'live' then raise exception 'project_not_cancellable'; end if;

  update public.projects
  set status = 'cancelling', updated_at = now()
  where id = target.id;

  insert into public.project_cancellations(project_id, initiated_by)
  values (target.id, p_actor_id)
  returning id into v_cancellation_id;

  insert into public.project_cancellation_refunds(
    cancellation_id, project_id, backing_id, requested_amount
  )
  select
    v_cancellation_id,
    backing.project_id,
    backing.id,
    backing.gross_amount - coalesce(backing.refund_amount, 0)
  from public.backings backing
  where backing.project_id = target.id
    and backing.status = 'paid'
    and backing.paid_at is not null
    and backing.stripe_checkout_session_id is not null
    and backing.stripe_payment_intent_id is not null
    and backing.stripe_charge_id is not null
    and backing.gross_amount > coalesce(backing.refund_amount, 0)
  on conflict (backing_id) do nothing;

  update public.project_cancellations cancellation
  set
    eligible_refund_count = summary.refund_count,
    eligible_refund_amount = summary.refund_amount,
    updated_at = now()
  from (
    select count(*)::integer as refund_count, coalesce(sum(requested_amount), 0)::integer as refund_amount
    from public.project_cancellation_refunds
    where project_cancellation_refunds.cancellation_id = v_cancellation_id
  ) summary
  where cancellation.id = v_cancellation_id;

  for released in
    with released_reservations as (
      update public.reward_reservations reservation
      set released_at = now()
      from public.rewards reward
      where reservation.reward_id = reward.id
        and reward.project_id = target.id
        and reservation.converted_at is null
        and reservation.released_at is null
      returning reservation.reward_id
    )
    select reward_id, count(*)::integer as quantity
    from released_reservations
    group by reward_id
  loop
    update public.rewards
    set reserved_quantity = greatest(0, reserved_quantity - released.quantity)
    where id = released.reward_id;
  end loop;

  update public.checkout_backing_intents
  set released_at = now()
  where project_id = target.id and converted_at is null and released_at is null;

  insert into public.notifications(
    recipient_id, event_type, project_id, actor_id, title, body, target_url, dedupe_key
  )
  select
    backing.backer_id,
    'project_cancelled',
    target.id,
    p_actor_id,
    target.name || ' was cancelled',
    'Your eligible backing is being refunded.',
    '/projects/' || target.slug,
    'project-cancelled:' || v_cancellation_id::text || ':' || backing.id::text
  from public.project_cancellation_refunds refund
  join public.backings backing on backing.id = refund.backing_id
  where refund.cancellation_id = v_cancellation_id and backing.backer_id is not null
  on conflict (recipient_id, dedupe_key) do nothing;

  perform private.refresh_project_cancellation(target.id);
  return v_cancellation_id;
end;
$$;

revoke all on function private.refresh_project_cancellation(uuid) from public, anon, authenticated;
revoke all on function private.begin_project_cancellation(uuid, uuid) from public, anon, authenticated;

create or replace function public.begin_project_cancellation(p_project_id uuid, p_actor_id uuid)
returns uuid
language sql
security definer
set search_path = ''
as $$ select private.begin_project_cancellation(p_project_id, p_actor_id); $$;

create or replace function public.refresh_project_cancellation(p_project_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$ select private.refresh_project_cancellation(p_project_id); $$;

create or replace function public.can_cancel_project(p_project_id uuid, p_actor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects project
    where project.id = p_project_id
      and (
        project.creator_id = p_actor_id
        or exists (select 1 from private.backed_admins admin where admin.user_id = p_actor_id)
      )
  );
$$;

create or replace function public.queue_cancellation_backing(p_backing_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.backings%rowtype;
  v_cancellation_id uuid;
  v_refund_id uuid;
begin
  select backing.* into target
  from public.backings backing
  where backing.id = p_backing_id
  for update;
  if not found or target.status <> 'paid' or target.paid_at is null
     or target.stripe_checkout_session_id is null
     or target.stripe_payment_intent_id is null
     or target.stripe_charge_id is null
     or target.gross_amount <= coalesce(target.refund_amount, 0) then
    return null;
  end if;
  select cancellation.id into v_cancellation_id
  from public.project_cancellations cancellation
  where cancellation.project_id = target.project_id;
  if v_cancellation_id is null then return null; end if;

  insert into public.project_cancellation_refunds(
    cancellation_id, project_id, backing_id, requested_amount
  ) values (
    v_cancellation_id,
    target.project_id,
    target.id,
    target.gross_amount - coalesce(target.refund_amount, 0)
  ) on conflict (backing_id) do update
    set requested_amount = excluded.requested_amount, updated_at = now()
  returning id into v_refund_id;

  update public.project_cancellations cancellation
  set
    eligible_refund_count = summary.refund_count,
    eligible_refund_amount = summary.refund_amount,
    status = case when cancellation.status = 'completed' then 'processing' else cancellation.status end,
    completed_at = case when cancellation.status = 'completed' then null else cancellation.completed_at end,
    updated_at = now()
  from (
    select count(*)::integer as refund_count, coalesce(sum(requested_amount), 0)::integer as refund_amount
    from public.project_cancellation_refunds
    where cancellation_id = v_cancellation_id and status <> 'excluded'
  ) summary
  where cancellation.id = v_cancellation_id;
  update public.projects set status = 'cancelling', updated_at = now()
  where id = target.project_id and status = 'cancelled';
  return v_refund_id;
end;
$$;

revoke all on function public.begin_project_cancellation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.refresh_project_cancellation(uuid) from public, anon, authenticated;
revoke all on function public.can_cancel_project(uuid, uuid) from public, anon, authenticated;
revoke all on function public.queue_cancellation_backing(uuid) from public, anon, authenticated;
grant execute on function public.begin_project_cancellation(uuid, uuid) to service_role;
grant execute on function public.refresh_project_cancellation(uuid) to service_role;
grant execute on function public.can_cancel_project(uuid, uuid) to service_role;
grant execute on function public.queue_cancellation_backing(uuid) to service_role;

-- Stripe remains the source of truth for refund completion. Webhook replay is
-- harmless: the Stripe refund id is unique and aggregate backing state is
-- recomputed from succeeded refund rows.
create or replace function public.record_stripe_refund(
  p_stripe_refund_id text,
  p_payment_intent_id text,
  p_amount integer,
  p_status text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_backing public.backings%rowtype;
  total_refunded integer;
  target_project_id uuid;
begin
  select backing.* into target_backing
  from public.backings backing
  where backing.stripe_payment_intent_id = p_payment_intent_id
  for update;
  if not found then return null; end if;

  insert into public.backing_refunds(stripe_refund_id, backing_id, amount, status)
  values (p_stripe_refund_id, target_backing.id, p_amount, p_status)
  on conflict (stripe_refund_id) do update
    set amount = excluded.amount, status = excluded.status, updated_at = now();

  select coalesce(sum(refund.amount) filter (where refund.status = 'succeeded'), 0)::integer
  into total_refunded
  from public.backing_refunds refund
  where refund.backing_id = target_backing.id;

  update public.backings
  set
    stripe_refund_id = p_stripe_refund_id,
    refund_amount = total_refunded,
    refund_status = case
      when p_status = 'succeeded' then 'succeeded'::public.refund_status
      when p_status = 'failed' then 'failed'::public.refund_status
      else 'pending'::public.refund_status
    end,
    refunded_at = case when total_refunded >= gross_amount then coalesce(refunded_at, now()) else refunded_at end,
    status = case when total_refunded >= gross_amount then 'refunded'::public.backing_status else 'paid'::public.backing_status end,
    updated_at = now()
  where id = target_backing.id;

  update public.project_cancellation_refunds cancellation_refund
  set
    status = case
      when p_status = 'succeeded' then 'succeeded'
      when p_status in ('failed', 'canceled') then 'failed'
      else 'pending'
    end,
    failure_code = case when p_status in ('failed', 'canceled') then 'stripe_refund_' || p_status else null end,
    completed_at = case when p_status = 'succeeded' then coalesce(completed_at, now()) else null end,
    updated_at = now()
  where cancellation_refund.stripe_refund_id = p_stripe_refund_id
  returning cancellation_refund.project_id into target_project_id;

  if target_project_id is not null then
    perform private.refresh_project_cancellation(target_project_id);
  end if;
  return target_backing.id;
end;
$$;

revoke all on function public.record_stripe_refund(text, text, integer, text)
  from public, anon, authenticated;

-- Keep cancellation state private while allowing canonical cancelled project
-- pages to remain available. Marketplace RPCs continue filtering active states.
create or replace view public.public_profile_projects as
with backing_metrics as (
  select
    backing.project_id,
    count(distinct coalesce(backing.backer_id, backing.id))::integer as backer_count,
    max(coalesce(backing.paid_at, backing.created_at)) as latest_backed_at
  from public.backings backing
  where backing.status = 'paid'
    and coalesce(backing.refund_amount, 0) < backing.gross_amount
  group by backing.project_id
), comment_metrics as (
  select comment.project_id, count(*)::integer as comment_count
  from public.project_comments comment
  where comment.moderation_status = 'visible' and comment.deleted_at is null
  group by comment.project_id
), favorite_metrics as (
  select favorite.project_id, count(*)::integer as favorite_count
  from public.project_favorites favorite
  group by favorite.project_id
)
select
  lower(profile.username) as creator_username,
  project.slug,
  project.name,
  project.summary,
  project.description,
  project.image_url,
  project.currency,
  project.funding_goal_amount,
  project.initial_backed_amount,
  project.successful_backed_amount,
  coalesce(backing_metrics.backer_count, 0) as successful_backer_count,
  project.deadline_at,
  profile.display_name as creator_display_name,
  profile.avatar_url as creator_avatar_url,
  coalesce((
    select reward.total_quantity - reward.claimed_quantity - count(reservation.id)::integer
    from public.rewards reward
    left join public.reward_reservations reservation
      on reservation.reward_id = reward.id
      and reservation.converted_at is null
      and reservation.released_at is null
      and reservation.expires_at > now()
    where reward.project_id = project.id
    group by reward.id, reward.total_quantity, reward.claimed_quantity
    order by reward.created_at limit 1
  ), 0) as reward_available_quantity,
  project.gallery_media,
  project.category,
  project.external_website,
  project.location,
  project.project_dates,
  (select reward.title from public.rewards reward where reward.project_id = project.id order by reward.created_at limit 1) as reward_title,
  (select reward.description from public.rewards reward where reward.project_id = project.id order by reward.created_at limit 1) as reward_description,
  (select reward.amount from public.rewards reward where reward.project_id = project.id order by reward.created_at limit 1) as reward_amount,
  (select reward.total_quantity from public.rewards reward where reward.project_id = project.id order by reward.created_at limit 1) as reward_total_quantity,
  project.gallery_urls,
  project.created_at,
  backing_metrics.latest_backed_at,
  coalesce(comment_metrics.comment_count, 0) as comment_count,
  coalesce(favorite_metrics.favorite_count, 0) as favorite_count,
  project.status,
  project.planned_launch_at,
  coalesce(cancellation.status = 'completed', false) as cancellation_complete
from public.projects project
join public.profiles profile on profile.id = project.creator_id
left join backing_metrics on backing_metrics.project_id = project.id
left join comment_metrics on comment_metrics.project_id = project.id
left join favorite_metrics on favorite_metrics.project_id = project.id
left join public.project_cancellations cancellation on cancellation.project_id = project.id
where profile.username is not null
  and profile.deleted_at is null
  and project.status in ('prelaunch', 'live', 'cancelling', 'cancelled')
  and project.admin_archived_at is null
  and project.admin_suspended_at is null
  and project.creator_archived_at is null;

revoke all on public.public_profile_projects from public;
grant select on public.public_profile_projects to anon, authenticated;

create or replace function public.get_similar_projects(p_slug text, p_limit integer default 3)
returns setof public.public_profile_projects
language sql stable set search_path = '' as $$
  select candidate.*
  from public.public_profile_projects current_project
  join public.public_profile_projects candidate on candidate.slug <> current_project.slug
  where current_project.slug = p_slug
    and candidate.status in ('prelaunch', 'live')
  order by
    (candidate.category = current_project.category) desc,
    (candidate.creator_username <> current_project.creator_username) desc,
    candidate.latest_backed_at desc nulls last,
    candidate.successful_backer_count desc,
    candidate.successful_backed_amount desc,
    candidate.created_at desc,
    candidate.slug asc
  limit least(greatest(coalesce(p_limit, 3), 1), 3);
$$;

create or replace function public.search_public_marketplace(
  p_query text,
  p_project_limit integer default 5,
  p_creator_limit integer default 3
)
returns table(result_type text, slug text, username text, title text, subtitle text, image_url text)
language sql stable set search_path = 'pg_catalog' as $$
  with normalized as (
    select left(lower(btrim(coalesce(p_query, ''))), 100) as query
  ), parameters as (
    select query,
      '%' || replace(replace(replace(query, E'\\\\', E'\\\\\\\\'), '%', E'\\\\%'), '_', E'\\\\_') || '%' as pattern
    from normalized
  ), project_matches as (
    select 'project'::text as result_type, project.slug, project.creator_username as username,
      project.name as title,
      coalesce(nullif(btrim(project.summary), ''), left(btrim(coalesce(project.description, '')), 160), '') as subtitle,
      project.image_url,
      case when lower(project.name) = parameters.query then 0
        when left(lower(project.name), length(parameters.query)) = parameters.query then 1 else 2 end as relevance
    from public.public_profile_projects project cross join parameters
    where length(parameters.query) >= 2
      and project.status in ('prelaunch', 'live')
      and lower(coalesce(project.name, '') || ' ' || coalesce(project.summary, '') || ' ' || coalesce(project.description, ''))
        like parameters.pattern escape E'\\\\'
    order by relevance, project.created_at desc nulls last, project.slug
    limit least(greatest(coalesce(p_project_limit, 5), 0), 5)
  ), creator_matches as (
    select 'creator'::text as result_type, null::text as slug, profile.username,
      coalesce(nullif(btrim(profile.display_name), ''), profile.username) as title,
      '@' || profile.username as subtitle, profile.avatar_url as image_url,
      case when lower(profile.username) = parameters.query then 0
        when lower(coalesce(profile.display_name, '')) = parameters.query then 1
        when left(lower(profile.username), length(parameters.query)) = parameters.query then 2
        when left(lower(coalesce(profile.display_name, '')), length(parameters.query)) = parameters.query then 3 else 4 end as relevance
    from public.public_profiles profile cross join parameters
    where length(parameters.query) >= 2
      and lower(coalesce(profile.display_name, '') || ' ' || coalesce(profile.username, ''))
        like parameters.pattern escape E'\\\\'
    order by relevance, profile.username
    limit least(greatest(coalesce(p_creator_limit, 3), 0), 3)
  )
  select result_type, slug, username, title, subtitle, image_url
  from (
    select 0 as section_order, project.* from project_matches project
    union all
    select 1 as section_order, creator.* from creator_matches creator
  ) result
  order by result.section_order, result.relevance, lower(result.title);
$$;

drop policy if exists "public projects are readable" on public.projects;
create policy "public projects are readable"
  on public.projects for select
  using (
    (
      status in ('prelaunch', 'live', 'funded', 'completed', 'cancelling', 'cancelled')
      and admin_archived_at is null
      and admin_suspended_at is null
      and creator_archived_at is null
    )
    or creator_id = (select auth.uid())
  );

-- Keep public discussion/history available after cancellation.
create or replace function public.list_project_updates(p_project_slug text, p_update_id uuid default null)
returns table(id uuid, title text, body text, image_path text, published_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select project_update.id, project_update.title, project_update.body, project_update.image_path,
    project_update.published_at, project_update.updated_at
  from public.project_updates project_update
  join public.projects project on project.id = project_update.project_id
  join public.profiles creator on creator.id = project.creator_id
  where project.slug = p_project_slug
    and (p_update_id is null or project_update.id = p_update_id)
    and project_update.deleted_at is null
    and project.status in ('live', 'funded', 'unsuccessful', 'completed', 'cancelling', 'cancelled')
    and project.admin_archived_at is null and project.admin_suspended_at is null
    and project.creator_archived_at is null and creator.deleted_at is null
  order by project_update.published_at desc;
$$;

create or replace function public.list_project_comments(p_project_slug text)
returns table(
  id uuid, body text, created_at timestamptz, updated_at timestamptz,
  display_name text, username text, avatar_url text,
  is_creator boolean, is_own boolean, can_moderate boolean
)
language sql stable security definer set search_path = public, private as $$
  with actor as (
    select (select auth.uid()) as user_id,
      exists (select 1 from private.backed_admins admin where admin.user_id = (select auth.uid())) as is_admin
  )
  select comment.id, comment.body, comment.created_at, comment.updated_at,
    profile.display_name, profile.username, profile.avatar_url,
    comment.author_id = project.creator_id,
    comment.author_id = actor.user_id,
    (actor.is_admin or project.creator_id = actor.user_id)
  from public.project_comments comment
  join public.projects project on project.id = comment.project_id
  join public.profiles profile on profile.id = comment.author_id
  cross join actor
  where project.slug = p_project_slug
    and project.status in ('live', 'funded', 'unsuccessful', 'completed', 'cancelling', 'cancelled')
    and project.admin_archived_at is null and project.admin_suspended_at is null
    and project.creator_archived_at is null and profile.deleted_at is null
    and comment.moderation_status = 'visible' and comment.deleted_at is null
  order by comment.created_at, comment.id;
$$;

revoke all on function public.list_project_updates(text, uuid) from public;
grant execute on function public.list_project_updates(text, uuid) to anon, authenticated;
revoke all on function public.list_project_comments(text) from public;
grant execute on function public.list_project_comments(text) to anon, authenticated;

create or replace function public.create_project_update(
  p_project_slug text,
  p_title text,
  p_body text,
  p_image_path text,
  p_idempotency_key uuid
)
returns table(
  id uuid, title text, body text, image_path text,
  published_at timestamptz, updated_at timestamptz, created boolean
)
language plpgsql security definer set search_path = public as $$
declare
  actor_id uuid := auth.uid();
  target_project public.projects%rowtype;
  existing_update public.project_updates%rowtype;
  new_update public.project_updates%rowtype;
  normalized_title text := btrim(coalesce(p_title, ''));
  normalized_body text := btrim(coalesce(p_body, ''));
  normalized_image_path text := nullif(btrim(coalesce(p_image_path, '')), '');
  expected_image_prefix text;
begin
  if actor_id is null then raise exception 'authentication_required'; end if;
  if char_length(normalized_title) not between 1 and 160 then raise exception 'invalid_update_title'; end if;
  if char_length(normalized_body) not between 1 and 20000 then raise exception 'invalid_update_body'; end if;
  if p_idempotency_key is null then raise exception 'idempotency_key_required'; end if;

  select project.* into target_project
  from public.projects project
  where project.slug = p_project_slug
  for update;
  if not found
     or target_project.creator_id <> actor_id
     or target_project.status not in ('live', 'funded', 'unsuccessful', 'completed', 'cancelling', 'cancelled')
     or target_project.admin_archived_at is not null
     or target_project.admin_suspended_at is not null
     or target_project.creator_archived_at is not null then
    raise exception 'project_access_denied';
  end if;

  expected_image_prefix := 'projects/' || target_project.id::text || '/updates/';
  if normalized_image_path is not null and (
    position(expected_image_prefix in normalized_image_path) <> 1
    or normalized_image_path !~ '\.(jpg|png|webp)$'
    or not exists (
      select 1 from storage.objects object
      where object.bucket_id = 'project-media' and object.name = normalized_image_path
    )
  ) then
    raise exception 'invalid_update_image';
  end if;

  select project_update.* into existing_update
  from public.project_updates project_update
  where project_update.project_id = target_project.id
    and project_update.idempotency_key = p_idempotency_key;
  if found then
    return query select existing_update.id, existing_update.title, existing_update.body,
      existing_update.image_path, existing_update.published_at, existing_update.updated_at, false;
    return;
  end if;

  insert into public.project_updates(project_id, author_id, title, body, image_path, idempotency_key)
  values(target_project.id, actor_id, normalized_title, normalized_body, normalized_image_path, p_idempotency_key)
  returning * into new_update;

  insert into public.email_deliveries(dedupe_key, event_type, backing_id, recipient_email)
  select
    'project-update:' || new_update.id::text || ':' || recipients.backer_id::text,
    'project_update', recipients.backing_id, recipients.email
  from (
    select distinct on (backing.backer_id)
      backing.backer_id, backing.id as backing_id, profile.email
    from public.backings backing
    join public.profiles profile on profile.id = backing.backer_id
    where backing.project_id = target_project.id
      and backing.status in ('paid', 'refunded')
      and backing.backer_id is not null
      and profile.receive_project_updates = true
      and profile.deleted_at is null
      and nullif(btrim(coalesce(profile.email, '')), '') is not null
    order by backing.backer_id, backing.paid_at, backing.id
  ) recipients
  on conflict (dedupe_key) do nothing;

  return query select new_update.id, new_update.title, new_update.body,
    new_update.image_path, new_update.published_at, new_update.updated_at, true;
end;
$$;

revoke all on function public.create_project_update(text, text, text, text, uuid) from public;
grant execute on function public.create_project_update(text, text, text, text, uuid) to authenticated;
