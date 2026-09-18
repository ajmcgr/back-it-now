create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
create schema if not exists private;

create or replace function private.invoke_campaign_settlement()
returns void language plpgsql security definer set search_path = extensions, vault, private as $$
declare secret_value text;
begin
  select decrypted_secret into secret_value
  from vault.decrypted_secrets where name = 'backed_settlement_cron_secret';
  if secret_value is null then
    raise warning 'campaign settlement cron secret is not configured in Vault';
    return;
  end if;
  perform net.http_post(
    url := 'https://zlzaxgsyczfeepwidjii.supabase.co/functions/v1/campaign-settlement',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-settlement-secret', secret_value),
    body := '{}'::jsonb
  );
end;
$$;
revoke all on function private.invoke_campaign_settlement() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'backed-campaign-settlement';
select cron.schedule('backed-campaign-settlement', '*/10 * * * *', 'select private.invoke_campaign_settlement();');
