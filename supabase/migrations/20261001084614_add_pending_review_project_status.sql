-- Keep the enum addition isolated so PostgreSQL commits it before later DDL
-- references the new value.
alter type public.project_status add value if not exists 'pending_review' before 'prelaunch';
