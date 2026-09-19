create table if not exists public.project_share_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in (
    'share_opened', 'share_x', 'share_reddit', 'share_linkedin', 'share_whatsapp',
    'share_instagram', 'share_copy_link', 'share_poster_download'
  )),
  context text not null check (context in ('owner_launch', 'owner_general', 'backer', 'visitor', 'project_update')),
  created_at timestamptz not null default now()
);
create index if not exists project_share_events_project_created_idx
  on public.project_share_events (project_id, created_at desc);
revoke all on public.project_share_events from public, anon, authenticated;

create table if not exists public.project_share_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  milestone_key text not null,
  reached_at timestamptz not null default now(),
  unique (project_id, milestone_key)
);
revoke all on public.project_share_milestones from public, anon, authenticated;
