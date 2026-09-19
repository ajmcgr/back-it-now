-- Public profile views must honour the caller's RLS and privileges. The profile
-- page uses a sessionless Supabase client intentionally, so public rows are
-- available only to the anon role and only through the allowed column grants.
alter view public.public_profiles set (security_invoker = true);
alter view public.public_profile_projects set (security_invoker = true);

grant select (id, username, display_name, avatar_url, bio, website)
  on public.profiles to anon;

drop policy if exists "public creator profiles are readable" on public.profiles;
create policy "public creator profiles are readable"
on public.profiles
for select
to anon
using (username is not null and deleted_at is null);
