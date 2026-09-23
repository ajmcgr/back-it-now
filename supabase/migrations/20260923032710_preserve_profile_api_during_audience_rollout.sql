-- Keep the previously deployed frontend readable while the Phase 1 frontend
-- rolls out. Public favorites remain disabled: the compatibility column is
-- always false and the legacy listing RPC always returns an empty set.
create or replace view public.public_profiles as
select
  lower(profile.username) as username,
  profile.display_name,
  profile.avatar_url,
  profile.bio,
  profile.website,
  coalesce(follow_metrics.follower_count, 0) as follower_count,
  false::boolean as show_public_favorites
from public.profiles profile
left join (
  select followed_user_id, count(*)::integer as follower_count
  from public.creator_follows
  group by followed_user_id
) follow_metrics on follow_metrics.followed_user_id = profile.id
where profile.username is not null
  and profile.deleted_at is null;

revoke all on public.public_profiles from public;
grant select on public.public_profiles to anon, authenticated;

create or replace function public.list_public_profile_favorites(p_username text)
returns setof public.public_profile_projects
language sql
stable
security invoker
set search_path = ''
as $$
  select presentation.*
  from public.public_profile_projects presentation
  where false;
$$;

revoke all on function public.list_public_profile_favorites(text) from public, anon, authenticated;
grant execute on function public.list_public_profile_favorites(text) to anon, authenticated;
