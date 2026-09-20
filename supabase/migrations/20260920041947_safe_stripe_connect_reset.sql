-- Allow creators to replace an unused, incomplete Connect account without
-- losing the identity of any account that was previously active.
alter table public.profiles
  add column if not exists stripe_connect_generation integer not null default 0
    check (stripe_connect_generation >= 0),
  add column if not exists stripe_reset_in_progress boolean not null default false;

-- A transfer keeps its immutable destination even if the creator later has a
-- different active account. This is intentionally separate from the mutable
-- profile association.
alter table public.backings
  add column if not exists creator_stripe_account_id text;

update public.backings b
set creator_stripe_account_id = creator.stripe_account_id
from public.projects project
join public.profiles creator on creator.id = project.creator_id
where b.project_id = project.id
  and b.stripe_transfer_id is not null
  and b.creator_stripe_account_id is null;

create index if not exists backings_creator_stripe_account_id_idx
  on public.backings (creator_stripe_account_id)
  where creator_stripe_account_id is not null;

create table if not exists private.stripe_connect_account_resets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  old_stripe_account_id text not null,
  new_stripe_account_id text,
  reason text not null default 'creator_reset'
    check (reason = 'creator_reset'),
  status text not null
    check (status in ('in_progress', 'completed', 'failed')),
  stripe_deletion_succeeded boolean not null default false,
  failure_code text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists stripe_connect_account_resets_active_profile_key
  on private.stripe_connect_account_resets (profile_id)
  where status = 'in_progress';
create unique index if not exists stripe_connect_account_resets_old_account_completed_key
  on private.stripe_connect_account_resets (old_stripe_account_id)
  where status = 'completed';

revoke all on table private.stripe_connect_account_resets from public, anon, authenticated;

create or replace function public.inspect_stripe_connect_reset(
  p_profile_id uuid,
  p_stripe_account_id text
) returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  creator public.profiles%rowtype;
begin
  select * into creator
  from public.profiles
  where id = p_profile_id;

  if not found or creator.stripe_account_id is distinct from p_stripe_account_id then
    return jsonb_build_object('eligible', false, 'reason', 'account_changed');
  end if;

  if creator.stripe_reset_in_progress then
    return jsonb_build_object('eligible', false, 'reason', 'reset_in_progress');
  end if;

  if exists (
    select 1
    from public.backings backing
    join public.projects project on project.id = backing.project_id
    where project.creator_id = p_profile_id
      and (
        backing.stripe_transfer_id is not null
        or backing.creator_stripe_account_id is not null
        or backing.transfer_status in ('pending', 'created', 'confirmed', 'failed', 'reversed')
        or (backing.status::text in ('paid', 'refunded') and backing.creator_proceeds_amount > 0)
      )
  ) then
    return jsonb_build_object('eligible', false, 'reason', 'financial_history');
  end if;

  if exists (
    select 1
    from public.backing_refunds refund
    join public.backings backing on backing.id = refund.backing_id
    join public.projects project on project.id = backing.project_id
    where project.creator_id = p_profile_id
      and (
        refund.status in ('pending', 'failed')
        or refund.reversal_status in ('pending', 'created', 'failed')
      )
  ) then
    return jsonb_build_object('eligible', false, 'reason', 'unresolved_refunds');
  end if;

  if exists (
    select 1
    from public.backing_disputes dispute
    join public.backings backing on backing.id = dispute.backing_id
    join public.projects project on project.id = backing.project_id
    where project.creator_id = p_profile_id
      and dispute.status in ('needs_response', 'under_review')
  ) then
    return jsonb_build_object('eligible', false, 'reason', 'unresolved_disputes');
  end if;

  return jsonb_build_object('eligible', true, 'reason', null);
end;
$$;

create or replace function public.claim_stripe_connect_reset(
  p_profile_id uuid,
  p_stripe_account_id text
) returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  creator public.profiles%rowtype;
  eligibility jsonb;
  reset_row private.stripe_connect_account_resets%rowtype;
