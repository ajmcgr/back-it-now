create table public.project_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  moderation_status text not null default 'visible'
    check (moderation_status in (
      'visible',
      'deleted_by_author',
      'removed_by_creator',
      'removed_by_admin'
    )),
  deleted_at timestamptz,
  unique (author_id, idempotency_key)
);

create index project_comments_public_order_idx
  on public.project_comments (project_id, created_at, id)
  where moderation_status = 'visible' and deleted_at is null;
create index project_comments_author_rate_idx
  on public.project_comments (author_id, created_at desc);

alter table public.project_comments enable row level security;
revoke all on public.project_comments from public, anon, authenticated;

create table private.project_comment_moderation_audit (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.project_comments(id),
  project_id uuid not null references public.projects(id),
  comment_author_id uuid not null references auth.users(id),
  moderator_id uuid not null references auth.users(id),
  action text not null
    check (action in ('author_deleted', 'creator_removed', 'admin_removed')),
  original_body text not null,
  created_at timestamptz not null default now()
);

create index project_comment_moderation_audit_comment_idx
  on private.project_comment_moderation_audit (comment_id, created_at desc);
create index project_comment_moderation_audit_project_idx
  on private.project_comment_moderation_audit (project_id, created_at desc);
create index project_comment_moderation_audit_author_idx
  on private.project_comment_moderation_audit (comment_author_id);
create index project_comment_moderation_audit_moderator_idx
  on private.project_comment_moderation_audit (moderator_id);
revoke all on private.project_comment_moderation_audit from public, anon, authenticated;

create or replace function public.list_project_comments(p_project_slug text)
returns table (
  id uuid,
  body text,
  created_at timestamptz,
  updated_at timestamptz,
  display_name text,
  username text,
  avatar_url text,
  is_creator boolean,
  is_own boolean,
  can_moderate boolean
)
language sql
stable
security definer
set search_path = public, private
as $$
  with actor as (
    select
      (select auth.uid()) as user_id,
      exists (
        select 1
        from private.backed_admins admin
        where admin.user_id = (select auth.uid())
      ) as is_admin
  )
  select
    comment.id,
    comment.body,
    comment.created_at,
    comment.updated_at,
    profile.display_name,
    profile.username,
    profile.avatar_url,
    comment.author_id = project.creator_id as is_creator,
    comment.author_id = actor.user_id as is_own,
    (actor.is_admin or project.creator_id = actor.user_id) as can_moderate
  from public.project_comments comment
  join public.projects project on project.id = comment.project_id
  join public.profiles profile on profile.id = comment.author_id
  cross join actor
  where project.slug = p_project_slug
    and project.status in ('live', 'funded', 'unsuccessful', 'completed')
    and project.admin_archived_at is null
    and project.admin_suspended_at is null
    and project.creator_archived_at is null
    and profile.deleted_at is null
    and comment.moderation_status = 'visible'
    and comment.deleted_at is null
  order by comment.created_at, comment.id;
$$;

