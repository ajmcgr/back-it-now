create or replace function public.get_public_discovery_projects(
  p_sort text default 'latest',
  p_limit integer default 60,
  p_offset integer default 0
)
returns setof public.public_profile_projects
language sql
stable
security invoker
set search_path = ''
as $$
  select project.*
  from public.public_profile_projects project
  where
    case
      when p_sort = 'most-backed' then project.status = 'live'
      when p_sort = 'ending-soon' then
        project.status = 'live'
        and project.deadline_at is not null
        and project.deadline_at > now()
      else project.status in ('prelaunch', 'live')
    end
  order by
    case when p_sort = 'popular' then project.favorite_count end desc nulls last,
    case when p_sort = 'popular' then project.latest_backed_at end desc nulls last,
    case when p_sort in ('popular', 'latest') then project.created_at end desc nulls last,
    case when p_sort = 'most-backed'
      then project.initial_backed_amount + project.successful_backed_amount
    end desc nulls last,
    case when p_sort = 'most-backed' then project.successful_backer_count end desc nulls last,
    case when p_sort = 'ending-soon' then project.deadline_at end asc nulls last,
    project.created_at desc nulls last,
    project.slug asc
  limit least(greatest(coalesce(p_limit, 60), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

comment on function public.get_public_discovery_projects(text, integer, integer) is
  'Returns canonical public projects using the shared Popular, Latest, Most Backed, or Ending Soon marketplace ordering.';

revoke all on function public.get_public_discovery_projects(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.get_public_discovery_projects(text, integer, integer)
  to anon, authenticated;
