-- Separate charges and transfers require one auditable transfer per source charge.
alter table public.backings
  add column if not exists stripe_transfer_id text,
  add column if not exists transferred_at timestamptz,
  add column if not exists transfer_failure_reason text;

create unique index if not exists backings_stripe_transfer_id_key
  on public.backings (stripe_transfer_id) where stripe_transfer_id is not null;

create or replace function public.begin_campaign_settlement(p_project_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare p public.projects%rowtype;
begin
  select * into p from public.projects where id = p_project_id for update;
  if not found or p.deadline_at is null or p.deadline_at > now() or p.status <> 'live' then return false; end if;
  insert into public.project_settlements(project_id, status)
    values (p_project_id, 'pending') on conflict (project_id) do nothing;
  return found;
end;
$$;
revoke all on function public.begin_campaign_settlement(uuid) from public, anon, authenticated;
