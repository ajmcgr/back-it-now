create schema if not exists private;
revoke all on schema private from public;

create table if not exists private.backed_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Bootstrap the initial administrator once, then rely exclusively on the immutable Auth user ID.
insert into private.backed_admins (user_id)
select id from auth.users where lower(email) = 'alex@alexmacgregor.com'
on conflict (user_id) do nothing;

create table if not exists private.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  project_id uuid references public.projects(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_project_created_idx
  on private.admin_audit_log (project_id, created_at desc);
revoke all on private.backed_admins from public, anon, authenticated;
revoke all on private.admin_audit_log from public, anon, authenticated;

alter table public.projects
  add column if not exists admin_archived_at timestamptz,
  add column if not exists admin_suspended_at timestamptz;
create index if not exists projects_admin_visibility_idx
  on public.projects (admin_archived_at, admin_suspended_at);

create or replace view public.public_profile_projects as
select
  lower(profiles.username) as creator_username,
  projects.slug,
  projects.name,
  projects.summary,
  projects.description,
  projects.image_url,
  projects.currency,
  projects.funding_goal_amount,
  projects.initial_backed_amount,
  projects.successful_backed_amount,
  projects.successful_backer_count,
  projects.deadline_at,
  profiles.display_name as creator_display_name,
  profiles.avatar_url as creator_avatar_url
from public.projects
join public.profiles on profiles.id = projects.creator_id
where profiles.username is not null
  and profiles.deleted_at is null
  and projects.status = 'live'
  and projects.admin_archived_at is null
  and projects.admin_suspended_at is null;

revoke all on public.public_profile_projects from public;
grant select on public.public_profile_projects to anon, authenticated;
