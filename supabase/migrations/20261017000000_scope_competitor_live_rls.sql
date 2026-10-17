-- ================================================================
-- Migration: 20261017000000_scope_competitor_live_rls.sql
-- Description: Replace the open USING (true) policies on the competitor
-- intelligence and live studio tables with policies scoped to the
-- signed-in merchant's own shop.
--
-- The app's API routes use the service-role client, which bypasses RLS,
-- so this only closes direct access through the public anon/auth keys.
--
-- Shop membership follows the rest of the schema (public.users.workspace_id).
-- shops.owner_id is added to the check only when that column exists, since
-- not every deployed database has it.
-- ================================================================

DO $$
DECLARE
  t TEXT;
  shop_scope TEXT := 'shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())';
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shops' AND column_name = 'owner_id'
  ) THEN
    shop_scope := shop_scope || ' OR shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())';
  END IF;
  shop_scope := '(' || shop_scope || ')';

  DROP POLICY IF EXISTS "Users can view their shop competitors" ON public.competitors;
  DROP POLICY IF EXISTS "Users can view their shop competitor posts" ON public.competitor_posts;
  DROP POLICY IF EXISTS "Users can view live sessions" ON public.live_sessions;
  DROP POLICY IF EXISTS "Users can view live baskets" ON public.live_baskets;
  DROP POLICY IF EXISTS "Users can view live comments" ON public.live_comments;

  FOREACH t IN ARRAY ARRAY['competitors', 'competitor_posts', 'live_sessions', 'live_baskets', 'live_comments']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Shop members manage own rows', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING %s WITH CHECK %s',
      'Shop members manage own rows', t, shop_scope, shop_scope
    );
  END LOOP;
END $$;
