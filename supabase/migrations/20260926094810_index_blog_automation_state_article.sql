create index if not exists blog_automation_state_article_id_idx
  on private.blog_automation_state (article_id)
  where article_id is not null;
