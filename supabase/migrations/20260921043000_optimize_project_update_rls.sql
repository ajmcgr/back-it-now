create index if not exists project_updates_author_id_idx
  on public.project_updates (author_id);

drop policy if exists "owners read their project updates" on public.project_updates;
create policy "owners read their project updates"
  on public.project_updates
  for select
  to authenticated
  using (author_id = (select auth.uid()));
