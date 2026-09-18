-- Payment state is written only by verified Stripe webhooks through server-side functions.
revoke insert, update, delete on public.backings from anon, authenticated;
revoke insert, update, delete on public.reward_reservations from anon, authenticated;
revoke all on public.webhook_events from anon, authenticated;
revoke all on public.email_deliveries from anon, authenticated;
revoke all on public.project_settlements from anon, authenticated;
revoke all on function public.finalize_stripe_checkout(text,text,integer,text,text) from public, anon, authenticated;
revoke all on function public.release_checkout_reservation(text) from public, anon, authenticated;
