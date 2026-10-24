-- Three server-only functions were still callable by anyone holding the anon key, though
-- their migrations ran "revoke execute ... from public":
--   claim_demo_message, cleanup_demo_shops, run_follow_up_cron
--
-- Supabase's default privileges grant EXECUTE on every new function in public directly to
-- anon and authenticated, not through PUBLIC, so revoking from PUBLIC leaves those grants in
-- place (production check, 25 Oct 2026). Anyone could have used up the demo's daily cap,
-- wiped the sample shops' chats, or fired the follow-up cron at will.
--
-- Revoke from the roles by name. Every new server-only function needs the same:
--   revoke execute on function public.fn(...) from public, anon, authenticated;
--   grant execute on function public.fn(...) to service_role;
-- (npm run schema:check doesn't catch this yet; the production check query below does.)

revoke execute on function public.claim_demo_message(text, int, int) from public, anon, authenticated;
grant execute on function public.claim_demo_message(text, int, int) to service_role;

revoke execute on function public.cleanup_demo_shops(int) from public, anon, authenticated;
grant execute on function public.cleanup_demo_shops(int) to service_role;

-- pg_cron runs the job as postgres
revoke execute on function public.run_follow_up_cron() from public, anon, authenticated;
grant execute on function public.run_follow_up_cron() to postgres, service_role;

-- submit_manual_payment rejects a caller without auth.uid(); signed-out visitors never need it
revoke execute on function public.submit_manual_payment(text, numeric, numeric, numeric, text, text, text) from anon;

-- Check: only get_user_role, get_user_shop_id, handle_new_user and is_superadmin should still
-- say true for anon (RLS policies and the sign-up trigger use them).
select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
       has_function_privilege('service_role', p.oid, 'execute') as service_role
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
where p.prosecdef
order by 2 desc, 3 desc, 1;
