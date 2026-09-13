-- ==============================================================================
-- CheckMee-Style PromptPay & Billing Migration
-- Platform billing settings, slip verification, receipt numbering, and RPCs
-- ==============================================================================

-- Ensure users table has role column
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'admin';

-- Ensure shops table has billing/subscription columns
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS plan_key TEXT DEFAULT 'free';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS subscription_provider TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;

-- Ensure billing_payments table exists before altering
CREATE TABLE IF NOT EXISTS public.billing_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'promptpay',
  plan_key TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'THB',
  status TEXT NOT NULL DEFAULT 'pending',
  provider_ref TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "billing_payments_select" ON public.billing_payments;
CREATE POLICY "billing_payments_select" ON public.billing_payments FOR SELECT
  USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));

-- 1. Platform Billing Settings (Single-row configuration for platform owner)
CREATE TABLE IF NOT EXISTS public.platform_billing_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name TEXT NOT NULL DEFAULT 'Botify AI Platform',
  promptpay_id TEXT NOT NULL DEFAULT '0812345678',
  bank_name TEXT DEFAULT 'ธนาคารกสิกรไทย (KBANK)',
  bank_account_number TEXT,
  is_vat_registered BOOLEAN NOT NULL DEFAULT false,
  payee_tax_id TEXT DEFAULT '0105567000000',
  company_address TEXT DEFAULT 'กรุงเทพมหานคร ประเทศไทย',
  company_phone TEXT DEFAULT '02-000-0000',
  company_email TEXT DEFAULT 'billing@botify.ai',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default row if not exists
INSERT INTO public.platform_billing_settings (id, account_name, promptpay_id, is_vat_registered)
SELECT gen_random_uuid(), 'Botify AI Platform', '0812345678', false
WHERE NOT EXISTS (SELECT 1 FROM public.platform_billing_settings);

-- Enable RLS
ALTER TABLE public.platform_billing_settings ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read billing settings (to display PromptPay QR and payee info)
DROP POLICY IF EXISTS "platform_billing_settings_select" ON public.platform_billing_settings;
CREATE POLICY "platform_billing_settings_select" ON public.platform_billing_settings
  FOR SELECT TO authenticated USING (true);

-- Allow superadmins to update billing settings (checks role or admin emails)
DROP POLICY IF EXISTS "platform_billing_settings_update" ON public.platform_billing_settings;
CREATE POLICY "platform_billing_settings_update" ON public.platform_billing_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
        AND (
          role = 'superadmin' 
          OR email IN ('praphawach@gmail.com', 'admin@botify.ai', 'jack291625@gmail.com')
        )
    )
  );


-- 2. Enhance billing_payments table with CheckMee fields
ALTER TABLE public.billing_payments ADD COLUMN IF NOT EXISTS slip_url TEXT;
ALTER TABLE public.billing_payments ADD COLUMN IF NOT EXISTS slip_reference TEXT;
ALTER TABLE public.billing_payments ADD COLUMN IF NOT EXISTS billed_amount NUMERIC;
ALTER TABLE public.billing_payments ADD COLUMN IF NOT EXISTS withheld_amount NUMERIC DEFAULT 0;
ALTER TABLE public.billing_payments ADD COLUMN IF NOT EXISTS transferred_amount NUMERIC;
ALTER TABLE public.billing_payments ADD COLUMN IF NOT EXISTS receipt_number TEXT;
ALTER TABLE public.billing_payments ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE public.billing_payments ADD COLUMN IF NOT EXISTS verified_by UUID;
ALTER TABLE public.billing_payments ADD COLUMN IF NOT EXISTS rejected_reason TEXT;
ALTER TABLE public.billing_payments ADD COLUMN IF NOT EXISTS customer_notes TEXT;

-- Backfill amounts for legacy rows
UPDATE public.billing_payments 
SET billed_amount = amount, transferred_amount = amount 
WHERE billed_amount IS NULL AND amount IS NOT NULL;

