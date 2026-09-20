-- One ordered canonical gallery for project images and YouTube media. The
-- separate image_url remains the project cover and is always rendered first.
alter table public.projects
  add column if not exists gallery_media jsonb not null default '[]'::jsonb;

update public.projects p
set gallery_media = coalesce((
  select jsonb_agg(jsonb_build_object('type', 'image', 'url', value) order by ordinal)
  from unnest(p.gallery_urls) with ordinality as legacy(value, ordinal)
), '[]'::jsonb)
where p.gallery_media = '[]'::jsonb
  and cardinality(p.gallery_urls) > 0;

-- Launch Island's visible app assets predate canonical media storage. Preserve
-- those exact assets as its canonical cover/gallery instead of asking for a
-- re-upload or creating duplicate project records.
update public.projects
set image_url = coalesce(image_url, 'https://backedit.co/projects/launch-island/cover.jpeg'),
    gallery_media = case
      when gallery_media = '[]'::jsonb then jsonb_build_array(
        jsonb_build_object('type', 'image', 'url', 'https://backedit.co/projects/launch-island/gallery-2.jpeg'),
        jsonb_build_object('type', 'image', 'url', 'https://backedit.co/projects/launch-island/gallery-3.jpeg')
      )
      else gallery_media
    end
where slug = 'launch-island';

