-- Backed is a per-backing marketplace. Funding goals remain display-only progress targets.
-- Preserve existing financial records while recording the lifecycle of future Connect transfers,
-- refunds, reversals, and disputes explicitly.

alter table public.backings
  add column if not exists transfer_status text not null default 'not_started'
    check (transfer_status in ('not_started', 'not_required', 'pending', 'created', 'confirmed', 'reversed', 'failed')),
  add column if not exists transfer_created_at timestamptz,
  add column if not exists transfer_reversal_id text,
  add column if not exists transfer_reversed_at timestamptz,
  add column if not exists transfer_reversal_failure_reason text,
  add column if not exists stripe_balance_transaction_id text,
  add column if not exists stripe_dispute_id text,
  add column if not exists dispute_status text not null default 'none'
    check (dispute_status in ('none', 'needs_response', 'under_review', 'won', 'lost')),
  add column if not exists disputed_at timestamptz;

update public.backings
set transfer_status = case
  when transfer_reversed_at is not null then 'reversed'
  when transferred_at is not null then 'confirmed'
  when stripe_transfer_id is not null then 'created'
  when status = 'paid' then 'pending'
  else 'not_started'
end
where transfer_status = 'not_started';

create unique index if not exists backings_stripe_transfer_reversal_id_key
  on public.backings (transfer_reversal_id) where transfer_reversal_id is not null;
create unique index if not exists backings_stripe_dispute_id_key
  on public.backings (stripe_dispute_id) where stripe_dispute_id is not null;

create table if not exists public.backing_refunds (
  stripe_refund_id text primary key,
  backing_id uuid not null references public.backings(id) on delete restrict,
  amount integer not null check (amount > 0),
  status text not null check (status in ('pending', 'succeeded', 'failed', 'canceled')),
  transfer_reversal_id text unique,
  transfer_reversal_amount integer not null default 0 check (transfer_reversal_amount >= 0),
  reversal_status text not null default 'not_required'
    check (reversal_status in ('not_required', 'pending', 'created', 'confirmed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists backing_refunds_backing_id_idx on public.backing_refunds(backing_id);
revoke all on public.backing_refunds from anon, authenticated;

create table if not exists public.backing_disputes (
  stripe_dispute_id text primary key,
  backing_id uuid not null references public.backings(id) on delete restrict,
  amount integer not null check (amount > 0),
  status text not null check (status in ('needs_response', 'under_review', 'won', 'lost')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists backing_disputes_backing_id_idx on public.backing_disputes(backing_id);
revoke all on public.backing_disputes from anon, authenticated;

-- Checkout is finalized exclusively by a verified server-side Stripe webhook.
-- Use integer half-up rounding for a 5% fee in the smallest currency unit.
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
  fee := ((rw.amount * 5 + 50) / 100)::integer;
  proceeds := greatest(0, rw.amount - fee - greatest(0, p_processing_fee_amount));
  select project_id into p_id from public.rewards where id = rw.id;

  insert into public.backings (
    project_id, reward_id, backer_id, reservation_id, backer_email, gross_amount,
    platform_fee_amount, processing_fee_amount, creator_proceeds_amount,
    net_creator_proceeds_amount, currency, status, stripe_checkout_session_id,
    stripe_payment_intent_id, stripe_charge_id,
    transfer_status, paid_at
  ) values (
    p_id, rw.id, r.user_id, r.id, p_backer_email, rw.amount,
    fee, greatest(0, p_processing_fee_amount), proceeds, proceeds, 'usd', 'paid',
    p_checkout_session_id, p_payment_intent_id, p_stripe_charge_id,
    'pending', now()
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

create or replace function public.record_stripe_refund(
  p_stripe_refund_id text,
  p_payment_intent_id text,
  p_amount integer,
  p_status text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  b public.backings%rowtype;
  total_refunded integer;
begin
  select * into b from public.backings where stripe_payment_intent_id = p_payment_intent_id for update;
  if not found then return null; end if;
  insert into public.backing_refunds(stripe_refund_id, backing_id, amount, status)
    values (p_stripe_refund_id, b.id, p_amount, p_status)
    on conflict (stripe_refund_id) do update
      set amount = excluded.amount, status = excluded.status, updated_at = now();
  select coalesce(sum(amount) filter (where status = 'succeeded'), 0)::integer
    into total_refunded from public.backing_refunds where backing_id = b.id;
  update public.backings
    set stripe_refund_id = p_stripe_refund_id,
        refund_amount = total_refunded,
        refund_status = case
          when p_status = 'succeeded' then 'succeeded'::public.refund_status
          when p_status = 'failed' then 'failed'::public.refund_status
          else 'pending'::public.refund_status
        end,
        refunded_at = case when total_refunded >= gross_amount then now() else refunded_at end,
        status = case when total_refunded >= gross_amount then 'refunded'::public.backing_status else 'paid'::public.backing_status end
    where id = b.id;
  return b.id;
end;
$$;

create or replace function public.record_stripe_dispute(
  p_stripe_dispute_id text,
  p_payment_intent_id text,
  p_amount integer,
  p_status text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare b_id uuid;
begin
  select id into b_id from public.backings where stripe_payment_intent_id = p_payment_intent_id for update;
  if not found then return null; end if;
  insert into public.backing_disputes(stripe_dispute_id, backing_id, amount, status, resolved_at)
    values (p_stripe_dispute_id, b_id, p_amount, p_status,
      case when p_status in ('won', 'lost') then now() else null end)
    on conflict (stripe_dispute_id) do update
      set amount = excluded.amount, status = excluded.status,
          resolved_at = case when excluded.status in ('won', 'lost') then now() else null end,
          updated_at = now();
  update public.backings
    set stripe_dispute_id = p_stripe_dispute_id,
        dispute_status = p_status,
        disputed_at = case when p_status in ('needs_response', 'under_review') then now() else disputed_at end
    where id = b_id;
  return b_id;
end;
$$;

revoke all on function public.finalize_stripe_checkout(text,text,integer,text,text) from public, anon, authenticated;
revoke all on function public.record_stripe_refund(text,text,integer,text) from public, anon, authenticated;
revoke all on function public.record_stripe_dispute(text,text,integer,text) from public, anon, authenticated;

-- Retire the all-or-nothing job before replacing it. Historical settlement records are retained.
select cron.unschedule(jobid) from cron.job where jobname = 'backed-campaign-settlement';

create or replace function private.invoke_campaign_settlement()
returns void language plpgsql security definer set search_path = private as $$
begin
  -- Retired: campaigns are no longer settled or refunded by funding-goal outcome.
  return;
end;
$$;

create or replace function private.invoke_creator_proceeds_reconciliation()
returns void language plpgsql security definer set search_path = extensions, vault, private as $$
declare secret_value text;
begin
  select decrypted_secret into secret_value
  from vault.decrypted_secrets where name = 'backed_settlement_cron_secret';
  if secret_value is null then
    raise warning 'creator proceeds cron secret is not configured in Vault';
    return;
  end if;
  perform net.http_post(
    url := 'https://zlzaxgsyczfeepwidjii.supabase.co/functions/v1/creator-proceeds-reconciliation',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-settlement-secret', secret_value),
    body := '{}'::jsonb
  );
end;
$$;
revoke all on function private.invoke_campaign_settlement() from public, anon, authenticated;
revoke all on function private.invoke_creator_proceeds_reconciliation() from public, anon, authenticated;
select cron.schedule('backed-creator-proceeds-reconciliation', '*/10 * * * *', 'select private.invoke_creator_proceeds_reconciliation();');
