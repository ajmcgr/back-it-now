-- Enum additions must commit before they can be referenced by later DDL.
-- Keep this migration deliberately isolated from the Phase 1 schema changes.
alter type public.project_status add value if not exists 'prelaunch' before 'live';