begin
  select * into creator
  from public.profiles
  where id = p_profile_id
  for update;

  if not found or creator.stripe_account_id is distinct from p_stripe_account_id then
    return jsonb_build_object('claimed', false, 'reason', 'account_changed');
  end if;

  if creator.stripe_reset_in_progress then
    select * into reset_row
    from private.stripe_connect_account_resets
    where profile_id = p_profile_id and status = 'in_progress'
    order by requested_at desc
    limit 1;
    return jsonb_build_object(
      'claimed', false,
      'reason', 'reset_in_progress',
      'resetId', reset_row.id,
      'recoverable', reset_row.requested_at < now() - interval '2 minutes'
    );
  end if;

  eligibility := public.inspect_stripe_connect_reset(p_profile_id, p_stripe_account_id);
  if not coalesce((eligibility ->> 'eligible')::boolean, false) then
    return jsonb_build_object(
      'claimed', false,
      'reason', coalesce(eligibility ->> 'reason', 'financial_history')
    );
  end if;

  update public.profiles
  set stripe_reset_in_progress = true
  where id = p_profile_id and stripe_account_id = p_stripe_account_id;

  insert into private.stripe_connect_account_resets (
    profile_id, old_stripe_account_id, status
  ) values (
    p_profile_id, p_stripe_account_id, 'in_progress'
  ) returning * into reset_row;

  return jsonb_build_object('claimed', true, 'reason', null, 'resetId', reset_row.id);
end;
$$;

create or replace function public.complete_stripe_connect_reset(
  p_profile_id uuid,
  p_stripe_account_id text,
  p_reset_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
declare
  changed_count integer;
begin
  perform 1
  from private.stripe_connect_account_resets
  where id = p_reset_id
    and profile_id = p_profile_id
    and old_stripe_account_id = p_stripe_account_id
    and status = 'in_progress'
  for update;
  if not found then
    return false;
  end if;

  update public.profiles
  set stripe_account_id = null,
      stripe_onboarding_complete = false,
      stripe_charges_enabled = false,
      stripe_payouts_enabled = false,
      stripe_requirements_due = '{}'::text[],
      stripe_connect_generation = stripe_connect_generation + 1,
      stripe_reset_in_progress = false
  where id = p_profile_id
    and stripe_account_id = p_stripe_account_id
    and stripe_reset_in_progress = true;
  get diagnostics changed_count = row_count;

  if changed_count <> 1 then
    return false;
  end if;

  update private.stripe_connect_account_resets
  set status = 'completed',
      stripe_deletion_succeeded = true,
      failure_code = null,
      completed_at = now()
  where id = p_reset_id
    and profile_id = p_profile_id
    and old_stripe_account_id = p_stripe_account_id
    and status = 'in_progress';

  return true;
end;
$$;

create or replace function public.release_stripe_connect_reset(
  p_profile_id uuid,
  p_stripe_account_id text,
  p_reset_id uuid,
  p_failure_code text
) returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
begin
  update public.profiles
  set stripe_reset_in_progress = false
  where id = p_profile_id
    and stripe_account_id = p_stripe_account_id
    and stripe_reset_in_progress = true;

  update private.stripe_connect_account_resets
  set status = 'failed',
      stripe_deletion_succeeded = false,
      failure_code = left(coalesce(p_failure_code, 'stripe_delete_failed'), 80),
      completed_at = now()
  where id = p_reset_id
    and profile_id = p_profile_id
    and old_stripe_account_id = p_stripe_account_id
    and status = 'in_progress';

  return found;
end;
$$;

create or replace function public.record_stripe_connect_replacement(
  p_profile_id uuid,
  p_new_stripe_account_id text
) returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  update private.stripe_connect_account_resets
  set new_stripe_account_id = p_new_stripe_account_id
  where id = (
    select id
    from private.stripe_connect_account_resets
    where profile_id = p_profile_id
      and status = 'completed'
      and new_stripe_account_id is null
    order by completed_at desc
    limit 1
  );
end;
$$;

revoke all on function public.inspect_stripe_connect_reset(uuid, text) from public, anon, authenticated;
revoke all on function public.claim_stripe_connect_reset(uuid, text) from public, anon, authenticated;
revoke all on function public.complete_stripe_connect_reset(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.release_stripe_connect_reset(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.record_stripe_connect_replacement(uuid, text) from public, anon, authenticated;

grant execute on function public.inspect_stripe_connect_reset(uuid, text) to service_role;
grant execute on function public.claim_stripe_connect_reset(uuid, text) to service_role;
grant execute on function public.complete_stripe_connect_reset(uuid, text, uuid) to service_role;
grant execute on function public.release_stripe_connect_reset(uuid, text, uuid, text) to service_role;
grant execute on function public.record_stripe_connect_replacement(uuid, text) to service_role;