create or replace function public.create_project_comment(
  p_project_slug text,
  p_body text,
  p_idempotency_key uuid
)
returns table (
  id uuid,
  body text,
  created_at timestamptz,
  updated_at timestamptz,
  created boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  normalized_body text := btrim(coalesce(p_body, ''));
  target_project public.projects%rowtype;
  existing_comment public.project_comments%rowtype;
  new_comment public.project_comments%rowtype;
begin
  if actor_id is null then
    raise exception 'authentication_required';
  end if;
  if char_length(normalized_body) not between 1 and 2000 then
    raise exception 'invalid_comment_body';
  end if;
  if p_idempotency_key is null then
    raise exception 'idempotency_key_required';
  end if;
  if not exists (
    select 1 from public.profiles profile
    where profile.id = actor_id and profile.deleted_at is null
  ) then
    raise exception 'profile_required';
  end if;

  select project.*
  into target_project
  from public.projects project
  where project.slug = p_project_slug
    and project.status in ('live', 'funded', 'unsuccessful', 'completed')
    and project.admin_archived_at is null
    and project.admin_suspended_at is null
    and project.creator_archived_at is null;

  if not found then
    raise exception 'project_comments_unavailable';
  end if;

  select comment.*
  into existing_comment
  from public.project_comments comment
  where comment.author_id = actor_id
    and comment.idempotency_key = p_idempotency_key;

  if found then
    return query
    select
      existing_comment.id,
      existing_comment.body,
      existing_comment.created_at,
      existing_comment.updated_at,
      false;
    return;
  end if;

  if (
    select count(*)
    from public.project_comments recent
    where recent.author_id = actor_id
      and recent.created_at >= now() - interval '1 minute'
  ) >= 5 then
    raise exception 'comment_rate_limited';
  end if;

  insert into public.project_comments (
    project_id,
    author_id,
    body,
    idempotency_key
  ) values (
    target_project.id,
    actor_id,
    normalized_body,
    p_idempotency_key
  )
  returning * into new_comment;

  insert into public.email_deliveries (
    dedupe_key,
    event_type,
    backing_id,
    recipient_email
  )
  select
    'project-comment:' || new_comment.id::text,
    'project_comment',
    null,
    creator.email
  from public.profiles creator
  where creator.id = target_project.creator_id
    and creator.id <> actor_id
    and creator.deleted_at is null
    and nullif(btrim(coalesce(creator.email, '')), '') is not null
  on conflict (dedupe_key) do nothing;

  return query
  select
    new_comment.id,
    new_comment.body,
    new_comment.created_at,
    new_comment.updated_at,
    true;
end;
$$;

create or replace function public.update_project_comment(
  p_project_slug text,
  p_comment_id uuid,
  p_body text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  normalized_body text := btrim(coalesce(p_body, ''));
begin
  if actor_id is null then
    raise exception 'authentication_required';
  end if;
  if char_length(normalized_body) not between 1 and 2000 then
    raise exception 'invalid_comment_body';
  end if;

  update public.project_comments comment
  set body = normalized_body,
      updated_at = now()
  from public.projects project
  where comment.id = p_comment_id
    and comment.project_id = project.id
    and project.slug = p_project_slug
    and comment.author_id = actor_id
    and comment.moderation_status = 'visible'
    and comment.deleted_at is null;

  if not found then
    raise exception 'comment_access_denied';
  end if;
  return true;
end;
$$;

create or replace function public.delete_project_comment(
  p_project_slug text,
  p_comment_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
declare
  actor_id uuid := auth.uid();
  target_comment public.project_comments%rowtype;
begin
  if actor_id is null then
    raise exception 'authentication_required';
  end if;

  select comment.*
  into target_comment
  from public.project_comments comment
  join public.projects project on project.id = comment.project_id
  where comment.id = p_comment_id
    and project.slug = p_project_slug
    and comment.author_id = actor_id;

  if not found then
    raise exception 'comment_access_denied';
  end if;
  if target_comment.moderation_status <> 'visible' or target_comment.deleted_at is not null then
    return true;
  end if;

  update public.project_comments
  set moderation_status = 'deleted_by_author',
      deleted_at = now(),
      updated_at = now()
  where id = target_comment.id;

  insert into private.project_comment_moderation_audit (
    comment_id,
    project_id,
    comment_author_id,
    moderator_id,
    action,
    original_body
  ) values (
    target_comment.id,
    target_comment.project_id,
    target_comment.author_id,
    actor_id,
    'author_deleted',
    target_comment.body
  );

  return true;
end;
$$;

create or replace function public.moderate_project_comment(
  p_project_slug text,
  p_comment_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
declare
  actor_id uuid := auth.uid();
  target_comment public.project_comments%rowtype;
  target_project public.projects%rowtype;
  actor_is_admin boolean := false;
  moderation_action text;
begin
  if actor_id is null then
    raise exception 'authentication_required';
  end if;

  select exists (
    select 1 from private.backed_admins admin where admin.user_id = actor_id
  ) into actor_is_admin;

  select project.*
  into target_project
  from public.projects project
  where project.slug = p_project_slug;

  if not found then
    raise exception 'comment_not_found';
  end if;

  select comment.*
  into target_comment
  from public.project_comments comment
  where comment.id = p_comment_id
    and comment.project_id = target_project.id;

  if not found then
    raise exception 'comment_not_found';
  end if;
  if not actor_is_admin and target_project.creator_id <> actor_id then
    raise exception 'comment_moderation_denied';
  end if;
  if not actor_is_admin and target_comment.author_id = actor_id then
    raise exception 'use_delete_own_comment';
  end if;
  if target_comment.moderation_status <> 'visible' or target_comment.deleted_at is not null then
    return true;
  end if;

  moderation_action := case
    when target_project.creator_id = actor_id then 'creator_removed'
    else 'admin_removed'
  end;

  update public.project_comments
  set moderation_status = case
        when target_project.creator_id = actor_id then 'removed_by_creator'
        else 'removed_by_admin'
      end,
      deleted_at = now(),
      updated_at = now()
  where id = target_comment.id;

  insert into private.project_comment_moderation_audit (
    comment_id,
    project_id,
    comment_author_id,
    moderator_id,
    action,
    original_body
  ) values (
    target_comment.id,
    target_comment.project_id,
    target_comment.author_id,
    actor_id,
    moderation_action,
    target_comment.body
  );

  if moderation_action = 'admin_removed' then
    insert into private.admin_audit_log (
      admin_user_id,
      action,
      project_id,
      metadata
    ) values (
      actor_id,
      'project_comment_removed',
      target_project.id,
      jsonb_build_object('comment_id', target_comment.id)
    );
  end if;

  return true;
end;
$$;

revoke all on function public.list_project_comments(text) from public;
revoke all on function public.create_project_comment(text, text, uuid) from public, anon;
revoke all on function public.update_project_comment(text, uuid, text) from public, anon;
revoke all on function public.delete_project_comment(text, uuid) from public, anon;
revoke all on function public.moderate_project_comment(text, uuid) from public, anon;

grant execute on function public.list_project_comments(text) to anon, authenticated;
grant execute on function public.create_project_comment(text, text, uuid) to authenticated;
grant execute on function public.update_project_comment(text, uuid, text) to authenticated;
grant execute on function public.delete_project_comment(text, uuid) to authenticated;
grant execute on function public.moderate_project_comment(text, uuid) to authenticated;

comment on table public.project_comments is
  'First-class project comments. Direct table access is closed; public reads and authenticated mutations use narrow RPCs.';
comment on table private.project_comment_moderation_audit is
  'Immutable audit evidence for author deletion and creator/admin comment moderation.';
