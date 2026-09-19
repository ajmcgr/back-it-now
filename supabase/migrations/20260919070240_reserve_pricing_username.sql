-- Keep the public profile namespace from claiming the new application route.
alter table public.profiles
  drop constraint if exists profiles_username_reserved,
  add constraint profiles_username_reserved
    check (username is null or username not in (
      'about', 'admin', 'api', 'assets', 'auth', 'contact', 'dashboard',
      'discover', 'faq', 'favicon', 'index', 'logo', 'pricing', 'privacy', 'projects',
      'robots', 'settings', 'sitemap', 'start', 'terms'
    ));
