-- Weekly autonomous Backed editorial publishing.
-- Article copy and cover art are generated server-side, validated, stored, and
-- published atomically. The scheduler credential is generated inside Postgres
-- and remains in Vault; no secret value is committed to source.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create schema if not exists private;

alter table public.blog_images
  drop constraint if exists blog_images_known_slug;

create table if not exists public.blog_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 12 and 120),
  description text not null check (char_length(description) between 50 and 220),
  excerpt text not null check (char_length(excerpt) between 50 and 260),
  category text not null check (category in ('Crowdfunding', 'Guides', 'Comparisons', 'Ideas')),
  author text not null default 'Backed' check (char_length(author) between 2 and 80),
  published_at timestamptz not null,
  updated_at timestamptz not null,
  read_minutes integer not null check (read_minutes between 3 and 20),
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  image_concept text not null check (char_length(image_concept) between 30 and 500),
  image_url text not null check (image_url like 'https://%'),
  image_storage_path text not null,
  sections jsonb not null check (jsonb_typeof(sections) = 'array'),
  related_links jsonb not null default '[]'::jsonb check (jsonb_typeof(related_links) = 'array'),
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array'),
  generation_source text not null default 'openai-weekly',
  text_model text not null,
  image_model text not null,
  created_at timestamptz not null default now()
);

create index if not exists blog_articles_published_at_idx
  on public.blog_articles (published_at desc)
  where status = 'published';

alter table public.blog_articles enable row level security;

drop policy if exists "published blog articles are publicly readable" on public.blog_articles;
create policy "published blog articles are publicly readable"
on public.blog_articles
for select
to anon, authenticated
using (status = 'published' and published_at <= now());

revoke all on public.blog_articles from anon, authenticated;
grant select (
  slug,
  title,
  description,
  excerpt,
  category,
  author,
  published_at,
  updated_at,
  read_minutes,
  image_concept,
  image_url,
  sections,
  related_links,
  sources
) on public.blog_articles to anon, authenticated;

create table if not exists private.blog_automation_state (
  singleton boolean primary key default true check (singleton),
  status text not null default 'idle' check (status in ('idle', 'generating')),
  next_publish_at timestamptz not null,
  started_at timestamptz,
  completed_at timestamptz,
  job_token uuid,
  article_id uuid references public.blog_articles(id),
  failure_count integer not null default 0 check (failure_count >= 0),
  last_error_code text,
  updated_at timestamptz not null default now()
);

insert into private.blog_automation_state (singleton, next_publish_at)
values (true, now() + interval '7 days')
on conflict (singleton) do nothing;

do $$
begin
  if not exists (
    select 1 from vault.secrets where name = 'backed_blog_automation_secret'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'backed_blog_automation_secret',
      'Authenticates the autonomous Backed blog publisher cron request'
    );
  end if;
end;
$$;

