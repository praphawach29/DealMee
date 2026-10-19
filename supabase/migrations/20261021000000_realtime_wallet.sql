-- Push wallet and payment changes to the billing page (Supabase Realtime), so a
-- shop sees its balance move without reloading. RLS still decides who receives
-- which rows: shop_wallets_select / billing_payments_select limit them to the shop.
-- Safe to run more than once.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['shop_wallets', 'billing_payments'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
