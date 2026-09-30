-- Fase 14.3 (29/09/2026): the daily email at 9h, for the Open Finance owner.
-- The switch lives in user_settings. The Edge Function daily-email writes
-- private.daily_email itself when the switch is turned on (its address and a
-- secret for the job below), so nothing is set up by hand. What was already
-- told stays in private.emailed_transactions (never repeated).
alter table public.user_settings add column daily_email boolean not null default false;

create table private.daily_email (
  id int primary key default 1 check (id = 1),
  url text not null check (url ~ '^https://'),
  secret text not null check (length(secret) >= 32)
);
alter table private.daily_email enable row level security;
revoke all on private.daily_email from public, anon, authenticated;

create table private.emailed_transactions (
  user_id uuid not null references auth.users on delete cascade,
  external_id text not null check (length(external_id) between 1 and 120),
  sent_at timestamptz not null default now(),
  primary key (user_id, external_id)
);
alter table private.emailed_transactions enable row level security;
revoke all on private.emailed_transactions from public, anon, authenticated;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- Every day at 12:00 UTC (9h in São Paulo). Until the switch is first turned
-- on there is no address, and the job does nothing.
select cron.schedule(
  'daily-email',
  '0 12 * * *',
  $job$
    select net.http_post(
      url := config.url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-daily-email', config.secret
      ),
      body := '{"action":"send"}'::jsonb,
      timeout_milliseconds := 60000
    )
    from private.daily_email config
  $job$
);
