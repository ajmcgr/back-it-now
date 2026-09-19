-- Extend the deliberately limited public project view with the creator fields
-- already public on a Backed profile. This maintains one canonical
-- projects.creator_id -> profiles relationship for all project surfaces.
create or replace view public.public_profile_projects as
select
  lower(profiles.username) as creator_username,
  projects.slug,
  projects.name,
  projects.summary,
  projects.description,
  projects.image_url,
  projects.currency,
  projects.funding_goal_amount,
  projects.initial_backed_amount,
  projects.successful_backed_amount,
  projects.successful_backer_count,
  projects.deadline_at,
  profiles.display_name as creator_display_name,
  profiles.avatar_url as creator_avatar_url
from public.projects
join public.profiles on profiles.id = projects.creator_id
where profiles.username is not null
  and profiles.deleted_at is null
  and projects.status = 'live';

revoke all on public.public_profile_projects from public;
grant select on public.public_profile_projects to anon, authenticated;
