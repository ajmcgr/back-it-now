alter table public.profiles
  add column if not exists bio text,
  add column if not exists receive_project_updates boolean not null default true,
  add column if not exists receive_product_news boolean not null default false,
  add column if not exists deleted_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_bio_length;

alter table public.profiles
  add constraint profiles_bio_length check (bio is null or char_length(bio) <= 500);

-- The existing row policy restricts updates to auth.uid() = id. Limit writable
-- columns as well, so a user cannot change Stripe or provider identity fields.
revoke update on public.profiles from authenticated;
grant update (
  display_name,
  username,
  avatar_url,
  bio,
  receive_project_updates,
  receive_product_news
) on public.profiles to authenticated;
