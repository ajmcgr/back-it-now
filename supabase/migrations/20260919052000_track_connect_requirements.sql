alter table public.profiles
  add column if not exists stripe_requirements_due text[] not null default '{}'::text[];
