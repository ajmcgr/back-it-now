-- Stripe is the source of truth for a completed paid Checkout Session. The
-- Edge Functions verify the live Session, PaymentIntent, charge, amount,
-- currency, metadata, project, and backer before invoking this service-role
-- function. A local intent timestamp must not make a legitimately paid Stripe
-- transaction impossible to finalize after a delayed webhook/redirect.
create or replace function public.finalize_stripe_checkout(
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_processing_fee_amount integer,
  p_backer_email text,
  p_stripe_charge_id text default null
) returns table(backing_id uuid, project_id uuid, email_delivery_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  intent public.checkout_backing_intents%rowtype;
  new_backing_id uuid;
  delivery_id uuid;
  existing_project_id uuid;
  platform_fee integer;
  creator_proceeds integer;
begin
  select backing.id, backing.project_id
  into new_backing_id, existing_project_id
  from public.backings backing
  where backing.stripe_checkout_session_id = p_checkout_session_id;

  if found then
    return query select new_backing_id, existing_project_id, null::uuid;
    return;
  end if;

  select *
  into intent
  from public.checkout_backing_intents checkout_intent
  where checkout_intent.checkout_session_id = p_checkout_session_id
  for update;

  if not found
     or intent.released_at is not null
     or intent.converted_at is not null
  then
    raise exception 'checkout_not_active';
  end if;

  platform_fee := ((intent.amount * 5 + 50) / 100)::integer;
  creator_proceeds := greatest(
    0,
    intent.amount - platform_fee - greatest(0, p_processing_fee_amount)
  );

  insert into public.backings (
    project_id,
    reward_id,
    backer_id,
    reservation_id,
    backer_email,
    gross_amount,
    platform_fee_amount,
    processing_fee_amount,
    creator_proceeds_amount,
    net_creator_proceeds_amount,
    currency,
    status,
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    stripe_charge_id,
    transfer_status,
    paid_at,
    is_private
  ) values (
    intent.project_id,
    intent.reward_id,
    intent.backer_id,
    intent.reservation_id,
    p_backer_email,
    intent.amount,
    platform_fee,
    greatest(0, p_processing_fee_amount),
    creator_proceeds,
    creator_proceeds,
    intent.currency,
    'paid',
    p_checkout_session_id,
    p_payment_intent_id,
    p_stripe_charge_id,
    'pending',
    now(),
    intent.is_private
  )
  returning id into new_backing_id;

  if intent.reservation_id is not null then
    update public.rewards
    set
      reserved_quantity = greatest(0, reserved_quantity - 1),
      claimed_quantity = claimed_quantity + 1
    where id = intent.reward_id;

    update public.reward_reservations
    set converted_at = now()
    where id = intent.reservation_id;
  end if;

  update public.checkout_backing_intents
  set converted_at = now()
  where checkout_session_id = p_checkout_session_id;

  update public.projects
  set
    successful_backed_amount = successful_backed_amount + intent.amount,
    successful_backer_count = successful_backer_count + 1
  where id = intent.project_id;

  insert into public.email_deliveries (
    dedupe_key,
    event_type,
    backing_id,
    recipient_email
  ) values (
    'backing-confirmation:' || new_backing_id::text,
    'backing_confirmation',
    new_backing_id,
    p_backer_email
  )
  on conflict (dedupe_key) do nothing
  returning id into delivery_id;

  return query select new_backing_id, intent.project_id, delivery_id;
end;
$$;

revoke all on function public.finalize_stripe_checkout(text, text, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.finalize_stripe_checkout(text, text, integer, text, text)
  to service_role;
