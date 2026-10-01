alter table public.project_drafts
  add column if not exists compliance_attested_by uuid references auth.users(id) on delete set null,
  add column if not exists compliance_attested_at timestamptz,
  add column if not exists acceptable_use_version text,
  add column if not exists terms_version text,
  add column if not exists compliance_attestation_type text,
  add column if not exists benefits_third_party_or_cause boolean;

alter table public.projects
  add column if not exists compliance_review_status text not null default 'not_required',
  add column if not exists compliance_intended_status text,
  add column if not exists compliance_benefits_third_party_or_cause boolean,
  add column if not exists compliance_reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists compliance_reviewed_at timestamptz,
  add column if not exists compliance_review_outcome text;

alter table public.projects
  drop constraint if exists projects_compliance_review_status_check,
  drop constraint if exists projects_compliance_intended_status_check,
  drop constraint if exists projects_compliance_review_outcome_check;

alter table public.projects
  add constraint projects_compliance_review_status_check
    check (compliance_review_status in ('not_required', 'pending', 'approved', 'rejected')),
  add constraint projects_compliance_intended_status_check
    check (compliance_intended_status is null or compliance_intended_status in ('live', 'prelaunch')),
  add constraint projects_compliance_review_outcome_check
    check (compliance_review_outcome is null or compliance_review_outcome in ('approved', 'rejected'));

create table if not exists public.project_compliance_attestations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  accepted_at timestamptz not null default now(),
  acceptable_use_version text not null,
  terms_version text not null,
  attestation_type text not null,
  benefits_third_party_or_cause boolean not null,
  unique (project_id, acceptable_use_version, attestation_type)
);

create table if not exists public.project_compliance_flags (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz
);

alter table public.project_compliance_attestations enable row level security;
alter table public.project_compliance_flags enable row level security;
revoke all on public.project_compliance_attestations from public, anon, authenticated;
revoke all on public.project_compliance_flags from public, anon, authenticated;

