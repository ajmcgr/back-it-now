-- Server-only admin check for the narrowly scoped cancellation endpoint.
create or replace function public.is_backed_admin(p_actor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.backed_admins admin where admin.user_id = p_actor_id
  );
$$;

revoke all on function public.is_backed_admin(uuid) from public, anon, authenticated;
grant execute on function public.is_backed_admin(uuid) to service_role;
