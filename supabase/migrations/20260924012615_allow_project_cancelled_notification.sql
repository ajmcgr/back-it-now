alter table public.notifications
  drop constraint notifications_event_type_check;

alter table public.notifications
  add constraint notifications_event_type_check check (
    event_type in (
      'project_launch',
      'project_update',
      'creator_follow',
      'project_backing',
      'project_comment',
      'project_cancelled'
    )
  );
