-- Public row keys are presentation identifiers, not canonical user/backing IDs.
-- Keep those internal IDs behind the public RPC boundary as well.
create or replace function public.get_public_project_backers(p_slug text)
returns table (
  entry_key text,
  is_private boolean,
  display_name text,
  username text,
  avatar_url text,
  amount integer,
  currency text,
  backed_at timestamptz,
  reward_title text
)
language sql
stable
security definer
set search_path = ''
as $$
  with eligible as (
    select
      backing.id,
      backing.backer_id,
      backing.is_private,
      backing.gross_amount,
      backing.currency,
      coalesce(backing.paid_at, backing.created_at) as backed_at,
      reward.id as reward_id,
      reward.title as reward_title,
      case when profile.deleted_at is null then profile.display_name end as display_name,
      case when profile.deleted_at is null then lower(profile.username) end as username,
      case when profile.deleted_at is null then profile.avatar_url end as avatar_url
    from public.backings backing
    join public.projects project on project.id = backing.project_id
    left join public.profiles profile on profile.id = backing.backer_id
    left join public.rewards reward on reward.id = backing.reward_id
    where project.slug = p_slug
      and project.status in ('live', 'funded', 'completed')
      and project.admin_archived_at is null
      and project.admin_suspended_at is null
      and project.creator_archived_at is null
      and backing.status = 'paid'
  ), grouped as (
    select
      case
        when eligible.is_private then 'private:' || eligible.id::text
        when eligible.backer_id is not null then 'public-user:' || eligible.backer_id::text
        else 'public-backing:' || eligible.id::text
      end as grouping_key,
      bool_or(eligible.is_private) as private_entry,
      sum(eligible.gross_amount)::integer as total_amount,
      min(eligible.currency) as entry_currency,
      max(eligible.backed_at) as latest_backed_at,
      case when bool_or(eligible.is_private) then null else max(eligible.display_name) end as safe_display_name,
      case when bool_or(eligible.is_private) then null else max(eligible.username) end as safe_username,
      case when bool_or(eligible.is_private) then null else max(eligible.avatar_url) end as safe_avatar_url,
      case
        when count(distinct eligible.reward_id) = 1 then max(eligible.reward_title)
        else null
      end as safe_reward_title
    from eligible
    group by
      case
        when eligible.is_private then 'private:' || eligible.id::text
        when eligible.backer_id is not null then 'public-user:' || eligible.backer_id::text
        else 'public-backing:' || eligible.id::text
      end
  )
  select
    case
      when grouped.private_entry then 'private:' || md5(grouped.grouping_key)
      else 'public:' || md5(grouped.grouping_key)
    end,
    grouped.private_entry,
    grouped.safe_display_name,
    grouped.safe_username,
    grouped.safe_avatar_url,
    grouped.total_amount,
    grouped.entry_currency,
    grouped.latest_backed_at,
    grouped.safe_reward_title
  from grouped
  order by grouped.latest_backed_at desc, grouped.grouping_key;
$$;

revoke all on function public.get_public_project_backers(text) from public;
grant execute on function public.get_public_project_backers(text) to anon, authenticated;
