-- Public creator pages only need a deliberately small subset of profile data.
-- The base profiles table remains RLS-protected for canonical/private account data.
revoke all on table public.profiles from anon;

create or replace view public.public_profiles as
select
  lower(username) as username,
  display_name,
  avatar_url,
  bio,
  website
from public.profiles
where username is not null
  and deleted_at is null;

comment on view public.public_profiles is
  'Deliberately limited, public-facing Backed profile fields. Do not add private profile columns.';

revoke all on public.public_profiles from public;
grant select on public.public_profiles to anon, authenticated;

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
  projects.deadline_at
from public.projects
join public.profiles on profiles.id = projects.creator_id
where profiles.username is not null
  and profiles.deleted_at is null
  and projects.status = 'live';

comment on view public.public_profile_projects is
  'Public live projects indexed by public creator username. Drafts and private account fields are excluded.';

revoke all on public.public_profile_projects from public;
grant select on public.public_profile_projects to anon, authenticated;

-- User avatars are public, but browser clients cannot write to this bucket.
-- The authenticated avatar-upload Edge Function derives the object path from the
-- verified session user and always overwrites a single stable object.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars are publicly readable" on storage.objects;
create policy "avatars are publicly readable"
on storage.objects
for select
to public
using (bucket_id = 'avatars');

-- Reserve every actual top-level application path and common static/API paths.
alter table public.profiles
  drop constraint if exists profiles_username_reserved,
  add constraint profiles_username_reserved
    check (username is null or username not in (
      'about', 'admin', 'api', 'assets', 'auth', 'contact', 'dashboard',
      'discover', 'faq', 'favicon', 'index', 'logo', 'privacy', 'projects',
      'robots', 'settings', 'sitemap', 'start', 'terms'
    ));
