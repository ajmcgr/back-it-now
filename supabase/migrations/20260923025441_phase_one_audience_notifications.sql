-- Phase 1 audience relationships and notifications. This deliberately reuses
-- project_favorites as the only project watch/subscription relationship.

alter table public.projects
  add column if not exists planned_launch_at timestamptz;

alter table public.profiles
  add column if not exists receive_project_launches boolean not null default true,
  add column if not exists receive_creator_new_projects boolean not null default true,
  add column if not exists receive_my_project_activity boolean not null default true;

revoke update on public.profiles from authenticated;
grant update (
  display_name,
  username,
  bio,
  website,
  receive_project_updates,
  receive_favorite_project_updates,
  receive_project_launches,
  receive_creator_new_projects,
  receive_my_project_activity,
  receive_product_news
) on public.profiles to authenticated;

create table public.creator_follows (
  id uuid primary key default gen_random_uuid(),
  follower_user_id uuid not null references public.profiles(id) on delete cascade,
  followed_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint creator_follows_not_self check (follower_user_id <> followed_user_id),
  constraint creator_follows_unique unique (follower_user_id, followed_user_id)
);

create index creator_follows_followed_created_idx
  on public.creator_follows (followed_user_id, created_at desc);
create index creator_follows_follower_created_idx
  on public.creator_follows (follower_user_id, created_at desc);

alter table public.creator_follows enable row level security;
revoke all on public.creator_follows from public, anon, authenticated;
grant select, insert, delete on public.creator_follows to authenticated;

create policy "users read their own creator follows"
  on public.creator_follows for select to authenticated
  using ((select auth.uid()) = follower_user_id);

create policy "users follow creators as themselves"
  on public.creator_follows for insert to authenticated
  with check (
    (select auth.uid()) = follower_user_id
    and follower_user_id <> followed_user_id
    and exists (
      select 1 from public.profiles followed
      where followed.id = followed_user_id
        and followed.deleted_at is null
        and followed.username is not null
    )
  );

create policy "users unfollow creators as themselves"
  on public.creator_follows for delete to authenticated
  using ((select auth.uid()) = follower_user_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (
    event_type in ('project_launch', 'project_update', 'creator_follow', 'project_backing', 'project_comment')
  ),
  project_id uuid references public.projects(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  title text not null check (char_length(title) between 1 and 160),
  body text not null default '' check (char_length(body) <= 500),
  target_url text not null check (target_url ~ '^/'),
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint notifications_recipient_dedupe unique (recipient_id, dedupe_key)
);

create index notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);
create index notifications_recipient_unread_idx
  on public.notifications (recipient_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;
grant select, update (read_at) on public.notifications to authenticated;

create policy "users read their own notifications"
  on public.notifications for select to authenticated
  using ((select auth.uid()) = recipient_id);

create policy "users mark their own notifications read"
  on public.notifications for update to authenticated
  using ((select auth.uid()) = recipient_id)
  with check ((select auth.uid()) = recipient_id);

create table public.project_launch_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.project_launch_events enable row level security;
revoke all on public.project_launch_events from public, anon, authenticated;

-- Public pre-launch pages are readable, but suspended/archived projects remain
-- hidden and creators retain access to their own records.
alter policy "public projects are readable" on public.projects
using (
  (
    status = any (
      array[
        'prelaunch'::public.project_status,
        'live'::public.project_status,
        'funded'::public.project_status,
        'completed'::public.project_status
      ]
    )
    and admin_archived_at is null
    and admin_suspended_at is null
    and creator_archived_at is null
  )
  or creator_id = (select auth.uid())
);

drop policy if exists "users favorite public projects" on public.project_favorites;
create policy "users favorite public projects"
  on public.project_favorites for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.projects project
      join public.profiles creator on creator.id = project.creator_id
      where project.id = project_favorites.project_id
        and project.status in ('prelaunch', 'live')
        and project.admin_archived_at is null
        and project.admin_suspended_at is null
        and project.creator_archived_at is null
        and creator.deleted_at is null
    )
  );

