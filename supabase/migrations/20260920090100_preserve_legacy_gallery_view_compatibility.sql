-- Keep the deprecated gallery_urls projection available while the currently
-- published frontend rolls forward. New application code writes and reads the
-- canonical ordered gallery_media field.
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
