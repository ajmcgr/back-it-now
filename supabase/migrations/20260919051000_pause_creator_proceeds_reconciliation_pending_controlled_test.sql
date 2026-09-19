-- Do not let an automatic process allocate funds from pre-existing production records.
-- This job is enabled only after the first controlled live backing review.
select cron.unschedule(jobid) from cron.job where jobname = 'backed-creator-proceeds-reconciliation';
