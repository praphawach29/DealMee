-- submit_manual_payment still read true for anon after 20261102000100: the grant came through
-- PUBLIC, so revoking from anon alone changed nothing (production check, 25 Oct 2026).
-- The function already rejects a caller without auth.uid(); this just stops signed-out
-- visitors reaching it at all. Signed-in shop owners keep it.
revoke execute on function public.submit_manual_payment(text, numeric, numeric, numeric, text, text, text) from public, anon;
grant execute on function public.submit_manual_payment(text, numeric, numeric, numeric, text, text, text) to authenticated, service_role;
