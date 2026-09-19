-- The profile row is the sole editable source of Backed identity. Provider data
-- may only initialize a missing row; it never overwrites these fields on login.
alter table public.profiles
  add column if not exists website text;

update public.profiles
set username = lower(username)
where username is not null and username <> lower(username);

alter table public.profiles
  drop constraint if exists profiles_username_format,
  add constraint profiles_username_format
    check (username is null or username ~ '^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$'),
  drop constraint if exists profiles_username_reserved,
  add constraint profiles_username_reserved
    check (username is null or username not in (
      'about', 'admin', 'api', 'auth', 'contact', 'dashboard', 'discover', 'faq',
      'privacy', 'projects', 'settings', 'start', 'terms'
    )),
  drop constraint if exists profiles_website_format,
  add constraint profiles_website_format
    check (website is null or website ~ '^https?://[^[:space:]]+$');

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username)) where username is not null;

grant update (website) on public.profiles to authenticated;
