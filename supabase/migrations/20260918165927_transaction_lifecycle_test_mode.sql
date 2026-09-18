-- Test-mode transaction accounting. Amounts are stored in integer cents.
alter table public.projects
  add column if not exists successful_backed_amount integer not null default 0 check (successful_backed_amount >= 0),
  add column if not exists successful_backer_count integer not null default 0 check (successful_backer_count >= 0);

alter table public.backings
  add column if not exists processing_fee_amount integer not null default 0 check (processing_fee_amount >= 0),
  add column if not exists net_creator_proceeds_amount integer not null default 0 check (net_creator_proceeds_amount >= 0),
  add column if not exists stripe_charge_id text;

alter table public.project_settlements
  add column if not exists gross_amount integer not null default 0,
  add column if not exists platform_fee_amount integer not null default 0,
  add column if not exists processing_fee_amount integer not null default 0,
  add column if not exists creator_proceeds_amount integer not null default 0,
  add column if not exists failure_reason text;

create unique index if not exists backings_stripe_checkout_session_id_key
  on public.backings (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
create unique index if not exists backings_stripe_payment_intent_id_key
  on public.backings (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
create unique index if not exists email_deliveries_dedupe_key_key
  on public.email_deliveries (dedupe_key);

create or replace function public.finalize_stripe_checkout(
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_processing_fee_amount integer,
  p_backer_email text,
  p_stripe_charge_id text default null
) returns table(backing_id uuid, project_id uuid, email_delivery_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  r public.reward_reservations%rowtype;
  rw public.rewards%rowtype;
  b_id uuid;
  e_id uuid;
  p_id uuid;
  fee integer;
  proceeds integer;
begin
  select * into r from public.reward_reservations
    where checkout_session_id = p_checkout_session_id for update;
  if not found then raise exception 'checkout_reservation_not_found'; end if;

  select id into b_id from public.backings
    where stripe_checkout_session_id = p_checkout_session_id;
  if found then
    select b.project_id, e.id into p_id, e_id
      from public.backings b left join public.email_deliveries e on e.backing_id = b.id
      where b.id = b_id order by e.created_at limit 1;
    return query select b_id, p_id, e_id;
    return;
  end if;

  if r.converted_at is not null or r.released_at is not null or r.expires_at <= now() then
    raise exception 'checkout_reservation_not_active';
  end if;
  select * into rw from public.rewards where id = r.reward_id for update;
  if not found then raise exception 'reward_not_found'; end if;
  fee := round(rw.amount * 0.10);
  proceeds := greatest(0, rw.amount - fee - greatest(0, p_processing_fee_amount));
  select project_id into p_id from public.rewards where id = rw.id;

  insert into public.backings (
    project_id, reward_id, backer_id, reservation_id, backer_email, gross_amount,
    platform_fee_amount, processing_fee_amount, creator_proceeds_amount,
    net_creator_proceeds_amount, currency, status, stripe_checkout_session_id,
    stripe_payment_intent_id, stripe_charge_id, paid_at
  ) values (
    p_id, rw.id, r.user_id, r.id, p_backer_email, rw.amount,
    fee, greatest(0, p_processing_fee_amount), proceeds, proceeds, 'usd', 'paid',
    p_checkout_session_id, p_payment_intent_id, p_stripe_charge_id, now()
  ) returning id into b_id;

  update public.rewards
    set reserved_quantity = greatest(0, reserved_quantity - 1), claimed_quantity = claimed_quantity + 1
    where id = rw.id;
  update public.reward_reservations set converted_at = now() where id = r.id;
  update public.projects
    set successful_backed_amount = successful_backed_amount + rw.amount,
        successful_backer_count = successful_backer_count + 1
    where id = p_id;
  insert into public.email_deliveries (dedupe_key, event_type, backing_id, recipient_email)
    values ('backing-confirmation:' || b_id::text, 'backing_confirmation', b_id, p_backer_email)
    on conflict (dedupe_key) do nothing returning id into e_id;
  return query select b_id, p_id, e_id;
end;
$$;

create or replace function public.release_checkout_reservation(p_checkout_session_id text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.reward_reservations%rowtype;
begin
  select * into r from public.reward_reservations where checkout_session_id = p_checkout_session_id for update;
  if not found or r.converted_at is not null or r.released_at is not null then return; end if;
  update public.rewards set reserved_quantity = greatest(0, reserved_quantity - 1) where id = r.reward_id;
  update public.reward_reservations set released_at = now() where id = r.id;
end;
$$;

revoke all on function public.finalize_stripe_checkout(text,text,integer,text,text) from public, anon, authenticated;
revoke all on function public.release_checkout_reservation(text) from public, anon, authenticated;

-- Seed the canonical V1 integration project. The $100 founder seed remains separate from payments.
insert into public.projects (
  creator_id, slug, name, summary, description, funding_goal_amount, initial_backed_amount,
  currency, status, launch_at, deadline_at
)
select id, 'launch-island', 'Launch Island',
  '6 indie hackers. One tropical island. One week to build.',
  'A week in Thailand for six indie hackers to build, ship and live together.',
  100000, 10000, 'usd', 'live', now(), '2026-11-01T00:00:00+07:00'::timestamptz
from public.profiles
where not exists (select 1 from public.projects where slug = 'launch-island')
limit 1;

insert into public.rewards (project_id, title, description, amount, total_quantity)
select id, 'Founding Guest', 'One of only six spots at the first Launch Island.', 100000, 6
from public.projects p
where p.slug = 'launch-island'
  and not exists (select 1 from public.rewards r where r.project_id = p.id and r.title = 'Founding Guest');
