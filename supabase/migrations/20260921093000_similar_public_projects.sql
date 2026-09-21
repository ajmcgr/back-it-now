-- Add only public-safe ranking signals to the existing canonical project
-- presentation. Funding totals remain the authoritative stored values; recent
-- activity is derived solely from legitimate paid backings.
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
  p.gallery_media,
  p.category,
  p.external_website,
  p.location,
  p.project_dates,
  (select r.title from public.rewards r where r.project_id = p.id order by r.created_at limit 1) as reward_title,
  (select r.description from public.rewards r where r.project_id = p.id order by r.created_at limit 1) as reward_description,
  (select r.amount from public.rewards r where r.project_id = p.id order by r.created_at limit 1) as reward_amount,
  (select r.total_quantity from public.rewards r where r.project_id = p.id order by r.created_at limit 1) as reward_total_quantity,
  p.gallery_urls,
  p.created_at,
  (
    select max(coalesce(b.paid_at, b.created_at))
    from public.backings b
    where b.project_id = p.id
      and b.status = 'paid'
  ) as latest_backed_at
from public.projects p
join public.profiles pr on pr.id = p.creator_id
where pr.username is not null
  and pr.deleted_at is null
  and p.status = 'live'
  and p.admin_archived_at is null
  and p.admin_suspended_at is null
  and p.creator_archived_at is null;

comment on view public.public_profile_projects is
  'Canonical public live-project presentation. Draft, archived, suspended, deleted-profile, private identity, and payment data are excluded.';

revoke all on public.public_profile_projects from public;
grant select on public.public_profile_projects to anon, authenticated;

create or replace function public.get_similar_projects(
  p_slug text,
  p_limit integer default 3
)
returns setof public.public_profile_projects
language sql
stable
security invoker
set search_path = ''
as $$
  select candidate.*
  from public.public_profile_projects current_project
  join public.public_profile_projects candidate
    on candidate.slug <> current_project.slug
  where current_project.slug = p_slug
  order by
    (candidate.category = current_project.category) desc,
    (candidate.creator_username <> current_project.creator_username) desc,
    candidate.latest_backed_at desc nulls last,
    candidate.successful_backer_count desc,
    candidate.successful_backed_amount desc,
    candidate.created_at desc,
    candidate.slug asc
  limit least(greatest(coalesce(p_limit, 3), 1), 3);
$$;

comment on function public.get_similar_projects(text, integer) is
  'Returns at most three canonical public projects ranked by category, creator diversity, real backing activity, recency, and deterministic slug fallback.';

revoke all on function public.get_similar_projects(text, integer)
  from public, anon, authenticated;
grant execute on function public.get_similar_projects(text, integer)
  to anon, authenticated;
