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

revoke all on function public.moderate_project_comment(text, uuid) from public, anon;
grant execute on function public.moderate_project_comment(text, uuid) to authenticated;
