-- One row per payment slip that settled an order. The unique (shop_id, trans_ref)
-- index stops the same slip being used for two orders, even when two deliveries of
-- it are processed at the same moment (src/lib/slip/settleSlip.ts).
CREATE TABLE IF NOT EXISTS public.payment_slips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  trans_ref text NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  provider text,
  amount numeric(12, 2),
  platform text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, trans_ref)
);

CREATE INDEX IF NOT EXISTS payment_slips_order_id_idx ON public.payment_slips (order_id);

-- Written only by the server (service role); shop owners may read their own shop's slips
ALTER TABLE public.payment_slips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_slips_select_own_shop" ON public.payment_slips;
CREATE POLICY "payment_slips_select_own_shop" ON public.payment_slips
  FOR SELECT USING (
    shop_id IN (SELECT u.workspace_id FROM public.users u WHERE u.id = auth.uid())
  );

-- Slips that settled orders before this table existed (tagged in orders.note)
INSERT INTO public.payment_slips (shop_id, trans_ref, order_id, provider, platform, created_at)
SELECT o.shop_id,
       substring(o.note FROM '\[slip-ref:([^\]]+)\]'),
       o.id,
       'legacy',
       'line',
       o.updated_at
FROM public.orders o
WHERE o.note LIKE '%[slip-ref:%'
  AND substring(o.note FROM '\[slip-ref:([^\]]+)\]') IS NOT NULL
ON CONFLICT (shop_id, trans_ref) DO NOTHING;
