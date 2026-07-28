-- ================================================================
-- Phase 2 Schema Updates - Billing & Monetization
-- Stripe (recurring subscription) + Omise/Opn Payments (PromptPay)
-- ================================================================

-- 1. shops: billing/subscription columns
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS plan_key TEXT DEFAULT 'free';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS subscription_provider TEXT; -- 'stripe' | 'omise' | null
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS subscription_id TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS omise_customer_id TEXT;

-- backfill plan_key from existing shops.plan so nothing regresses
UPDATE public.shops SET plan_key = plan WHERE plan IS NOT NULL AND (plan_key IS NULL OR plan_key = 'free');

-- 2. plans: stripe price id mapping (nullable)
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

-- 3. usage_logs: per-shop, per-month message/token counters
CREATE TABLE IF NOT EXISTS public.usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  period TEXT NOT NULL, -- 'YYYY-MM'
  messages_used INTEGER NOT NULL DEFAULT 0,
  tokens_used BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(shop_id, period)
);

ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usage_logs_select" ON public.usage_logs FOR SELECT
  USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));

-- NOTE: no insert/update policy for the authenticated role — all writes go
-- through the increment_usage() RPC executed via the service-role client,
-- which bypasses RLS. Shop owners must never be able to inflate/reset usage.

-- 4. billing_payments: provider-agnostic payment history (Omise has no
--    customer portal like Stripe, so history must be tracked locally)
CREATE TABLE IF NOT EXISTS public.billing_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'stripe' | 'omise'
  plan_key TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'THB',
  status TEXT NOT NULL, -- 'succeeded' | 'failed' | 'pending'
  provider_ref TEXT, -- stripe session/invoice id, or omise charge id
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_payments_select" ON public.billing_payments FOR SELECT
  USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));

-- writes: service-role only (webhooks), same rationale as usage_logs.

-- 5. atomic usage increment function (avoids read-modify-write races
--    under concurrent webhook invocations)
CREATE OR REPLACE FUNCTION public.increment_usage(
  p_shop_id UUID, p_period TEXT, p_messages INT, p_tokens BIGINT
) RETURNS void AS $$
BEGIN
  INSERT INTO public.usage_logs (shop_id, period, messages_used, tokens_used)
  VALUES (p_shop_id, p_period, p_messages, p_tokens)
  ON CONFLICT (shop_id, period) DO UPDATE
    SET messages_used = public.usage_logs.messages_used + excluded.messages_used,
        tokens_used = public.usage_logs.tokens_used + excluded.tokens_used,
        updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Phase 2 billing schema applied successfully' AS result;
