alter table public.projects
  drop constraint if exists projects_compliance_review_status_check,
  drop constraint if exists projects_compliance_review_outcome_check;

alter table public.projects
  add constraint projects_compliance_review_status_check
    check (compliance_review_status in ('not_required', 'pending', 'needs_information', 'approved', 'rejected')),
  add constraint projects_compliance_review_outcome_check
    check (compliance_review_outcome is null or compliance_review_outcome in ('needs_information', 'approved', 'rejected'));

create table if not exists public.project_compliance_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  reviewer_user_id uuid not null references auth.users(id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  review_outcome text not null check (review_outcome in ('approved', 'rejected', 'needs_information')),
  review_note text not null check (char_length(review_note) between 10 and 2000),
  evidence_urls text[] not null default '{}'::text[] check (cardinality(evidence_urls) <= 5),
  stripe_connect_ready boolean not null,
  acceptable_use_version text not null,
  attestation_id uuid not null references public.project_compliance_attestations(id) on delete restrict
);

create index if not exists project_compliance_reviews_project_reviewed_idx
  on public.project_compliance_reviews (project_id, reviewed_at desc);

alter table public.project_compliance_reviews enable row level security;
revoke all on public.project_compliance_reviews from public, anon, authenticated;

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
     or char_length(trim(coalesce(p->>'story', ''))) < 3
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
    when v_intended_status = 'live' then 'pending_review'::public.project_status
    else 'prelaunch'::public.project_status
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
    v_goal, 'usd', v_status, null,
    v_planned_launch_at, v_deadline,
    case when v_intended_status = 'live' then 'pending' else 'not_required' end,
    case when v_intended_status = 'live' then 'live' else null end,
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
      compliance_review_status = 'pending',
      compliance_intended_status = 'live',
      compliance_reviewed_by = null,
      compliance_reviewed_at = null,
      compliance_review_outcome = null,
      status = 'pending_review'::public.project_status,
      updated_at = now()
  where id = target_project.id;

  return 'pending_review';
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
  if not found then raise exception 'project_launch_denied'; end if;
  if target_project.status = 'live' and target_project.compliance_review_status = 'approved' then
    select event.id into event_id from public.project_launch_events event
    where event.project_id = target_project.id;
    return query select target_project.id, target_project.slug, false, event_id;
    return;
  end if;
  raise exception 'project_review_required';
end;
$$;

revoke all on function public.launch_prelaunch_project(text) from public, anon, authenticated;
grant execute on function public.launch_prelaunch_project(text) to authenticated;

drop function if exists public.review_project_compliance(uuid, uuid, text);

create function public.review_project_compliance(
  p_project_id uuid,
  p_admin_id uuid,
  p_outcome text,
  p_review_note text,
  p_evidence_urls text[]
)
returns table(project_id uuid, project_slug text, project_status text, launch_event_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project public.projects%rowtype;
  target_attestation public.project_compliance_attestations%rowtype;
  target_reward public.rewards%rowtype;
  event_id uuid;
  next_status public.project_status := 'pending_review';
  connect_ready boolean;
  normalized_note text := trim(coalesce(p_review_note, ''));
begin
  if p_outcome not in ('approved', 'rejected', 'needs_information') then
    raise exception 'invalid_review_outcome';
  end if;
  if char_length(normalized_note) < 10 or char_length(normalized_note) > 2000 then
    raise exception 'invalid_review_note';
  end if;
  if cardinality(coalesce(p_evidence_urls, '{}'::text[])) > 5 then
    raise exception 'invalid_review_evidence';
  end if;

  select * into target_project from public.projects where id = p_project_id for update;
  if not found then raise exception 'project_not_found'; end if;
  if target_project.status <> 'pending_review'
     or target_project.compliance_review_status not in ('pending', 'needs_information') then
    raise exception 'project_not_pending_review';
  end if;

  select exists (
    select 1 from public.profiles profile
    where profile.id = target_project.creator_id
      and profile.stripe_account_id is not null
      and profile.stripe_onboarding_complete
      and profile.stripe_charges_enabled
      and profile.stripe_payouts_enabled
  ) into connect_ready;

  select * into target_attestation
  from public.project_compliance_attestations
  where project_id = target_project.id
    and user_id = target_project.creator_id
    and attestation_type = 'project_publication'
  order by accepted_at desc
  limit 1;
  if not found then raise exception 'compliance_attestation_required'; end if;

  select * into target_reward
  from public.rewards
  where project_id = target_project.id
  order by created_at
  limit 1;

  if p_outcome = 'approved' then
    if not connect_ready then raise exception 'creator_connect_not_ready'; end if;
    if char_length(trim(coalesce(target_project.name, ''))) < 3
       or char_length(trim(coalesce(target_project.summary, ''))) < 3
       or char_length(trim(coalesce(target_project.description, ''))) < 3
       or target_project.image_url is null
       or target_project.funding_goal_amount < 100
       or target_project.deadline_at is null
       or target_project.deadline_at <= now()
       or target_reward.id is null
       or char_length(trim(coalesce(target_reward.title, ''))) < 2
       or target_reward.amount < 100 then
      raise exception 'project_information_incomplete';
    end if;
  end if;

  insert into public.project_compliance_reviews (
    project_id, reviewer_user_id, review_outcome, review_note, evidence_urls,
    stripe_connect_ready, acceptable_use_version, attestation_id
  ) values (
    target_project.id, p_admin_id, p_outcome, normalized_note,
    coalesce(p_evidence_urls, '{}'::text[]), connect_ready,
    target_attestation.acceptable_use_version, target_attestation.id
  );

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
  elsif p_outcome = 'needs_information' then
    update public.projects
    set compliance_review_status = 'needs_information',
        compliance_reviewed_by = p_admin_id,
        compliance_reviewed_at = now(),
        compliance_review_outcome = 'needs_information',
        updated_at = now()
    where id = target_project.id;
  else
    update public.projects
    set compliance_review_status = 'rejected',
        compliance_reviewed_by = p_admin_id,
        compliance_reviewed_at = now(),
        compliance_review_outcome = 'rejected',
        admin_suspended_at = coalesce(admin_suspended_at, now()),
        updated_at = now()
    where id = target_project.id;
  end if;

  return query select target_project.id, target_project.slug, next_status::text, event_id;
end;
$$;

revoke all on function public.review_project_compliance(uuid, uuid, text, text, text[])
  from public, anon, authenticated;
grant execute on function public.review_project_compliance(uuid, uuid, text, text, text[])
  to service_role;
