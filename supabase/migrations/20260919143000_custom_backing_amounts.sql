alter table public.backings alter column reward_id drop not null;

create table if not exists public.checkout_backing_intents (
  checkout_session_id text primary key,
  project_id uuid not null references public.projects(id) on delete restrict,
  reward_id uuid references public.rewards(id) on delete restrict,
  reservation_id uuid references public.reward_reservations(id) on delete restrict,
  backer_id uuid references auth.users(id) on delete set null,
  amount integer not null check (amount >= 500),
  currency text not null,
  expires_at timestamptz not null,
  released_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz not null default now()
);
revoke all on public.checkout_backing_intents from public, anon, authenticated;

create or replace function public.finalize_stripe_checkout(
  p_checkout_session_id text, p_payment_intent_id text, p_processing_fee_amount integer,
  p_backer_email text, p_stripe_charge_id text default null
) returns table(backing_id uuid, project_id uuid, email_delivery_id uuid)
language plpgsql security definer set search_path = public as $$
declare i public.checkout_backing_intents%rowtype; b_id uuid; e_id uuid; p_id uuid; fee integer; proceeds integer;
begin
  select id, project_id into b_id, p_id from public.backings where stripe_checkout_session_id = p_checkout_session_id;
  if found then return query select b_id, p_id, null::uuid; return; end if;
  select * into i from public.checkout_backing_intents where checkout_session_id=p_checkout_session_id for update;
  if not found or i.released_at is not null or i.converted_at is not null or i.expires_at <= now() then raise exception 'checkout_not_active'; end if;
  fee := ((i.amount * 5 + 50) / 100)::integer;
  proceeds := greatest(0, i.amount - fee - greatest(0, p_processing_fee_amount));
  insert into public.backings(project_id,reward_id,backer_id,reservation_id,backer_email,gross_amount,platform_fee_amount,processing_fee_amount,creator_proceeds_amount,net_creator_proceeds_amount,currency,status,stripe_checkout_session_id,stripe_payment_intent_id,stripe_charge_id,transfer_status,paid_at)
  values(i.project_id,i.reward_id,i.backer_id,i.reservation_id,p_backer_email,i.amount,fee,greatest(0,p_processing_fee_amount),proceeds,proceeds,i.currency,'paid',p_checkout_session_id,p_payment_intent_id,p_stripe_charge_id,'pending',now()) returning id into b_id;
  if i.reservation_id is not null then
    update public.rewards set reserved_quantity=greatest(0,reserved_quantity-1), claimed_quantity=claimed_quantity+1 where id=i.reward_id;
    update public.reward_reservations set converted_at=now() where id=i.reservation_id;
  end if;
  update public.checkout_backing_intents set converted_at=now() where checkout_session_id=p_checkout_session_id;
  update public.projects set successful_backed_amount=successful_backed_amount+i.amount, successful_backer_count=successful_backer_count+1 where id=i.project_id;
  insert into public.email_deliveries(dedupe_key,event_type,backing_id,recipient_email) values('backing-confirmation:'||b_id::text,'backing_confirmation',b_id,p_backer_email) on conflict(dedupe_key) do nothing returning id into e_id;
  return query select b_id,i.project_id,e_id;
end; $$;

create or replace function public.release_checkout_reservation(p_checkout_session_id text)
returns void language plpgsql security definer set search_path=public as $$
declare i public.checkout_backing_intents%rowtype;
begin
  select * into i from public.checkout_backing_intents where checkout_session_id=p_checkout_session_id for update;
  if found then
    if i.converted_at is null and i.released_at is null then
      if i.reservation_id is not null then update public.rewards set reserved_quantity=greatest(0,reserved_quantity-1) where id=i.reward_id; update public.reward_reservations set released_at=now() where id=i.reservation_id; end if;
      update public.checkout_backing_intents set released_at=now() where checkout_session_id=p_checkout_session_id;
    end if;
    return;
  end if;
end; $$;
revoke all on function public.finalize_stripe_checkout(text,text,integer,text,text) from public, anon, authenticated;
revoke all on function public.release_checkout_reservation(text) from public, anon, authenticated;
