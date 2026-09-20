-- Keep the connected-account destination immutable on the backing whenever a
-- transfer is recorded. Stripe's zero-balance deletion rule prevents an
-- account reset from completing while such a transfer is landing.
create or replace function private.capture_creator_stripe_account_on_transfer()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.stripe_transfer_id is not null
     and old.stripe_transfer_id is null
     and new.creator_stripe_account_id is null then
    select creator.stripe_account_id
    into new.creator_stripe_account_id
    from public.projects project
    join public.profiles creator on creator.id = project.creator_id
    where project.id = new.project_id;

    if new.creator_stripe_account_id is null then
      raise exception 'creator_stripe_account_missing';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists capture_creator_stripe_account_on_transfer on public.backings;
create trigger capture_creator_stripe_account_on_transfer
before update of stripe_transfer_id on public.backings
for each row
execute function private.capture_creator_stripe_account_on_transfer();

revoke all on function private.capture_creator_stripe_account_on_transfer() from public, anon, authenticated;