-- Keep the existing canonical aggregate view and extend it to public
-- pre-launch projects. Consumers explicitly filter live marketplace lists.
create or replace view public.public_profile_projects as
with backing_metrics as (
  select
    backing.project_id,
    count(distinct coalesce(backing.backer_id, backing.id))::integer as backer_count,
    max(coalesce(backing.paid_at, backing.created_at)) as latest_backed_at
  from public.backings backing
  where backing.status = 'paid'
    and coalesce(backing.refund_amount, 0) < backing.gross_amount
  group by backing.project_id
), comment_metrics as (
  select comment.project_id, count(*)::integer as comment_count
  from public.project_comments comment
  where comment.moderation_status = 'visible'
    and comment.deleted_at is null
  group by comment.project_id
), favorite_metrics as (
  select favorite.project_id, count(*)::integer as favorite_count
  from public.project_favorites favorite
  group by favorite.project_id
)
select
  lower(profile.username) as creator_username,
  project.slug,
  project.name,
  project.summary,
  project.description,
  project.image_url,
  project.currency,
  project.funding_goal_amount,
  project.initial_backed_amount,
  project.successful_backed_amount,
  coalesce(backing_metrics.backer_count, 0) as successful_backer_count,
  project.deadline_at,
  profile.display_name as creator_display_name,
  profile.avatar_url as creator_avatar_url,
  coalesce((
    select reward.total_quantity - reward.claimed_quantity - count(reservation.id)::integer
    from public.rewards reward
    left join public.reward_reservations reservation
      on reservation.reward_id = reward.id
      and reservation.converted_at is null
      and reservation.released_at is null
      and reservation.expires_at > now()
    where reward.project_id = project.id
    group by reward.id, reward.total_quantity, reward.claimed_quantity
    order by reward.created_at
    limit 1
  ), 0) as reward_available_quantity,
  project.gallery_media,
  project.category,
  project.external_website,
  project.location,
  project.project_dates,
  (select reward.title from public.rewards reward where reward.project_id = project.id order by reward.created_at limit 1) as reward_title,
  (select reward.description from public.rewards reward where reward.project_id = project.id order by reward.created_at limit 1) as reward_description,
  (select reward.amount from public.rewards reward where reward.project_id = project.id order by reward.created_at limit 1) as reward_amount,
  (select reward.total_quantity from public.rewards reward where reward.project_id = project.id order by reward.created_at limit 1) as reward_total_quantity,
  project.gallery_urls,
  project.created_at,
  backing_metrics.latest_backed_at,
  coalesce(comment_metrics.comment_count, 0) as comment_count,
  coalesce(favorite_metrics.favorite_count, 0) as favorite_count,
  project.status,
  project.planned_launch_at
from public.projects project
join public.profiles profile on profile.id = project.creator_id
left join backing_metrics on backing_metrics.project_id = project.id
left join comment_metrics on comment_metrics.project_id = project.id
left join favorite_metrics on favorite_metrics.project_id = project.id
where profile.username is not null
  and profile.deleted_at is null
  and project.status in ('prelaunch', 'live')
  and project.admin_archived_at is null
  and project.admin_suspended_at is null
  and project.creator_archived_at is null;

revoke all on public.public_profile_projects from public;
grant select on public.public_profile_projects to anon, authenticated;

-- Phase 1 exposes follower count, never follower identities or email.
drop view if exists public.public_profiles;
create view public.public_profiles as
select
  lower(profile.username) as username,
  profile.display_name,
  profile.avatar_url,
  profile.bio,
  profile.website,
  coalesce(follow_metrics.follower_count, 0) as follower_count
from public.profiles profile
left join (
  select followed_user_id, count(*)::integer as follower_count
  from public.creator_follows
  group by followed_user_id
) follow_metrics on follow_metrics.followed_user_id = profile.id
where profile.username is not null
  and profile.deleted_at is null;

revoke all on public.public_profiles from public;
grant select on public.public_profiles to anon, authenticated;

