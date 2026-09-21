-- Supabase grants new public-schema functions to API roles by default. These
-- two functions require an authenticated identity in addition to their
-- internal ownership checks; remove the default anonymous grant explicitly.
revoke all on function public.get_creator_project_backers(text) from public, anon;
grant execute on function public.get_creator_project_backers(text) to authenticated;

revoke all on function public.set_backing_privacy(uuid, boolean) from public, anon;
grant execute on function public.set_backing_privacy(uuid, boolean) to authenticated;
