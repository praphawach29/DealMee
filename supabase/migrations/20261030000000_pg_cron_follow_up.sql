-- Scheduled jobs move from GitHub Actions into the database.
--
-- Why: the repo is private, so a 5-minute schedule costs ~8,640 Actions minutes a month
-- against a 2,000-minute free quota. The quota ran out and GitHub stopped starting the
-- job ("recent account payments have failed or your spending limit needs to be
-- increased", 24 Oct 2026) — which silently stopped payment reminders, pending-order
-- expiry, wallet renewals, trial reminders and the admin-pause expiry.
--
-- pg_cron calls the same endpoint (/api/cron/follow-up) over pg_net every 5 minutes.
-- The app keeps the logic; the database only pulls the trigger.
--
-- ⚠️ SETUP — run these two statements once in the SQL editor before (or right after)
-- this migration. The values never live in git:
--   select vault.create_secret('https://app.dealmee.app', 'dealmee_app_url');
--   select vault.create_secret('<CRON_SECRET จาก Vercel>', 'dealmee_cron_secret');
-- To change one later: select vault.update_secret(id, new_secret) -- id from vault.secrets
--
-- Checking it works:
--   select * from cron.job where jobname = 'dealmee-follow-up';
--   select * from cron.job_run_details order by start_time desc limit 10;   -- did it fire
--   select status_code, content from net._http_response order by created desc limit 5;  -- what the app answered

create extension if not exists pg_cron;
create extension if not exists pg_net;

grant usage on schema cron to postgres;

/**
 * Calls the app's follow-up endpoint with the shared secret. Returns the pg_net request
 * id (the call itself is asynchronous; the answer lands in net._http_response).
 * Does nothing but warn when the Vault secrets are missing, so a half-finished setup
 * never fires an unauthenticated request.
 */
create or replace function public.run_follow_up_cron()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app_url text;
  v_secret text;
  v_request_id bigint;
begin
  select decrypted_secret into v_app_url from vault.decrypted_secrets where name = 'dealmee_app_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'dealmee_cron_secret';

  if v_app_url is null or v_secret is null then
    raise warning '[follow-up cron] dealmee_app_url or dealmee_cron_secret is missing from Vault; nothing was called';
    return null;
  end if;

  select net.http_post(
    url := rtrim(v_app_url, '/') || '/api/cron/follow-up',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object('source', 'pg_cron'),
    -- The endpoint runs up to 60s (maxDuration); give it room rather than cutting it off
    timeout_milliseconds := 55000
  ) into v_request_id;

  return v_request_id;
end;
$$;

-- Only the scheduler runs this. It holds the secret, so no app role may call it.
revoke execute on function public.run_follow_up_cron() from public;
grant execute on function public.run_follow_up_cron() to postgres;

-- Re-running this migration re-schedules rather than adding a second job
select cron.unschedule('dealmee-follow-up')
where exists (select 1 from cron.job where jobname = 'dealmee-follow-up');

select cron.schedule('dealmee-follow-up', '*/5 * * * *', $job$select public.run_follow_up_cron()$job$);
