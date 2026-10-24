-- profiles (a table left from the earlier version of the app) had "Users update own profile":
-- UPDATE USING (id = auth.uid()) with no WITH CHECK and no column limit. A signed-in user with a
-- row there could set their own role to 'superadmin' or point shop_id at another shop, and
-- is_superadmin() / get_user_shop_id() read exactly those columns: the bookings policy
-- ("is_superadmin() OR shop_id = get_user_shop_id()") would then open every shop's bookings.
--
-- Nothing in the app writes profiles (src/ never touches it; sign-up writes public.users), so
-- signed-in users lose write access to it entirely. Reading their own row stays as it was, and
-- the service role keeps full access.
--
-- Safe to re-run.

drop policy if exists "Users update own profile" on public.profiles;

revoke insert, update, delete, truncate on table public.profiles from anon, authenticated;
grant select, insert, update, delete on table public.profiles to service_role;

-- Check: should list only "Superadmin full access to profiles" and "Users read own profile"
select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'profiles';
