-- Orders belong to one shop.
--
-- A signed-in merchant may insert, read, or update an order only when shop_id is
-- their users.workspace_id. If workspace_id is set on the row, it must be that
-- same shop. A row whose two ids point at different shops cannot be written.
-- Deletes stay closed for anon and authenticated (no DELETE policy). The service
-- role still bypasses RLS for the app's own writes, and the CHECK constraint
-- applies to it too.
--
-- This script does not delete or rewrite rows. If any existing row has shop_id
-- and workspace_id set to different shops, it stops and names those ids.
-- Safe to run more than once after that is resolved.
--
-- Inspect conflicts before re-running:
--   SELECT id, shop_id, workspace_id
--   FROM public.orders
--   WHERE shop_id IS NOT NULL
--     AND workspace_id IS NOT NULL
--     AND shop_id IS DISTINCT FROM workspace_id;

DO $$
DECLARE
  n int;
  sample text;
  has_workspace boolean;
  own_expr text;
  pol record;
BEGIN
  IF to_regclass('public.orders') IS NULL THEN
    RAISE EXCEPTION 'orders isolation stopped: public.orders does not exist. No data was changed.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'workspace_id'
  ) INTO has_workspace;

  IF has_workspace THEN
    SELECT count(*) INTO n
    FROM public.orders
    WHERE shop_id IS NOT NULL
      AND workspace_id IS NOT NULL
      AND shop_id IS DISTINCT FROM workspace_id;

    IF n > 0 THEN
      SELECT string_agg(id::text, ', ') INTO sample
      FROM (
        SELECT id
        FROM public.orders
        WHERE shop_id IS NOT NULL
          AND workspace_id IS NOT NULL
          AND shop_id IS DISTINCT FROM workspace_id
        ORDER BY created_at NULLS LAST
        LIMIT 20
      ) t;

      RAISE EXCEPTION
        'orders isolation stopped: % row(s) have shop_id and workspace_id pointing at different shops. No policies or rows were changed. Inspect with SELECT id, shop_id, workspace_id FROM public.orders WHERE shop_id IS NOT NULL AND workspace_id IS NOT NULL AND shop_id IS DISTINCT FROM workspace_id; First ids: %',
        n, coalesce(sample, '(none)');
    END IF;
  ELSE
    RAISE NOTICE 'orders.workspace_id is not present; policies will require shop_id only.';
  END IF;

  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'orders'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.orders', pol.policyname);
  END LOOP;

  EXECUTE 'ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY';

  IF has_workspace THEN
    EXECUTE 'ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_shop_workspace_same';
    EXECUTE 'ALTER TABLE public.orders ADD CONSTRAINT orders_shop_workspace_same CHECK (workspace_id IS NULL OR workspace_id = shop_id)';
    own_expr := 'shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()) AND (workspace_id IS NULL OR workspace_id = shop_id)';
  ELSE
    own_expr := 'shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())';
  END IF;

  EXECUTE format('CREATE POLICY orders_select_own_shop ON public.orders FOR SELECT USING (%s)', own_expr);
  EXECUTE format('CREATE POLICY orders_insert_own_shop ON public.orders FOR INSERT WITH CHECK (%s)', own_expr);
  EXECUTE format('CREATE POLICY orders_update_own_shop ON public.orders FOR UPDATE USING (%s) WITH CHECK (%s)', own_expr, own_expr);
END $$;

SELECT 'orders tenant isolation applied successfully' AS result;
