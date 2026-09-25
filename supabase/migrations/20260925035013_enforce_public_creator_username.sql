create or replace function public.require_public_project_creator_username()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status in ('prelaunch', 'live', 'cancelling', 'cancelled')
     and new.admin_archived_at is null
     and new.admin_suspended_at is null
     and new.creator_archived_at is null
     and not exists (
       select 1
       from public.profiles profile
       where profile.id = new.creator_id
         and profile.username is not null
         and profile.deleted_at is null
     ) then
    raise exception using
      errcode = '23514',
      message = 'profile_username_required';
  end if;

  return new;
end;
$$;

revoke all on function public.require_public_project_creator_username()
  from public, anon, authenticated;

drop trigger if exists require_public_project_creator_username on public.projects;
create trigger require_public_project_creator_username
before insert or update of
  creator_id,
  status,
  admin_archived_at,
  admin_suspended_at,
  creator_archived_at
on public.projects
for each row execute function public.require_public_project_creator_username();

create or replace function public.preserve_public_creator_username()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.deleted_at is null
     and new.username is null
     and exists (
       select 1
       from public.projects project
       where project.creator_id = new.id
         and project.status in ('prelaunch', 'live', 'cancelling', 'cancelled')
         and project.admin_archived_at is null
         and project.admin_suspended_at is null
         and project.creator_archived_at is null
     ) then
    raise exception using
      errcode = '23514',
      message = 'public_project_username_required';
  end if;

  return new;
end;
$$;

revoke all on function public.preserve_public_creator_username()
  from public, anon, authenticated;

drop trigger if exists preserve_public_creator_username on public.profiles;
create trigger preserve_public_creator_username
before update of username, deleted_at
on public.profiles
for each row execute function public.preserve_public_creator_username();

comment on function public.require_public_project_creator_username() is
  'Prevents discoverable projects from being published without a canonical public creator username.';

comment on function public.preserve_public_creator_username() is
  'Prevents a public project creator from clearing the username required by public marketplace views.';
