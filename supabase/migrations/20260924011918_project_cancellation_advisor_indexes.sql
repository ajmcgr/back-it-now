-- Covers the actor foreign key used by cancellation audit queries.
create index project_cancellations_initiated_by_idx
  on public.project_cancellations(initiated_by);