create or replace function public.verify_blog_automation_secret(p_secret text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_secret text;
begin
  if p_secret is null or char_length(p_secret) < 32 then
    return false;
  end if;

  select decrypted_secret into expected_secret
  from vault.decrypted_secrets
  where name = 'backed_blog_automation_secret';

  return expected_secret is not null and p_secret = expected_secret;
end;
$$;

create or replace function public.claim_weekly_blog_publication()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_token uuid;
begin
  update private.blog_automation_state
  set status = 'generating',
      started_at = now(),
      job_token = gen_random_uuid(),
      last_error_code = null,
      updated_at = now()
  where singleton = true
    and next_publish_at <= now()
    and (
      status = 'idle'
      or started_at is null
      or started_at < now() - interval '30 minutes'
    )
  returning job_token into claimed_token;

  return claimed_token;
end;
$$;

create or replace function public.publish_weekly_blog_article(
  p_job_token uuid,
  p_article jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  published_id uuid;
  changed_count integer;
begin
  if not exists (
    select 1
    from private.blog_automation_state
    where singleton = true and job_token = p_job_token and status = 'generating'
  ) then
    raise exception 'invalid or expired blog generation job';
  end if;

  insert into public.blog_articles (
    slug,
    title,
    description,
    excerpt,
    category,
    author,
    published_at,
    updated_at,
    read_minutes,
    status,
    image_concept,
    image_url,
    image_storage_path,
    sections,
    related_links,
    sources,
    generation_source,
    text_model,
    image_model
  ) values (
    p_article->>'slug',
    p_article->>'title',
    p_article->>'description',
    p_article->>'excerpt',
    p_article->>'category',
    'Backed',
    (p_article->>'published_at')::timestamptz,
    (p_article->>'published_at')::timestamptz,
    (p_article->>'read_minutes')::integer,
    'published',
    p_article->>'image_concept',
    p_article->>'image_url',
    p_article->>'image_storage_path',
    p_article->'sections',
    p_article->'related_links',
    p_article->'sources',
    'openai-weekly',
    p_article->>'text_model',
    p_article->>'image_model'
  )
  returning id into published_id;

  update private.blog_automation_state
  set status = 'idle',
      next_publish_at = now() + interval '7 days',
      completed_at = now(),
      article_id = published_id,
      job_token = null,
      failure_count = 0,
      last_error_code = null,
      updated_at = now()
  where singleton = true and job_token = p_job_token and status = 'generating';

  get diagnostics changed_count = row_count;
  if changed_count <> 1 then
    raise exception 'blog generation job changed before publication';
  end if;

  return published_id;
end;
$$;

create or replace function public.fail_weekly_blog_publication(
  p_job_token uuid,
  p_error_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.blog_automation_state
  set status = 'idle',
      started_at = null,
      job_token = null,
      failure_count = failure_count + 1,
      last_error_code = left(coalesce(p_error_code, 'generation_failed'), 100),
      updated_at = now()
  where singleton = true and job_token = p_job_token;
end;
$$;

create or replace function public.stop_blog_image_backfill()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'backed-blog-image-backfill';
end;
$$;

revoke all on function public.verify_blog_automation_secret(text) from public, anon, authenticated;
revoke all on function public.claim_weekly_blog_publication() from public, anon, authenticated;
revoke all on function public.publish_weekly_blog_article(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.fail_weekly_blog_publication(uuid, text) from public, anon, authenticated;
revoke all on function public.stop_blog_image_backfill() from public, anon, authenticated;

grant execute on function public.verify_blog_automation_secret(text) to service_role;
grant execute on function public.claim_weekly_blog_publication() to service_role;
grant execute on function public.publish_weekly_blog_article(uuid, jsonb) to service_role;
grant execute on function public.fail_weekly_blog_publication(uuid, text) to service_role;
grant execute on function public.stop_blog_image_backfill() to service_role;

create or replace function private.invoke_blog_publisher(p_mode text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret_value text;
begin
  select decrypted_secret into secret_value
  from vault.decrypted_secrets
  where name = 'backed_blog_automation_secret';

  if secret_value is null then
    raise warning 'Backed blog automation secret is unavailable';
    return;
  end if;

  perform net.http_post(
    url := 'https://zlzaxgsyczfeepwidjii.supabase.co/functions/v1/blog-publisher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-blog-automation-secret', secret_value
    ),
    body := jsonb_build_object('mode', p_mode),
    timeout_milliseconds := 180000
  );
end;
$$;

revoke all on function private.invoke_blog_publisher(text) from public, anon, authenticated;

select cron.schedule(
  'backed-weekly-blog-publisher',
  '0 9 * * *',
  $$select private.invoke_blog_publisher('weekly');$$
);

-- This temporary job generates one missing cover every ten minutes. The Edge
-- Function removes the job after all repository-owned launch articles have art.
select cron.schedule(
  'backed-blog-image-backfill',
  '*/10 * * * *',
  $$select private.invoke_blog_publisher('backfill');$$
);