create or replace function public.record_draft_compliance_attestation(
  p_draft_id uuid,
  p_secret_hash text,
  p_user_id uuid,
  p_benefits_third_party_or_cause boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.project_drafts%rowtype;
begin
  select * into d
  from public.project_drafts
  where id = p_draft_id and secret_hash = p_secret_hash
  for update;

  if not found then raise exception 'draft_not_found'; end if;
  if d.owner_id is not null and d.owner_id <> p_user_id then
    raise exception 'draft_owned_by_another_user';
  end if;
  if d.project_id is not null then return; end if;

  update public.project_drafts
  set compliance_attested_by = p_user_id,
      compliance_attested_at = now(),
      acceptable_use_version = '2026-10-01',
      terms_version = '2026-09-18',
      compliance_attestation_type = 'project_publication',
      benefits_third_party_or_cause = p_benefits_third_party_or_cause
  where id = d.id;
end;
$$;

revoke all on function public.record_draft_compliance_attestation(uuid, text, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.record_draft_compliance_attestation(uuid, text, uuid, boolean)
  to service_role;

create or replace function public.publish_project_draft(
  p_draft_id uuid,
  p_secret_hash text,
  p_user_id uuid
)
returns table(project_id uuid, project_slug text)
language plpgsql
security definer
set search_path = public
as $function$
declare
  d public.project_drafts%rowtype;
  p jsonb;
  v_slug text;
  v_project_id uuid;
  v_goal integer;
  v_price integer;
  v_quantity integer;
  v_deadline timestamptz;
  v_category text;
  v_intended_status public.project_status;
  v_status public.project_status;
  v_planned_launch_at timestamptz;
begin
  select * into d from public.project_drafts
  where id = p_draft_id and secret_hash = p_secret_hash for update;

  if not found then raise exception 'draft_not_found'; end if;
  if d.owner_id is null then
    update public.project_drafts set owner_id = p_user_id, claimed_at = now() where id = d.id;
    d.owner_id := p_user_id;
  end if;
  if d.owner_id <> p_user_id then raise exception 'draft_owned_by_another_user'; end if;
  if d.project_id is not null then
    return query select d.project_id, project.slug from public.projects project where project.id = d.project_id;
    return;
  end if;

  if d.compliance_attested_by is distinct from p_user_id
     or d.compliance_attested_at is null
     or d.acceptable_use_version is distinct from '2026-10-01'
     or d.terms_version is distinct from '2026-09-18'
     or d.compliance_attestation_type is distinct from 'project_publication'
     or d.benefits_third_party_or_cause is null then
    raise exception 'compliance_attestation_required';
  end if;

  p := d.payload;
  if char_length(trim(coalesce(p->>'name', ''))) < 3
     or char_length(trim(coalesce(p->>'summary', ''))) < 3
     or coalesce(p->>'goal', '') = ''
     or coalesce(p->>'deadline', '') = ''
     or char_length(trim(coalesce(p->>'rewardName', ''))) < 2
     or coalesce(p->>'rewardPrice', '') = ''
     or coalesce(p->>'coverPath', '') = '' then
    raise exception 'incomplete_draft';
  end if;

  v_goal := round((p->>'goal')::numeric * 100);
  v_price := round((p->>'rewardPrice')::numeric * 100);
  v_quantity := greatest(1, floor(coalesce(nullif(p->>'rewardQuantity', '')::numeric, 1))::integer);
  v_deadline := (p->>'deadline')::timestamptz;
  v_category := coalesce(nullif(p->>'category', ''), 'Other');
  v_intended_status := case when p->>'launchMode' = 'prelaunch' then 'prelaunch' else 'live' end;
  v_status := case
    when d.benefits_third_party_or_cause then 'pending_review'::public.project_status
    else v_intended_status
  end;
  v_planned_launch_at := case
    when v_intended_status = 'prelaunch' and nullif(p->>'plannedLaunchAt', '') is not null
      then (p->>'plannedLaunchAt')::timestamptz
    else null
  end;

  if v_goal < 100 or v_price < 100 or v_deadline <= now()
     or (v_planned_launch_at is not null and v_planned_launch_at <= now())
     or v_category not in ('Technology', 'Design', 'Fashion', 'Games', 'Publishing', 'Food', 'Other')
     or coalesce(p->>'coverPath', '') !~ ('^drafts/' || d.id::text || '/')
     or not public.is_valid_project_gallery(coalesce(p->'galleryMedia', '[]'::jsonb)) then
    raise exception 'invalid_project_values';
  end if;
  if coalesce(p->>'externalWebsite', '') <> '' and p->>'externalWebsite' !~ '^https://[^[:space:]]+$' then
    raise exception 'invalid_external_website';
  end if;

  v_slug := trim(both '-' from left(regexp_replace(lower(p->>'name'), '[^a-z0-9]+', '-', 'g'), 56))
    || '-' || left(d.id::text, 8);

  insert into public.projects (
    creator_id, slug, name, summary, description, image_url, gallery_media,
    category, external_website, location, project_dates, funding_goal_amount,
    currency, status, launch_at, planned_launch_at, deadline_at,
    compliance_review_status, compliance_intended_status,
    compliance_benefits_third_party_or_cause
  ) values (
    p_user_id, v_slug, left(trim(p->>'name'), 160), left(trim(p->>'summary'), 500),
    left(coalesce(p->>'story', ''), 10000), null, '[]'::jsonb, v_category,
    nullif(left(coalesce(p->>'externalWebsite', ''), 500), ''),
    nullif(left(coalesce(p->>'location', ''), 160), ''),
    nullif(left(coalesce(p->>'projectDates', ''), 160), ''),
    v_goal, 'usd', v_status, case when v_status = 'live' then now() else null end,
    v_planned_launch_at, v_deadline,
    case when d.benefits_third_party_or_cause then 'pending' else 'not_required' end,
    case when d.benefits_third_party_or_cause then v_intended_status::text else null end,
    d.benefits_third_party_or_cause
  ) returning id into v_project_id;

  insert into public.project_compliance_attestations (
    project_id, user_id, accepted_at, acceptable_use_version, terms_version,
    attestation_type, benefits_third_party_or_cause
  ) values (
    v_project_id, p_user_id, d.compliance_attested_at, d.acceptable_use_version,
    d.terms_version, d.compliance_attestation_type, d.benefits_third_party_or_cause
  );

  insert into public.rewards (project_id, title, description, amount, total_quantity)
  values (
    v_project_id, left(trim(p->>'rewardName'), 160),
    left(coalesce(p->>'rewardDescription', ''), 2000), v_price, v_quantity
  );

  update public.project_drafts set project_id = v_project_id where id = d.id;
  if v_status = 'live' then
    perform public.queue_project_launch_event(v_project_id, p_user_id);
  end if;
  return query select v_project_id, v_slug;
end;
$function$;

revoke all on function public.publish_project_draft(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.publish_project_draft(uuid, text, uuid) to service_role;

create or replace function public.record_existing_project_compliance(
  p_project_slug text,
  p_user_id uuid,
  p_benefits_third_party_or_cause boolean
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project public.projects%rowtype;
begin
  select * into target_project
  from public.projects
  where slug = p_project_slug and creator_id = p_user_id
  for update;
  if not found then raise exception 'project_launch_denied'; end if;
  if target_project.status <> 'prelaunch' then raise exception 'project_not_prelaunch'; end if;

  insert into public.project_compliance_attestations (
    project_id, user_id, acceptable_use_version, terms_version,
    attestation_type, benefits_third_party_or_cause
  ) values (
    target_project.id, p_user_id, '2026-10-01', '2026-09-18',
    'project_publication', p_benefits_third_party_or_cause
  )
  on conflict (project_id, acceptable_use_version, attestation_type)
  do update set
    user_id = excluded.user_id,
    accepted_at = now(),
    terms_version = excluded.terms_version,
    benefits_third_party_or_cause = excluded.benefits_third_party_or_cause;

  update public.projects
  set compliance_benefits_third_party_or_cause = p_benefits_third_party_or_cause,
      compliance_review_status = case when p_benefits_third_party_or_cause then 'pending' else 'not_required' end,
      compliance_intended_status = case when p_benefits_third_party_or_cause then 'live' else null end,
      status = case when p_benefits_third_party_or_cause then 'pending_review'::public.project_status else status end,
      updated_at = now()
  where id = target_project.id;

  return case when p_benefits_third_party_or_cause then 'pending_review' else 'prelaunch' end;
end;
$$;

revoke all on function public.record_existing_project_compliance(text, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.record_existing_project_compliance(text, uuid, boolean)
  to service_role;

create or replace function public.launch_prelaunch_project(p_project_slug text)
returns table (project_id uuid, project_slug text, launched boolean, launch_event_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_project public.projects%rowtype;
  event_id uuid;
begin
  if actor_id is null then raise exception 'authentication_required'; end if;

  select project.* into target_project
  from public.projects project
  where project.slug = p_project_slug and project.creator_id = actor_id
  for update;

  if not found
     or target_project.admin_archived_at is not null
     or target_project.admin_suspended_at is not null
     or target_project.creator_archived_at is not null then
    raise exception 'project_launch_denied';
  end if;

  if target_project.status = 'prelaunch' then
    if not exists (
      select 1 from public.project_compliance_attestations attestation
      where attestation.project_id = target_project.id
        and attestation.user_id = actor_id
        and attestation.acceptable_use_version = '2026-10-01'
        and attestation.attestation_type = 'project_publication'
        and (
          not attestation.benefits_third_party_or_cause
          or target_project.compliance_review_status = 'approved'
        )
    ) then
      raise exception 'compliance_attestation_required';
    end if;
    update public.projects
    set status = 'live', launch_at = now(), updated_at = now()
    where id = target_project.id;
    event_id := public.queue_project_launch_event(target_project.id, actor_id);
    return query select target_project.id, target_project.slug, true, event_id;
    return;
  end if;

  if target_project.status = 'live' then
    select event.id into event_id from public.project_launch_events event
    where event.project_id = target_project.id;
    return query select target_project.id, target_project.slug, false, event_id;
    return;
  end if;

  raise exception 'project_not_prelaunch';
end;
$$;

revoke all on function public.launch_prelaunch_project(text) from public, anon, authenticated;
grant execute on function public.launch_prelaunch_project(text) to authenticated;

create or replace function public.review_project_compliance(
  p_project_id uuid,
  p_admin_id uuid,
  p_outcome text
)
returns table(project_id uuid, project_slug text, project_status text, launch_event_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project public.projects%rowtype;
  event_id uuid;
  next_status public.project_status;
begin
  if p_outcome not in ('approved', 'rejected') then raise exception 'invalid_review_outcome'; end if;
  select * into target_project from public.projects where id = p_project_id for update;
  if not found then raise exception 'project_not_found'; end if;
  if target_project.status <> 'pending_review' or target_project.compliance_review_status <> 'pending' then
    raise exception 'project_not_pending_review';
  end if;

  if p_outcome = 'approved' then
    next_status := coalesce(target_project.compliance_intended_status, 'live')::public.project_status;
    update public.projects
    set status = next_status,
        compliance_review_status = 'approved',
        compliance_reviewed_by = p_admin_id,
        compliance_reviewed_at = now(),
        compliance_review_outcome = 'approved',
        launch_at = case when next_status = 'live' then now() else launch_at end,
        updated_at = now()
    where id = target_project.id;
    if next_status = 'live' then
      event_id := public.queue_project_launch_event(target_project.id, target_project.creator_id);
    end if;
  else
    update public.projects
    set compliance_review_status = 'rejected',
        compliance_reviewed_by = p_admin_id,
        compliance_reviewed_at = now(),
        compliance_review_outcome = 'rejected',
        admin_suspended_at = coalesce(admin_suspended_at, now()),
        updated_at = now()
    where id = target_project.id;
    next_status := 'pending_review';
  end if;

  return query select target_project.id, target_project.slug, next_status::text, event_id;
end;
$$;

revoke all on function public.review_project_compliance(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.review_project_compliance(uuid, uuid, text) to service_role;

-- Flag the known existing charity-benefit project for an admin decision without
-- changing its status, content, payments, or public visibility.
insert into public.project_compliance_flags (project_id, reason)
select project.id, 'Existing live project mentions that 50% of profits may benefit a charity; classify before any enforcement.'
from public.projects project
where project.status = 'live'
  and (
    lower(coalesce(project.description, '')) like '%50% of profits%'
    or lower(coalesce(project.summary, '')) like '%50% of profits%'
  )
on conflict (project_id) do nothing;
