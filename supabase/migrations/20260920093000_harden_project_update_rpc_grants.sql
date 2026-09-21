-- Supabase project defaults grant new routines directly to API roles. Mutation
-- RPCs require a user JWT and should not be exposed to the anonymous role.
revoke all on function public.create_project_update(text,text,text,text,uuid) from public, anon;
revoke all on function public.update_project_update(text,uuid,text,text,text) from public, anon;
revoke all on function public.delete_project_update(text,uuid) from public, anon;

grant execute on function public.create_project_update(text,text,text,text,uuid) to authenticated;
grant execute on function public.update_project_update(text,uuid,text,text,text) to authenticated;
grant execute on function public.delete_project_update(text,uuid) to authenticated;
