-- ================================================================
-- Phase 1 Schema Updates - CLEAN VERSION
-- Drop incomplete tables first, then recreate properly
-- ================================================================

-- 1. orders: add new columns (safe, IF NOT EXISTS)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS conversation_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS quantity TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS variants TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'promptpay';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tax_invoice TEXT;

-- 2. conversations: add customer_note + customer_tag (safe)
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS customer_note TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS customer_tag TEXT;

-- 3. promotions: drop old (if broken) then recreate clean
DROP TABLE IF EXISTS public.promotions CASCADE;

CREATE TABLE public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT DEFAULT 'percent',
  discount_value NUMERIC DEFAULT 0,
  min_purchase NUMERIC DEFAULT 0,
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  code TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promotions_select" ON public.promotions FOR SELECT
  USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "promotions_insert" ON public.promotions FOR INSERT
  WITH CHECK (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "promotions_update" ON public.promotions FOR UPDATE
  USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "promotions_delete" ON public.promotions FOR DELETE
  USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));

-- 4. leads: drop old (if broken) then recreate clean
DROP TABLE IF EXISTS public.leads CASCADE;

CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  customer_name TEXT DEFAULT 'ลูกค้า LINE',
  product_name TEXT,
  source TEXT DEFAULT 'LINE',
  status TEXT DEFAULT 'new',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(shop_id, user_id)
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_select" ON public.leads FOR SELECT
  USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "leads_insert" ON public.leads FOR INSERT
  WITH CHECK (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "leads_update" ON public.leads FOR UPDATE
  USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));

-- Done!
SELECT 'Phase 1 schema applied successfully' AS result;