-- Partial unique index on slip_reference (CheckMee Trap #2 & #3 prevention):
-- Prevents duplicate slip submission, but frees up the reference if rejected!
DROP INDEX IF EXISTS idx_billing_payments_slip_reference;
CREATE UNIQUE INDEX idx_billing_payments_slip_reference 
ON public.billing_payments (slip_reference) 
WHERE slip_reference IS NOT NULL AND status != 'rejected';

CREATE INDEX IF NOT EXISTS idx_billing_payments_shop_status 
ON public.billing_payments (shop_id, status);

CREATE INDEX IF NOT EXISTS idx_billing_payments_created_at 
ON public.billing_payments (created_at DESC);


-- 3. Receipt Number Sequence & Generator
CREATE SEQUENCE IF NOT EXISTS public.receipt_number_seq START WITH 1001;

CREATE OR REPLACE FUNCTION public.next_receipt_number()
RETURNS TEXT AS $$
DECLARE
  v_seq BIGINT;
  v_period TEXT;
BEGIN
  v_seq := nextval('public.receipt_number_seq');
  v_period := to_char(now(), 'YYYYMM');
  RETURN 'REC-' || v_period || '-' || LPAD(v_seq::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke direct execution from public and anon
REVOKE ALL ON FUNCTION public.next_receipt_number() FROM PUBLIC, anon;


-- 4. CheckMee RPC: submit_manual_payment (Merchant initiates payment)
-- Security: shop_id is derived strictly from session (auth.uid()), never from arguments!
CREATE OR REPLACE FUNCTION public.submit_manual_payment(
  p_plan_key TEXT,
  p_billed_amount NUMERIC,
  p_withheld_amount NUMERIC,
  p_transferred_amount NUMERIC,
  p_slip_url TEXT,
  p_slip_reference TEXT,
  p_customer_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_shop_id UUID;
  v_payment_id UUID;
BEGIN
  -- Derive shop_id from authenticated user session
  SELECT workspace_id INTO v_shop_id 
  FROM public.users 
  WHERE id = auth.uid();

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User does not belong to an active shop.';
  END IF;

  -- Create payment row in pending state
  INSERT INTO public.billing_payments (
    shop_id,
    provider,
    plan_key,
    amount,
    billed_amount,
    withheld_amount,
    transferred_amount,
    currency,
    status,
    slip_url,
    slip_reference,
    customer_notes,
    created_at
  ) VALUES (
    v_shop_id,
    'promptpay',
    p_plan_key,
    p_transferred_amount,
    p_billed_amount,
    COALESCE(p_withheld_amount, 0),
    p_transferred_amount,
    'THB',
    'pending',
    p_slip_url,
    p_slip_reference,
    p_customer_notes,
    now()
  )
  RETURNING id INTO v_payment_id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'status', 'pending'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. CheckMee RPC: verify_manual_payment (Auto or Admin verification)
-- Concurrency: FOR UPDATE row lock to prevent double-confirmations
CREATE OR REPLACE FUNCTION public.verify_manual_payment(
  p_payment_id UUID,
  p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_payment RECORD;
  v_receipt_no TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Lock row to prevent race conditions (Trap #4 prevention)
  SELECT * INTO v_payment
  FROM public.billing_payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment record % not found', p_payment_id;
  END IF;

  IF v_payment.status = 'verified' OR v_payment.status = 'succeeded' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_verified', true,
      'receipt_number', v_payment.receipt_number
    );
  END IF;

  -- Generate receipt number
  v_receipt_no := public.next_receipt_number();

  -- Calculate 30-day extension from now or existing expiry
  SELECT CASE 
    WHEN plan_expires_at > now() THEN plan_expires_at + interval '30 days'
    ELSE now() + interval '30 days'
  END INTO v_expires_at
  FROM public.shops
  WHERE id = v_payment.shop_id;

  -- Update payment status
  UPDATE public.billing_payments
  SET status = 'verified',
      receipt_number = v_receipt_no,
      verified_at = now(),
      verified_by = p_admin_id
  WHERE id = p_payment_id;

  -- Update shop package and extension
  UPDATE public.shops
  SET plan_key = v_payment.plan_key,
      plan = v_payment.plan_key,
      subscription_provider = 'promptpay',
      subscription_status = 'active',
      plan_expires_at = v_expires_at,
      updated_at = now()
  WHERE id = v_payment.shop_id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'receipt_number', v_receipt_no,
    'plan_key', v_payment.plan_key,
    'plan_expires_at', v_expires_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. CheckMee RPC: reject_manual_payment (Admin rejects invalid slip)
-- Concurrency: FOR UPDATE row lock; clears slip_reference so user can re-upload!
CREATE OR REPLACE FUNCTION public.reject_manual_payment(
  p_payment_id UUID,
  p_reason TEXT,
  p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_payment RECORD;
BEGIN
  SELECT * INTO v_payment
  FROM public.billing_payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment record % not found', p_payment_id;
  END IF;

  -- Trap #3 fix: clear slip_reference so user can retry with the same or new reference!
  UPDATE public.billing_payments
  SET status = 'rejected',
      rejected_reason = p_reason,
      slip_reference = NULL,
      verified_by = p_admin_id,
      verified_at = now()
  WHERE id = p_payment_id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'status', 'rejected',
    'reason', p_reason
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. Storage Bucket & Policies for payment-slips
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-slips', 'payment-slips', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: Anyone authenticated can upload to payment-slips
DROP POLICY IF EXISTS "payment_slips_insert" ON storage.objects;
CREATE POLICY "payment_slips_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-slips');

-- Storage policy: Public read for verification display
DROP POLICY IF EXISTS "payment_slips_select" ON storage.objects;
CREATE POLICY "payment_slips_select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'payment-slips');

-- Trap #5: NO update or delete policy for regular users on payment-slips!

GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