create or replace function public.is_valid_project_gallery(value jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $function$
  select jsonb_typeof(value) = 'array'
    and jsonb_array_length(value) <= 12
    and not exists (
      select 1
      from jsonb_array_elements(value) item
      where not (
        (coalesce(item->>'type', '') = 'image'
          and coalesce(item->>'url', '') ~ '^https://[^[:space:]]+$'
          and (not (item ? 'storagePath') or coalesce(item->>'storagePath', '') ~ '^(projects|drafts)/'))
        or
        (coalesce(item->>'type', '') = 'youtube'
          and coalesce(item->>'videoId', '') ~ '^[A-Za-z0-9_-]{11}$'
          and not (item ? 'url'))
      )
    );
$function$;

revoke all on function public.is_valid_project_gallery(jsonb) from public, anon, authenticated;

alter table public.projects
  drop constraint if exists projects_gallery_media_check,
  add constraint projects_gallery_media_check
    check (public.is_valid_project_gallery(gallery_media));

drop view if exists public.public_profile_projects;

create or replace function public.publish_project_draft(
  p_draft_id uuid,
  p_secret_hash text,
  p_user_id uuid
)
returns table(project_id uuid, project_slug text)
language plpgsql
security definer
set search_path = public
as $function$
declare
  d public.project_drafts%rowtype;
  p jsonb;
  v_slug text;
  v_project_id uuid;
  v_goal integer;
  v_price integer;
  v_quantity integer;
  v_deadline timestamptz;
  v_category text;
begin
  select * into d
  from public.project_drafts
  where id = p_draft_id and secret_hash = p_secret_hash
  for update;

  if not found then raise exception 'draft_not_found'; end if;
  if d.owner_id is null then
    update public.project_drafts
    set owner_id = p_user_id, claimed_at = now()
    where id = d.id;
    d.owner_id := p_user_id;
  end if;
  if d.owner_id <> p_user_id then raise exception 'draft_owned_by_another_user'; end if;
  if d.project_id is not null then
    return query select d.project_id, pr.slug from public.projects pr where pr.id = d.project_id;
    return;
  end if;

  p := d.payload;
  if char_length(trim(coalesce(p->>'name', ''))) < 3
     or char_length(trim(coalesce(p->>'summary', ''))) < 3
     or coalesce(p->>'goal', '') = ''
     or coalesce(p->>'deadline', '') = ''
     or char_length(trim(coalesce(p->>'rewardName', ''))) < 2
     or coalesce(p->>'rewardPrice', '') = ''
     or coalesce(p->>'coverPath', '') = '' then
    raise exception 'incomplete_draft';
  end if;

  v_goal := round((p->>'goal')::numeric * 100);
  v_price := round((p->>'rewardPrice')::numeric * 100);
  v_quantity := greatest(1, floor(coalesce(nullif(p->>'rewardQuantity', '')::numeric, 1))::integer);
  v_deadline := (p->>'deadline')::timestamptz;
  v_category := coalesce(nullif(p->>'category', ''), 'Other');

  if v_goal < 100 or v_price < 100 or v_deadline <= now()
     or v_category not in ('Technology', 'Design', 'Fashion', 'Games', 'Publishing', 'Food', 'Other')
     or coalesce(p->>'coverPath', '') !~ ('^drafts/' || d.id::text || '/')
     or not public.is_valid_project_gallery(coalesce(p->'galleryMedia', '[]'::jsonb)) then
    raise exception 'invalid_project_values';
  end if;
  if coalesce(p->>'externalWebsite', '') <> '' and p->>'externalWebsite' !~ '^https://[^[:space:]]+$' then
    raise exception 'invalid_external_website';
  end if;

  v_slug := trim(both '-' from left(regexp_replace(lower(p->>'name'), '[^a-z0-9]+', '-', 'g'), 56))
    || '-' || left(d.id::text, 8);

  insert into public.projects (
    creator_id, slug, name, summary, description, image_url, gallery_media,
    category, external_website, location, project_dates, funding_goal_amount,
    currency, status, launch_at, deadline_at
  ) values (
    p_user_id, v_slug, left(trim(p->>'name'), 160), left(trim(p->>'summary'), 500),
    left(coalesce(p->>'story', ''), 10000), null, '[]'::jsonb, v_category,
    nullif(left(coalesce(p->>'externalWebsite', ''), 500), ''),
    nullif(left(coalesce(p->>'location', ''), 160), ''),
    nullif(left(coalesce(p->>'projectDates', ''), 160), ''),
    v_goal, 'usd', 'live', now(), v_deadline
  ) returning id into v_project_id;

  insert into public.rewards (project_id, title, description, amount, total_quantity)
  values (
    v_project_id, left(trim(p->>'rewardName'), 160),
    left(coalesce(p->>'rewardDescription', ''), 2000), v_price, v_quantity
  );

  update public.project_drafts set project_id = v_project_id where id = d.id;
  return query select v_project_id, v_slug;
end;
$function$;

revoke all on function public.publish_project_draft(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.publish_project_draft(uuid, text, uuid) to service_role;

create view public.public_profile_projects as
select
  lower(pr.username) as creator_username,
  p.slug,
  p.name,
  p.summary,
  p.description,
  p.image_url,
  p.currency,
  p.funding_goal_amount,
  p.initial_backed_amount,
  p.successful_backed_amount,
  p.successful_backer_count,
  p.deadline_at,
  pr.display_name as creator_display_name,
  pr.avatar_url as creator_avatar_url,
  coalesce((
    select r.total_quantity - r.claimed_quantity - count(rr.id)::integer
    from public.rewards r
    left join public.reward_reservations rr
      on rr.reward_id = r.id
      and rr.converted_at is null
      and rr.released_at is null
      and rr.expires_at > now()
    where r.project_id = p.id
    group by r.id, r.total_quantity, r.claimed_quantity
    order by r.created_at
    limit 1
  ), 0) as reward_available_quantity,
  p.gallery_media,
  p.category,
  p.external_website,
  p.location,
  p.project_dates,
  (select r.title from public.rewards r where r.project_id = p.id order by r.created_at limit 1) as reward_title,
  (select r.description from public.rewards r where r.project_id = p.id order by r.created_at limit 1) as reward_description,
  (select r.amount from public.rewards r where r.project_id = p.id order by r.created_at limit 1) as reward_amount,
  (select r.total_quantity from public.rewards r where r.project_id = p.id order by r.created_at limit 1) as reward_total_quantity,
  p.gallery_urls
from public.projects p
join public.profiles pr on pr.id = p.creator_id
where pr.username is not null
  and pr.deleted_at is null
  and p.status = 'live'
  and p.admin_archived_at is null
  and p.admin_suspended_at is null
  and p.creator_archived_at is null;

revoke all on public.public_profile_projects from public;
grant select on public.public_profile_projects to anon, authenticated;

comment on column public.projects.gallery_media is
  'Ordered canonical project gallery. The separate image_url cover always renders first.';

comment on column public.projects.gallery_urls is
  'Deprecated read-only compatibility field. New media writes use gallery_media.';
