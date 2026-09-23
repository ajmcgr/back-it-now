create extension if not exists pg_trgm with schema extensions;

create index if not exists projects_public_search_trgm_idx
  on public.projects using gin (
    (lower(
      coalesce(name, '') || ' ' ||
      coalesce(summary, '') || ' ' ||
      coalesce(description, '')
    )) extensions.gin_trgm_ops
  );

create index if not exists profiles_public_search_trgm_idx
  on public.profiles using gin (
    (lower(
      coalesce(display_name, '') || ' ' ||
      coalesce(username, '')
    )) extensions.gin_trgm_ops
  );

create or replace function public.search_public_marketplace(
  p_query text,
  p_project_limit integer default 5,
  p_creator_limit integer default 3
)
returns table (
  result_type text,
  slug text,
  username text,
  title text,
  subtitle text,
  image_url text
)
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  with normalized as (
    select left(lower(btrim(coalesce(p_query, ''))), 100) as query
  ), parameters as (
    select
      query,
      '%' ||
        replace(replace(replace(query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') ||
        '%' as pattern
    from normalized
  ), project_matches as (
    select
      'project'::text as result_type,
      project.slug,
      project.creator_username as username,
      project.name as title,
      coalesce(
        nullif(btrim(project.summary), ''),
        left(btrim(coalesce(project.description, '')), 160),
        ''
      ) as subtitle,
      project.image_url,
      case
        when lower(project.name) = parameters.query then 0
        when left(lower(project.name), length(parameters.query)) = parameters.query then 1
        else 2
      end as relevance
    from public.public_profile_projects project
    cross join parameters
    where length(parameters.query) >= 2
      and (
        lower(
          coalesce(project.name, '') || ' ' ||
          coalesce(project.summary, '') || ' ' ||
          coalesce(project.description, '')
        ) like parameters.pattern escape E'\\'
      )
    order by relevance, project.created_at desc nulls last, project.slug
    limit least(greatest(coalesce(p_project_limit, 5), 0), 5)
  ), creator_matches as (
    select
      'creator'::text as result_type,
      null::text as slug,
      profile.username,
      coalesce(nullif(btrim(profile.display_name), ''), profile.username) as title,
      '@' || profile.username as subtitle,
      profile.avatar_url as image_url,
      case
        when lower(profile.username) = parameters.query then 0
        when lower(coalesce(profile.display_name, '')) = parameters.query then 1
        when left(lower(profile.username), length(parameters.query)) = parameters.query then 2
        when left(lower(coalesce(profile.display_name, '')), length(parameters.query)) = parameters.query then 3
        else 4
      end as relevance
    from public.public_profiles profile
    cross join parameters
    where length(parameters.query) >= 2
      and lower(
        coalesce(profile.display_name, '') || ' ' ||
        coalesce(profile.username, '')
      ) like parameters.pattern escape E'\\'
    order by relevance, profile.username
    limit least(greatest(coalesce(p_creator_limit, 3), 0), 3)
  )
  select result_type, slug, username, title, subtitle, image_url
  from (
    select 0 as section_order, project.* from project_matches project
    union all
    select 1 as section_order, creator.* from creator_matches creator
  ) result
  order by result.section_order, result.relevance, lower(result.title);
$$;

comment on function public.search_public_marketplace(text, integer, integer) is
  'Searches only canonical public project and profile views and returns display-safe marketplace fields.';

revoke all on function public.search_public_marketplace(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.search_public_marketplace(text, integer, integer)
  to anon, authenticated;
