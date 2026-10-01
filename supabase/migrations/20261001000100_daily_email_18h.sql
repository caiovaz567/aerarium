-- 01/10/2026: the daily email moves from 9h to 18h in São Paulo (21:00 UTC).
-- The bank (through Pluggy) sends its data once a day, between about 11:40 and
-- 17:30: at 9h the email went out before it and had nothing new to tell.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'daily-email'),
  schedule := '0 21 * * *'
);
