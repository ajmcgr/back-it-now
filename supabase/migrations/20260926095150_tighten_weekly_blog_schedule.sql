select cron.unschedule('backed-weekly-blog-publisher');

-- Poll the due gate frequently enough to publish within ten minutes of the
-- seven-day target and to retry transient failures without waiting a day.
select cron.schedule(
  'backed-weekly-blog-publisher',
  '*/10 * * * *',
  $$select private.invoke_blog_publisher('weekly');$$
);
