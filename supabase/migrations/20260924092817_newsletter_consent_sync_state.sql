-- Keep account newsletter consent separate from authentication and from the
-- unauthenticated public newsletter form. Only the server-side Beehiiv
-- integration may write delivery state.
alter table public.profiles
  add column if not exists newsletter_consent_at timestamptz,
  add column if not exists newsletter_opted_out_at timestamptz,
  add column if not exists newsletter_sync_status text not null default 'not_subscribed',
  add column if not exists newsletter_synced_at timestamptz,
  add column if not exists newsletter_last_attempt_at timestamptz,
  add column if not exists newsletter_last_error text;

alter table public.profiles
  drop constraint if exists profiles_newsletter_sync_status_valid,
  add constraint profiles_newsletter_sync_status_valid check (
    newsletter_sync_status in ('not_subscribed', 'pending', 'subscribed', 'failed', 'no_email')
  ),
  drop constraint if exists profiles_newsletter_last_error_length,
  add constraint profiles_newsletter_last_error_length check (
    newsletter_last_error is null or char_length(newsletter_last_error) <= 120
  );

comment on column public.profiles.newsletter_consent_at is
  'Most recent explicit account newsletter opt-in timestamp.';
comment on column public.profiles.newsletter_sync_status is
  'Server-maintained state for account-consented Beehiiv synchronization.';
comment on column public.profiles.newsletter_last_error is
  'Non-secret stable failure code; never provider credentials or response bodies.';

-- Account holders continue to edit ordinary profile/notification preferences,
-- while newsletter consent and synchronization state move together through the
-- authenticated server-side integration.
revoke update on public.profiles from authenticated;
grant update (
  display_name,
  username,
  bio,
  website,
  receive_project_updates,
  receive_favorite_project_updates,
  receive_project_launches,
  receive_creator_new_projects,
  receive_my_project_activity
) on public.profiles to authenticated;
