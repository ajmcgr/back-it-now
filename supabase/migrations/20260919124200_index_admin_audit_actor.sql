create index if not exists admin_audit_log_admin_user_created_idx
  on private.admin_audit_log (admin_user_id, created_at desc);
