create index if not exists project_comment_moderation_audit_author_idx
  on private.project_comment_moderation_audit (comment_author_id);
create index if not exists project_comment_moderation_audit_moderator_idx
  on private.project_comment_moderation_audit (moderator_id);
