-- Canonical creator-managed presentation fields. These are deliberately kept
-- on the existing projects record so every public surface resolves the same
-- cover, gallery, and category values.
alter table public.projects
  add column if not exists category text not null default 'Other',
  add column if not exists gallery_urls text[] not null default '{}',
  add column if not exists external_website text,
  add column if not exists location text,
  add column if not exists project_dates text,
  add column if not exists creator_archived_at timestamptz;

alter table public.projects
  drop constraint if exists projects_category_check;

alter table public.projects
  add constraint projects_category_check
  check (category in ('Technology', 'Design', 'Fashion', 'Games', 'Publishing', 'Food', 'Other'));

-- Media is only written by the project-media Edge Function using the service
-- role after it has verified either the draft capability or project ownership.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-media', 'project-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "project media is publicly readable" on storage.objects;
create policy "project media is publicly readable"
on storage.objects for select to public
using (bucket_id = 'project-media');

-- Creator archive hides non-financial projects from public discovery without
-- deleting any historical records. The existing owner read condition remains.
alter policy "public projects are readable" on public.projects
using (
  (
    status = any (array['live'::project_status, 'funded'::project_status, 'completed'::project_status])
    and admin_archived_at is null
    and admin_suspended_at is null
    and creator_archived_at is null
  )
  or creator_id = (select auth.uid())
);

create or replace view public.public_profile_projects as
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
  p.gallery_urls,
  p.category,
  p.external_website,
  p.location,
  p.project_dates,
  (select r.title from public.rewards r where r.project_id = p.id order by r.created_at limit 1) as reward_title,
  (select r.description from public.rewards r where r.project_id = p.id order by r.created_at limit 1) as reward_description,
  (select r.amount from public.rewards r where r.project_id = p.id order by r.created_at limit 1) as reward_amount,
  (select r.total_quantity from public.rewards r where r.project_id = p.id order by r.created_at limit 1) as reward_total_quantity
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

-- The Edge Function is the only supported publish entrypoint. Do not expose a
-- capability-bearing draft RPC to browser roles.
revoke all on function public.publish_project_draft(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.publish_project_draft(uuid, text, uuid) to service_role;

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
     or coalesce(p->>'coverPath', '') !~ ('^drafts/' || d.id::text || '/') then
    raise exception 'invalid_project_values';
  end if;
  if coalesce(p->>'externalWebsite', '') <> '' and p->>'externalWebsite' !~ '^https://[^[:space:]]+$' then
    raise exception 'invalid_external_website';
  end if;

  v_slug := trim(both '-' from left(regexp_replace(lower(p->>'name'), '[^a-z0-9]+', '-', 'g'), 56))
    || '-' || left(d.id::text, 8);

  insert into public.projects (
    creator_id, slug, name, summary, description, image_url, gallery_urls,
    category, external_website, location, project_dates, funding_goal_amount,
    currency, status, launch_at, deadline_at
  ) values (
    p_user_id, v_slug, left(trim(p->>'name'), 160), left(trim(p->>'summary'), 500),
    left(coalesce(p->>'story', ''), 10000), null, '{}', v_category,
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