revoke all on function public.list_public_profile_favorites(text) from public, anon, authenticated;
drop function if exists public.list_public_profile_favorites(text);

create or replace function public.set_project_favorite(
  p_project_slug text,
  p_favorite boolean
)
returns table (is_favorited boolean, favorite_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_project_id uuid;
begin
  if actor_id is null then raise exception 'authentication_required'; end if;

  select project.id into target_project_id
  from public.projects project
  join public.profiles creator on creator.id = project.creator_id
  where project.slug = p_project_slug
    and project.status in ('prelaunch', 'live')
    and project.admin_archived_at is null
    and project.admin_suspended_at is null
    and project.creator_archived_at is null
    and creator.deleted_at is null;

  if target_project_id is null then raise exception 'project_unavailable'; end if;

  if coalesce(p_favorite, false) then
    insert into public.project_favorites (project_id, user_id)
    values (target_project_id, actor_id)
    on conflict (project_id, user_id) do nothing;
  else
    delete from public.project_favorites favorite
    where favorite.project_id = target_project_id
      and favorite.user_id = actor_id;
  end if;

  return query
  select
    exists (
      select 1 from public.project_favorites favorite
      where favorite.project_id = target_project_id and favorite.user_id = actor_id
    ),
    (select count(*)::integer from public.project_favorites favorite where favorite.project_id = target_project_id);
end;
$$;

create or replace function public.set_creator_follow(
  p_creator_username text,
  p_follow boolean
)
returns table (is_following boolean, follower_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_id uuid;
  follow_id uuid;
  actor_username text;
begin
  if actor_id is null then raise exception 'authentication_required'; end if;

  select profile.id into target_id
  from public.profiles profile
  where lower(profile.username) = lower(p_creator_username)
    and profile.deleted_at is null;

  if target_id is null then raise exception 'creator_unavailable'; end if;
  if target_id = actor_id then raise exception 'cannot_follow_self'; end if;

  if coalesce(p_follow, false) then
    insert into public.creator_follows (follower_user_id, followed_user_id)
    values (actor_id, target_id)
    on conflict (follower_user_id, followed_user_id) do nothing
    returning id into follow_id;

    if follow_id is not null then
      select profile.username into actor_username
      from public.profiles profile where profile.id = actor_id;

      insert into public.notifications (
        recipient_id, event_type, actor_id, title, body, target_url, dedupe_key
      ) values (
        target_id,
        'creator_follow',
        actor_id,
        'Someone followed you',
        coalesce('@' || actor_username, 'A Backed member') || ' followed your creator profile.',
        case when actor_username is null then '/' else '/' || lower(actor_username) end,
        'creator-follow:' || follow_id::text
      ) on conflict (recipient_id, dedupe_key) do nothing;
    end if;
  else
    delete from public.creator_follows follow
    where follow.follower_user_id = actor_id
      and follow.followed_user_id = target_id;
  end if;

  return query
  select
    exists (
      select 1 from public.creator_follows follow
      where follow.follower_user_id = actor_id and follow.followed_user_id = target_id
    ),
    (select count(*)::integer from public.creator_follows follow where follow.followed_user_id = target_id);
end;
$$;

create or replace function public.get_creator_follow_state(p_creator_username text)
returns table (is_following boolean, follower_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select profile.id
    from public.profiles profile
    where lower(profile.username) = lower(p_creator_username)
      and profile.deleted_at is null
  )
  select
    exists (
      select 1 from public.creator_follows follow
      where follow.followed_user_id = target.id
        and follow.follower_user_id = (select auth.uid())
    ),
    (select count(*)::integer from public.creator_follows follow where follow.followed_user_id = target.id)
  from target;
$$;

revoke all on function public.set_creator_follow(text, boolean) from public, anon, authenticated;
revoke all on function public.get_creator_follow_state(text) from public, anon, authenticated;
grant execute on function public.set_creator_follow(text, boolean) to authenticated;
grant execute on function public.get_creator_follow_state(text) to authenticated;

-- New comments are a straightforward owner activity notification. This does
-- not send email itself and cannot affect comment creation if delivery fails.
create or replace function public.notify_project_owner_of_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_project public.projects%rowtype;
  commenter_name text;
begin
  select project.* into target_project
  from public.projects project where project.id = new.project_id;
  if not found or target_project.creator_id = new.author_id then return new; end if;

  select coalesce(profile.display_name, profile.username, 'A Backed member')
  into commenter_name from public.profiles profile where profile.id = new.author_id;

  insert into public.notifications (
    recipient_id, event_type, project_id, actor_id, title, body, target_url, dedupe_key
  ) values (
    target_project.creator_id,
    'project_comment',
    target_project.id,
    new.author_id,
    'New comment on ' || target_project.name,
    commenter_name || ' commented on your project.',
    '/projects/' || target_project.slug || '#comments',
    'project-comment:' || new.id::text
  ) on conflict (recipient_id, dedupe_key) do nothing;
  return new;
end;
$$;

revoke all on function public.notify_project_owner_of_comment() from public, anon, authenticated;
drop trigger if exists notify_project_owner_of_comment on public.project_comments;
create trigger notify_project_owner_of_comment
after insert on public.project_comments
for each row execute function public.notify_project_owner_of_comment();

-- Existing comment email generation remains authoritative, while this guard
-- applies the new optional owner-activity preference before a delivery queues.
create or replace function public.apply_project_activity_email_preference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  preference_enabled boolean;
  comment_id uuid;
begin
  if new.event_type <> 'project_comment' then return new; end if;
  begin
    comment_id := split_part(new.dedupe_key, ':', 2)::uuid;
  exception when others then
    return new;
  end;

  select creator.receive_my_project_activity into preference_enabled
  from public.project_comments comment
  join public.projects project on project.id = comment.project_id
  join public.profiles creator on creator.id = project.creator_id
  where comment.id = comment_id;

  if preference_enabled is false then return null; end if;
  return new;
end;
$$;

revoke all on function public.apply_project_activity_email_preference() from public, anon, authenticated;
drop trigger if exists apply_project_activity_email_preference on public.email_deliveries;
create trigger apply_project_activity_email_preference
before insert on public.email_deliveries
for each row execute function public.apply_project_activity_email_preference();

-- Internal canonical launch event. The function is intentionally not exposed
-- through the Data API; owner-authorized functions below invoke it.
create or replace function public.queue_project_launch_event(
  p_project_id uuid,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  launch_event_id uuid;
  target_project public.projects%rowtype;
  creator_name text;
begin
  select project.* into target_project
  from public.projects project
  where project.id = p_project_id
    and project.status = 'live'
    and project.admin_archived_at is null
    and project.admin_suspended_at is null
    and project.creator_archived_at is null;
  if not found or target_project.creator_id <> p_actor_id then
    raise exception 'project_launch_denied';
  end if;

  insert into public.project_launch_events (project_id, actor_id)
  values (target_project.id, p_actor_id)
  on conflict (project_id) do nothing
  returning id into launch_event_id;

  if launch_event_id is null then
    select event.id into launch_event_id
    from public.project_launch_events event
    where event.project_id = target_project.id;
    return launch_event_id;
  end if;

  select coalesce(profile.display_name, profile.username, 'A creator') into creator_name
  from public.profiles profile where profile.id = target_project.creator_id;

  with recipients as (
    select
      profile.id as recipient_id,
      profile.email,
      profile.receive_project_launches,
      profile.receive_creator_new_projects,
      bool_or(source.from_favorite) as from_favorite,
      bool_or(source.from_creator_follow) as from_creator_follow
    from (
      select favorite.user_id, true as from_favorite, false as from_creator_follow
      from public.project_favorites favorite
      where favorite.project_id = target_project.id
      union all
      select follow.follower_user_id, false, true
      from public.creator_follows follow
      where follow.followed_user_id = target_project.creator_id
    ) source
    join public.profiles profile on profile.id = source.user_id
    where profile.id <> p_actor_id and profile.deleted_at is null
    group by profile.id, profile.email, profile.receive_project_launches,
      profile.receive_creator_new_projects
  )
  insert into public.notifications (
    recipient_id, event_type, project_id, actor_id, title, body, target_url, dedupe_key
  )
  select
    recipient.recipient_id,
    'project_launch',
    target_project.id,
    p_actor_id,
    case when recipient.from_favorite
      then target_project.name || ' is now live'
      else creator_name || ' launched a new project'
    end,
    case when recipient.from_favorite
      then 'You asked to be notified when this project launched.'
      else target_project.name || ' is now live on Backed.'
    end,
    '/projects/' || target_project.slug,
    'project-launch:' || launch_event_id::text
  from recipients recipient
  on conflict (recipient_id, dedupe_key) do nothing;

  with recipients as (
    select
      profile.id as recipient_id,
      profile.email,
      bool_or(source.from_favorite and profile.receive_project_launches) as favorite_email,
      bool_or(source.from_creator_follow and profile.receive_creator_new_projects) as follow_email
    from (
      select favorite.user_id, true as from_favorite, false as from_creator_follow
      from public.project_favorites favorite
      where favorite.project_id = target_project.id
      union all
      select follow.follower_user_id, false, true
      from public.creator_follows follow
      where follow.followed_user_id = target_project.creator_id
    ) source
    join public.profiles profile on profile.id = source.user_id
    where profile.id <> p_actor_id
      and profile.deleted_at is null
      and nullif(btrim(coalesce(profile.email, '')), '') is not null
    group by profile.id, profile.email
  )
  insert into public.email_deliveries (dedupe_key, event_type, backing_id, recipient_email)
  select
    'project-launch:' || launch_event_id::text || ':' || recipient.recipient_id::text,
    'project_launch',
    null,
    recipient.email
  from recipients recipient
  where recipient.favorite_email or recipient.follow_email
  on conflict (dedupe_key) do nothing;

  return launch_event_id;
end;
$$;

revoke all on function public.queue_project_launch_event(uuid, uuid) from public, anon, authenticated;

create or replace function public.launch_prelaunch_project(p_project_slug text)
returns table (project_id uuid, project_slug text, launched boolean, launch_event_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_project public.projects%rowtype;
  event_id uuid;
begin
  if actor_id is null then raise exception 'authentication_required'; end if;

  select project.* into target_project
  from public.projects project
  where project.slug = p_project_slug
    and project.creator_id = actor_id
  for update;

  if not found
     or target_project.admin_archived_at is not null
     or target_project.admin_suspended_at is not null
     or target_project.creator_archived_at is not null then
    raise exception 'project_launch_denied';
  end if;

  if target_project.status = 'prelaunch' then
    update public.projects
    set status = 'live', launch_at = now(), updated_at = now()
    where id = target_project.id;
    event_id := public.queue_project_launch_event(target_project.id, actor_id);
    return query select target_project.id, target_project.slug, true, event_id;
    return;
  end if;

  if target_project.status = 'live' then
    select event.id into event_id from public.project_launch_events event
    where event.project_id = target_project.id;
    return query select target_project.id, target_project.slug, false, event_id;
    return;
  end if;

  raise exception 'project_not_prelaunch';
end;
$$;

revoke all on function public.launch_prelaunch_project(text) from public, anon, authenticated;
grant execute on function public.launch_prelaunch_project(text) to authenticated;

-- Draft publishing reads the creator's selected mode from the already
-- capability-protected draft. Repeated callbacks still return the same project.
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
  v_status public.project_status;
  v_planned_launch_at timestamptz;
begin
  select * into d from public.project_drafts
  where id = p_draft_id and secret_hash = p_secret_hash for update;

  if not found then raise exception 'draft_not_found'; end if;
  if d.owner_id is null then
    update public.project_drafts set owner_id = p_user_id, claimed_at = now() where id = d.id;
    d.owner_id := p_user_id;
  end if;
  if d.owner_id <> p_user_id then raise exception 'draft_owned_by_another_user'; end if;
  if d.project_id is not null then
    return query select d.project_id, project.slug from public.projects project where project.id = d.project_id;
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
  v_status := case when p->>'launchMode' = 'prelaunch' then 'prelaunch' else 'live' end;
  v_planned_launch_at := case
    when v_status = 'prelaunch' and nullif(p->>'plannedLaunchAt', '') is not null
      then (p->>'plannedLaunchAt')::timestamptz
    else null
  end;

  if v_goal < 100 or v_price < 100 or v_deadline <= now()
     or (v_planned_launch_at is not null and v_planned_launch_at <= now())
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
    currency, status, launch_at, planned_launch_at, deadline_at
  ) values (
    p_user_id, v_slug, left(trim(p->>'name'), 160), left(trim(p->>'summary'), 500),
    left(coalesce(p->>'story', ''), 10000), null, '[]'::jsonb, v_category,
    nullif(left(coalesce(p->>'externalWebsite', ''), 500), ''),
    nullif(left(coalesce(p->>'location', ''), 160), ''),
    nullif(left(coalesce(p->>'projectDates', ''), 160), ''),
    v_goal, 'usd', v_status, case when v_status = 'live' then now() else null end,
    v_planned_launch_at, v_deadline
  ) returning id into v_project_id;

  insert into public.rewards (project_id, title, description, amount, total_quantity)
  values (
    v_project_id, left(trim(p->>'rewardName'), 160),
    left(coalesce(p->>'rewardDescription', ''), 2000), v_price, v_quantity
  );

  update public.project_drafts set project_id = v_project_id where id = d.id;
  if v_status = 'live' then
    perform public.queue_project_launch_event(v_project_id, p_user_id);
  end if;
  return query select v_project_id, v_slug;
end;
$function$;

revoke all on function public.publish_project_draft(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.publish_project_draft(uuid, text, uuid) to service_role;

-- Update notifications use one recipient set per canonical update. Editing an
-- update never invokes this function and therefore never sends again.
create or replace function public.create_project_update(
  p_project_slug text,
  p_title text,
  p_body text,
  p_image_path text,
  p_idempotency_key uuid
)
returns table (
  id uuid,
  title text,
  body text,
  image_path text,
  published_at timestamptz,
  updated_at timestamptz,
  created boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  target_project public.projects%rowtype;
  existing_update public.project_updates%rowtype;
  new_update public.project_updates%rowtype;
  normalized_title text := btrim(coalesce(p_title, ''));
  normalized_body text := btrim(coalesce(p_body, ''));
  normalized_image_path text := nullif(btrim(coalesce(p_image_path, '')), '');
  expected_image_prefix text;
begin
  if actor_id is null then raise exception 'authentication_required'; end if;
  if char_length(normalized_title) not between 1 and 160 then raise exception 'invalid_update_title'; end if;
  if char_length(normalized_body) not between 1 and 20000 then raise exception 'invalid_update_body'; end if;
  if p_idempotency_key is null then raise exception 'idempotency_key_required'; end if;

  select project.* into target_project
  from public.projects project where project.slug = p_project_slug for update;

  if not found
     or target_project.creator_id <> actor_id
     or target_project.status not in ('live', 'funded', 'unsuccessful', 'completed')
     or target_project.admin_archived_at is not null
     or target_project.admin_suspended_at is not null
     or target_project.creator_archived_at is not null then
    raise exception 'project_access_denied';
  end if;

  expected_image_prefix := 'projects/' || target_project.id::text || '/updates/';
  if normalized_image_path is not null then
    if position(expected_image_prefix in normalized_image_path) <> 1
       or normalized_image_path !~ '\.(jpg|png|webp)$'
       or not exists (
         select 1 from storage.objects object
         where object.bucket_id = 'project-media' and object.name = normalized_image_path
       ) then
      raise exception 'invalid_update_image';
    end if;
  end if;

  select project_update.* into existing_update
  from public.project_updates project_update
  where project_update.project_id = target_project.id
    and project_update.idempotency_key = p_idempotency_key;
  if found then
    return query select existing_update.id, existing_update.title, existing_update.body,
      existing_update.image_path, existing_update.published_at, existing_update.updated_at, false;
    return;
  end if;

  insert into public.project_updates (project_id, author_id, title, body, image_path, idempotency_key)
  values (target_project.id, actor_id, normalized_title, normalized_body, normalized_image_path, p_idempotency_key)
  returning * into new_update;

  with recipients as (
    select
      profile.id as profile_id,
      profile.email,
      profile.receive_project_updates,
      profile.receive_favorite_project_updates,
      bool_or(source.from_backing) as from_backing,
      bool_or(source.from_favorite) as from_favorite,
      min(source.backing_id::text)::uuid as backing_id
    from (
      select backing.backer_id as user_id, true as from_backing, false as from_favorite,
        backing.id as backing_id
      from public.backings backing
      where backing.project_id = target_project.id
        and backing.backer_id is not null
        and backing.status = 'paid'
        and coalesce(backing.refund_amount, 0) < backing.gross_amount
      union all
      select favorite.user_id, false, true, null::uuid
      from public.project_favorites favorite
      where favorite.project_id = target_project.id
    ) source
    join public.profiles profile on profile.id = source.user_id
    where profile.id <> actor_id and profile.deleted_at is null
    group by profile.id, profile.email, profile.receive_project_updates,
      profile.receive_favorite_project_updates
  )
  insert into public.notifications (
    recipient_id, event_type, project_id, actor_id, title, body, target_url, dedupe_key
  )
  select recipient.profile_id, 'project_update', target_project.id, actor_id,
    target_project.name || ' posted an update', normalized_title,
    '/projects/' || target_project.slug || '/updates/' || new_update.id::text,
    'project-update:' || new_update.id::text
  from recipients recipient
  on conflict (recipient_id, dedupe_key) do nothing;

  with recipients as (
    select
      profile.id as profile_id,
      profile.email,
      profile.receive_project_updates,
      profile.receive_favorite_project_updates,
      bool_or(source.from_backing) as from_backing,
      bool_or(source.from_favorite) as from_favorite,
      min(source.backing_id::text)::uuid as backing_id
    from (
      select backing.backer_id as user_id, true as from_backing, false as from_favorite,
        backing.id as backing_id
      from public.backings backing
      where backing.project_id = target_project.id
        and backing.backer_id is not null
        and backing.status = 'paid'
        and coalesce(backing.refund_amount, 0) < backing.gross_amount
      union all
      select favorite.user_id, false, true, null::uuid
      from public.project_favorites favorite
      where favorite.project_id = target_project.id
    ) source
    join public.profiles profile on profile.id = source.user_id
    where profile.id <> actor_id
      and profile.deleted_at is null
      and nullif(btrim(coalesce(profile.email, '')), '') is not null
    group by profile.id, profile.email, profile.receive_project_updates,
      profile.receive_favorite_project_updates
  )
  insert into public.email_deliveries (dedupe_key, event_type, backing_id, recipient_email)
  select 'project-update:' || new_update.id::text || ':' || recipient.profile_id::text,
    'project_update', recipient.backing_id, recipient.email
  from recipients recipient
  where (recipient.from_backing and recipient.receive_project_updates)
     or (recipient.from_favorite and recipient.receive_favorite_project_updates)
  on conflict (dedupe_key) do nothing;

  return query select new_update.id, new_update.title, new_update.body,
    new_update.image_path, new_update.published_at, new_update.updated_at, true;
end;
$$;

revoke all on function public.create_project_update(text,text,text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.create_project_update(text,text,text,text,uuid)
  to authenticated;

comment on table public.creator_follows is
  'Private Phase 1 creator-follow relationships. No public follower directory.';
comment on table public.notifications is
  'Private, recipient-scoped in-app notifications. Not a messaging inbox.';
