-- Keep the profile table inaccessible to anon. These views expose an explicit,
-- reviewed field list only; their owner can evaluate the canonical profile
-- predicates without granting any private profile column to public callers.
alter view public.public_profiles reset (security_invoker);
alter view public.public_profile_projects reset (security_invoker);

drop policy if exists "public creator profiles are readable" on public.profiles;
revoke select (id, username, display_name, avatar_url, bio, website, deleted_at)
  on public.profiles from anon;
