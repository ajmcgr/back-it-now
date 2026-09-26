-- Blog copy remains repository-owned. This table stores only the state and
-- permanent public reference for explicitly generated editorial cover images.
create table if not exists public.blog_images (
  slug text primary key,
  status text not null default 'pending' check (status in ('pending', 'ready')),
  generation_status text not null default 'idle' check (generation_status in ('idle', 'generating', 'failed')),
  public_url text,
  storage_path text,
  job_token uuid,
  started_at timestamptz,
  updated_at timestamptz not null default now(),
  generation_count integer not null default 0 check (generation_count >= 0),
  last_error_code text,
  constraint blog_images_known_slug check (
    slug in (
      'how-to-crowdfund-a-project-in-2026',
      'kickstarter-vs-patreon',
      'kickstarter-vs-gofundme',
      'best-kickstarter-alternatives-2026',
      'how-to-set-a-crowdfunding-goal',
      'reward-based-crowdfunding-explained',
      'how-to-get-your-first-backers',
      'flexible-vs-all-or-nothing-crowdfunding'
    )
  )
);

alter table public.blog_images enable row level security;

drop policy if exists "ready blog images are publicly readable" on public.blog_images;
create policy "ready blog images are publicly readable"
on public.blog_images
for select
to anon, authenticated
using (status = 'ready' and public_url is not null);

revoke all on public.blog_images from anon, authenticated;
grant select (slug, public_url, updated_at) on public.blog_images to anon, authenticated;

-- Only the service role used inside the admin-only Edge Function may claim a
-- generation lock. A stale lock expires so an interrupted request is recoverable.
create or replace function public.claim_blog_image_generation(p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_token uuid;
begin
  insert into public.blog_images (
    slug,
    status,
    generation_status,
    job_token,
    started_at,
    updated_at,
    last_error_code
  ) values (
    p_slug,
    'pending',
    'generating',
    gen_random_uuid(),
    now(),
    now(),
    null
  )
  on conflict (slug) do update
    set generation_status = 'generating',
        job_token = gen_random_uuid(),
        started_at = now(),
        updated_at = now(),
        last_error_code = null
    where public.blog_images.generation_status <> 'generating'
       or public.blog_images.started_at < now() - interval '10 minutes'
  returning job_token into claimed_token;

  return claimed_token;
end;
$$;

revoke all on function public.claim_blog_image_generation(text) from public, anon, authenticated;
grant execute on function public.claim_blog_image_generation(text) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog-images', 'blog-images', true, 5242880, array['image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "blog images are publicly readable" on storage.objects;
create policy "blog images are publicly readable"
on storage.objects
for select
to public
using (bucket_id = 'blog-images');
