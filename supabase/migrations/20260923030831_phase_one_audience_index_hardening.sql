-- Cover Phase 1 audience foreign keys used for project-scoped cleanup and
-- actor/profile lifecycle operations.
create index if not exists notifications_project_id_idx
  on public.notifications (project_id)
  where project_id is not null;

create index if not exists notifications_actor_id_idx
  on public.notifications (actor_id)
  where actor_id is not null;

create index if not exists project_launch_events_actor_id_idx
  on public.project_launch_events (actor_id);
