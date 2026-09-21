create table public.project_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  body text not null check (char_length(btrim(body)) between 1 and 20000),
  image_path text,
  idempotency_key uuid not null,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (project_id, idempotency_key)
);

create index project_updates_project_published_idx
  on public.project_updates (project_id, published_at desc)
  where deleted_at is null;
create index project_updates_author_id_idx on public.project_updates (author_id);

alter table public.project_updates enable row level security;
revoke all on public.project_updates from public, anon, authenticated;
grant select on public.project_updates to authenticated;

create policy "owners read their project updates"
  on public.project_updates
  for select
  to authenticated
  using (author_id = (select auth.uid()));

create or replace function public.list_project_updates(
  p_project_slug text,
  p_update_id uuid default null
)
returns table (
  id uuid,
  title text,
  body text,
  image_path text,
  published_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.id,
    u.title,
    u.body,
    u.image_path,
    u.published_at,
    u.updated_at
  from public.project_updates u
  join public.projects p on p.id = u.project_id
  join public.profiles creator on creator.id = p.creator_id
  where p.slug = p_project_slug
    and (p_update_id is null or u.id = p_update_id)
    and u.deleted_at is null
    and p.status in ('live', 'funded', 'unsuccessful', 'completed')
    and p.admin_archived_at is null
    and p.admin_suspended_at is null
    and p.creator_archived_at is null
    and creator.deleted_at is null
  order by u.published_at desc;
$$;

revoke all on function public.list_project_updates(text, uuid) from public;
grant execute on function public.list_project_updates(text, uuid) to anon, authenticated;

create or replace function public.create_project_update(
  p_project_slug text,
  p_title text,
  p_body text,
  p_image_path text,
  p_idempotency_key uuid
)
returns table (
  id uuid,
  title text,
  body text,
  image_path text,
  published_at timestamptz,
  updated_at timestamptz,
  created boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  target_project public.projects%rowtype;
  existing_update public.project_updates%rowtype;
  new_update public.project_updates%rowtype;
  normalized_title text := btrim(coalesce(p_title, ''));
  normalized_body text := btrim(coalesce(p_body, ''));
  normalized_image_path text := nullif(btrim(coalesce(p_image_path, '')), '');
  expected_image_prefix text;
begin
  if actor_id is null then
    raise exception 'authentication_required';
  end if;
  if char_length(normalized_title) not between 1 and 160 then
    raise exception 'invalid_update_title';
  end if;
  if char_length(normalized_body) not between 1 and 20000 then
    raise exception 'invalid_update_body';
  end if;
  if p_idempotency_key is null then
    raise exception 'idempotency_key_required';
  end if;

  select p.*
  into target_project
  from public.projects p
  where p.slug = p_project_slug
  for update;

  if not found
     or target_project.creator_id <> actor_id
     or target_project.status not in ('live', 'funded', 'unsuccessful', 'completed')
     or target_project.admin_archived_at is not null
     or target_project.admin_suspended_at is not null
     or target_project.creator_archived_at is not null then
    raise exception 'project_access_denied';
  end if;

  expected_image_prefix := 'projects/' || target_project.id::text || '/updates/';
  if normalized_image_path is not null then
    if position(expected_image_prefix in normalized_image_path) <> 1
       or normalized_image_path !~ '\.(jpg|png|webp)$'
       or not exists (
         select 1
         from storage.objects object
         where object.bucket_id = 'project-media'
           and object.name = normalized_image_path
       ) then
      raise exception 'invalid_update_image';
    end if;
  end if;

  select u.*
  into existing_update
  from public.project_updates u
  where u.project_id = target_project.id
    and u.idempotency_key = p_idempotency_key;

  if found then
    return query
    select
      existing_update.id,
      existing_update.title,
      existing_update.body,
      existing_update.image_path,
      existing_update.published_at,
      existing_update.updated_at,
      false;
    return;
  end if;

  insert into public.project_updates (
    project_id,
    author_id,
    title,
    body,
    image_path,
    idempotency_key
  )
  values (
    target_project.id,
    actor_id,
    normalized_title,
    normalized_body,
    normalized_image_path,
    p_idempotency_key
  )
  returning * into new_update;

  insert into public.email_deliveries (
    dedupe_key,
    event_type,
    backing_id,
    recipient_email
  )
  select
    'project-update:' || new_update.id::text || ':' || recipients.backer_id::text,
    'project_update',
    recipients.backing_id,
    recipients.email
  from (
    select distinct on (b.backer_id)
      b.backer_id,
      b.id as backing_id,
      pr.email
    from public.backings b
    join public.profiles pr on pr.id = b.backer_id
    where b.project_id = target_project.id
      and b.status = 'paid'
      and b.backer_id is not null
      and coalesce(b.refund_amount, 0) < b.gross_amount
      and pr.receive_project_updates = true
      and pr.deleted_at is null
      and nullif(btrim(coalesce(pr.email, '')), '') is not null
    order by b.backer_id, b.paid_at, b.id
  ) recipients
  on conflict (dedupe_key) do nothing;

  return query
  select
    new_update.id,
    new_update.title,
    new_update.body,
    new_update.image_path,
    new_update.published_at,
    new_update.updated_at,
    true;
end;
$$;

create or replace function public.update_project_update(
  p_project_slug text,
  p_update_id uuid,
  p_title text,
  p_body text,
  p_image_path text
)
returns table (
  id uuid,
  title text,
  body text,
  image_path text,
  published_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  target_project public.projects%rowtype;
  edited_update public.project_updates%rowtype;
  normalized_title text := btrim(coalesce(p_title, ''));
  normalized_body text := btrim(coalesce(p_body, ''));
  normalized_image_path text := nullif(btrim(coalesce(p_image_path, '')), '');
  expected_image_prefix text;
begin
  if actor_id is null then
    raise exception 'authentication_required';
  end if;
  if char_length(normalized_title) not between 1 and 160 then
    raise exception 'invalid_update_title';
  end if;
  if char_length(normalized_body) not between 1 and 20000 then
    raise exception 'invalid_update_body';
  end if;

  select p.*
  into target_project
  from public.projects p
  where p.slug = p_project_slug;

  if not found
     or target_project.creator_id <> actor_id
     or target_project.status not in ('live', 'funded', 'unsuccessful', 'completed')
     or target_project.admin_archived_at is not null
     or target_project.admin_suspended_at is not null
     or target_project.creator_archived_at is not null then
    raise exception 'project_access_denied';
  end if;

  expected_image_prefix := 'projects/' || target_project.id::text || '/updates/';
  if normalized_image_path is not null then
    if position(expected_image_prefix in normalized_image_path) <> 1
       or normalized_image_path !~ '\.(jpg|png|webp)$'
       or not exists (
         select 1
         from storage.objects object
         where object.bucket_id = 'project-media'
           and object.name = normalized_image_path
       ) then
      raise exception 'invalid_update_image';
    end if;
  end if;

  update public.project_updates u
  set title = normalized_title,
      body = normalized_body,
      image_path = normalized_image_path,
      updated_at = now()
  where u.id = p_update_id
    and u.project_id = target_project.id
    and u.author_id = actor_id
    and u.deleted_at is null
  returning u.* into edited_update;

  if not found then
    raise exception 'update_not_found';
  end if;

  return query
  select
    edited_update.id,
    edited_update.title,
    edited_update.body,
    edited_update.image_path,
    edited_update.published_at,
    edited_update.updated_at;
end;
$$;

create or replace function public.delete_project_update(
  p_project_slug text,
  p_update_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  target_project public.projects%rowtype;
  target_update public.project_updates%rowtype;
begin
  if actor_id is null then
    raise exception 'authentication_required';
  end if;

  select p.*
  into target_project
  from public.projects p
  where p.slug = p_project_slug;

  if not found
     or target_project.creator_id <> actor_id
     or target_project.status not in ('live', 'funded', 'unsuccessful', 'completed')
     or target_project.admin_archived_at is not null
     or target_project.admin_suspended_at is not null
     or target_project.creator_archived_at is not null then
    raise exception 'project_access_denied';
  end if;

  select u.*
  into target_update
  from public.project_updates u
  where u.id = p_update_id
    and u.project_id = target_project.id
    and u.author_id = actor_id;

  if not found then
    raise exception 'update_not_found';
  end if;
  if target_update.deleted_at is not null then
    return true;
  end if;

  update public.project_updates u
  set deleted_at = now(),
      updated_at = now()
  where u.id = target_update.id
    and u.deleted_at is null;

  return true;
end;
$$;

revoke all on function public.create_project_update(text,text,text,text,uuid) from public, anon;
revoke all on function public.update_project_update(text,uuid,text,text,text) from public, anon;
revoke all on function public.delete_project_update(text,uuid) from public, anon;
grant execute on function public.create_project_update(text,text,text,text,uuid) to authenticated;
grant execute on function public.update_project_update(text,uuid,text,text,text) to authenticated;
grant execute on function public.delete_project_update(text,uuid) to authenticated;

comment on table public.project_updates is
  'Public creator-authored project updates. Mutations are owner-authorized through RPC functions.';
