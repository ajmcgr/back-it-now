-- One canonical lightweight save/watch relationship for projects. Favorites
-- never affect funding, backer counts, marketplace ranking, or payment state.
alter table public.profiles
  add column if not exists show_public_favorites boolean not null default false,
  add column if not exists receive_favorite_project_updates boolean not null default true;

revoke update on public.profiles from authenticated;
grant update (
  display_name,
  username,
  bio,
  website,
  receive_project_updates,
  receive_product_news,
  show_public_favorites,
  receive_favorite_project_updates
) on public.profiles to authenticated;

create table public.project_favorites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create index project_favorites_user_created_idx
  on public.project_favorites (user_id, created_at desc);
create index project_favorites_project_idx
  on public.project_favorites (project_id);

alter table public.project_favorites enable row level security;
revoke all on public.project_favorites from public, anon, authenticated;
grant select, insert, delete on public.project_favorites to authenticated;

create policy "users read their own favorites"
  on public.project_favorites
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "users favorite public projects"
  on public.project_favorites
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.projects project
      join public.profiles creator on creator.id = project.creator_id
      where project.id = project_favorites.project_id
        and project.status = 'live'
        and project.admin_archived_at is null
        and project.admin_suspended_at is null
        and project.creator_archived_at is null
        and creator.deleted_at is null
    )
  );

create policy "users remove their own favorites"
  on public.project_favorites
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Keep every card surface on one public projection. The aggregates are
-- computed once per result query, not once per card in the browser.
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
  coalesce(favorite_metrics.favorite_count, 0) as favorite_count
from public.projects project
join public.profiles profile on profile.id = project.creator_id
left join backing_metrics on backing_metrics.project_id = project.id
left join comment_metrics on comment_metrics.project_id = project.id
left join favorite_metrics on favorite_metrics.project_id = project.id
where profile.username is not null
  and profile.deleted_at is null
  and project.status = 'live'
  and project.admin_archived_at is null
  and project.admin_suspended_at is null
  and project.creator_archived_at is null;

comment on view public.public_profile_projects is
  'Canonical public live-project presentation with authoritative aggregated social proof. Private identities and non-public projects are excluded.';

revoke all on public.public_profile_projects from public;
grant select on public.public_profile_projects to anon, authenticated;

create or replace view public.public_profiles as
select
  lower(profile.username) as username,
  profile.display_name,
  profile.avatar_url,
  profile.bio,
  profile.website,
  profile.show_public_favorites
from public.profiles profile
where profile.username is not null
  and profile.deleted_at is null;

revoke all on public.public_profiles from public;
grant select on public.public_profiles to anon, authenticated;

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
  if actor_id is null then
    raise exception 'authentication_required';
  end if;

  select project.id
  into target_project_id
  from public.projects project
  join public.profiles creator on creator.id = project.creator_id
  where project.slug = p_project_slug
    and project.status = 'live'
    and project.admin_archived_at is null
    and project.admin_suspended_at is null
    and project.creator_archived_at is null
    and creator.deleted_at is null;

  if target_project_id is null then
    raise exception 'project_unavailable';
  end if;

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

create or replace function public.get_project_favorite_state(p_project_slug text)
returns table (is_favorited boolean, favorite_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.project_favorites favorite
      join public.projects project on project.id = favorite.project_id
      where project.slug = p_project_slug
        and favorite.user_id = (select auth.uid())
    ),
    (
      select count(*)::integer
      from public.project_favorites favorite
      join public.projects project on project.id = favorite.project_id
      where project.slug = p_project_slug
    );
$$;

create or replace function public.list_my_favorite_projects()
returns setof public.public_profile_projects
language sql
stable
security definer
set search_path = ''
as $$
  select presentation.*
  from public.project_favorites favorite
  join public.projects project on project.id = favorite.project_id
  join public.public_profile_projects presentation on presentation.slug = project.slug
  where favorite.user_id = (select auth.uid())
  order by favorite.created_at desc;
$$;

create or replace function public.list_public_profile_favorites(p_username text)
returns setof public.public_profile_projects
language sql
stable
security definer
set search_path = ''
as $$
  select presentation.*
  from public.profiles profile
  join public.project_favorites favorite on favorite.user_id = profile.id
  join public.projects project on project.id = favorite.project_id
  join public.public_profile_projects presentation on presentation.slug = project.slug
  where lower(profile.username) = lower(p_username)
    and profile.deleted_at is null
    and profile.show_public_favorites = true
  order by favorite.created_at desc;
$$;

revoke all on function public.set_project_favorite(text, boolean) from public, anon, authenticated;
revoke all on function public.get_project_favorite_state(text) from public, anon, authenticated;
revoke all on function public.list_my_favorite_projects() from public, anon, authenticated;
revoke all on function public.list_public_profile_favorites(text) from public, anon, authenticated;
grant execute on function public.set_project_favorite(text, boolean) to authenticated;
grant execute on function public.get_project_favorite_state(text) to authenticated;
grant execute on function public.list_my_favorite_projects() to authenticated;
grant execute on function public.list_public_profile_favorites(text) to anon, authenticated;

-- Creator updates are a deterministic favorite-notification event. Build one
-- recipient row per user regardless of whether they backed, favorited, or both.
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
  from public.projects project
  where project.slug = p_project_slug
  for update;

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

  insert into public.email_deliveries (dedupe_key, event_type, backing_id, recipient_email)
  select
    'project-update:' || new_update.id::text || ':' || recipient.profile_id::text,
    'project_update',
    recipient.backing_id,
    recipient.email
  from (
    select
      profile.id as profile_id,
      profile.email,
      (
        select backing.id
        from public.backings backing
        where backing.project_id = target_project.id
          and backing.backer_id = profile.id
          and backing.status = 'paid'
          and coalesce(backing.refund_amount, 0) < backing.gross_amount
        order by backing.paid_at, backing.id
        limit 1
      ) as backing_id
    from public.profiles profile
    where profile.id <> actor_id
      and profile.deleted_at is null
      and nullif(btrim(coalesce(profile.email, '')), '') is not null
      and (
        (
          profile.receive_project_updates = true
          and exists (
            select 1 from public.backings backing
            where backing.project_id = target_project.id
              and backing.backer_id = profile.id
              and backing.status = 'paid'
              and coalesce(backing.refund_amount, 0) < backing.gross_amount
          )
        )
        or (
          profile.receive_favorite_project_updates = true
          and exists (
            select 1 from public.project_favorites favorite
            where favorite.project_id = target_project.id
              and favorite.user_id = profile.id
          )
        )
      )
  ) recipient
  on conflict (dedupe_key) do nothing;

  return query select new_update.id, new_update.title, new_update.body,
    new_update.image_path, new_update.published_at, new_update.updated_at, true;
end;
$$;

revoke all on function public.create_project_update(text,text,text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.create_project_update(text,text,text,text,uuid)
  to authenticated;
