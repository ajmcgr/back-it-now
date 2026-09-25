alter table public.email_deliveries
  add column if not exists attempted_at timestamptz,
  add column if not exists attempt_count integer not null default 0;

create or replace function public.claim_email_delivery(p_dedupe_key text)
returns table(id uuid, recipient_email text, attempt_count integer)
language sql
security definer
set search_path = public
as $$
  with candidate as (
    select delivery.id
    from public.email_deliveries delivery
    where delivery.dedupe_key = p_dedupe_key
      and delivery.status in ('pending', 'failed')
      and (
        delivery.attempted_at is null
        or delivery.attempted_at < now() - interval '5 minutes'
      )
    for update skip locked
    limit 1
  )
  update public.email_deliveries delivery
  set
    status = 'pending',
    attempted_at = now(),
    attempt_count = delivery.attempt_count + 1,
    last_error = null
  from candidate
  where delivery.id = candidate.id
  returning delivery.id, delivery.recipient_email, delivery.attempt_count;
$$;

revoke all on function public.claim_email_delivery(text) from public, anon, authenticated;
grant execute on function public.claim_email_delivery(text) to service_role;
