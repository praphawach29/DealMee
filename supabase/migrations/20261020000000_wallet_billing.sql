-- ==============================================================================
-- Prepaid wallet billing (decided 2026-10-19)
--
-- Shops top up a wallet by PromptPay transfer + slip (auto-checked through the
-- existing billing_payments / verify_manual_payment flow), then buy the monthly
-- plan and add-on packs from the balance. A plan bought from the wallet renews
-- itself from the balance when it ends (follow-up cron); a shop whose balance
-- falls short keeps the plan for a 3-day grace period, then drops to Free.
--
-- New prices: Starter 590 / Pro 1,690 / Business 4,490 / BYOK 790, with a
-- monthly slip-check allowance per plan. Add-on packs (messages, slip checks)
-- are used only after the month's plan allowance runs out and last 90 days.
--
-- Also closes holes that let a signed-in merchant change billing state through
-- the REST API: shops' plan columns, users.role / workspace_id, the plans table,
-- and the billing RPCs were all writable or callable by any authenticated user.
--
-- Safe to run more than once.
-- ==============================================================================

-- 0. Columns the code already relies on (some were added by hand in production)
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS plan_key TEXT DEFAULT 'free';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS subscription_provider TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS subscription_id TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'admin';

-- ------------------------------------------------------------------------------
-- 1. Merchants may not change billing state on their own rows
-- ------------------------------------------------------------------------------
-- RLS lets a shop owner update their shop and their user row, which covers every
-- column. These triggers refuse billing-related changes from the authenticated
-- (browser) role; server code that needs them uses the service role.

CREATE OR REPLACE FUNCTION public.guard_shop_billing_columns()
RETURNS trigger AS $$
BEGIN
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon') AND (
       NEW.plan IS DISTINCT FROM OLD.plan
    OR NEW.plan_key IS DISTINCT FROM OLD.plan_key
    OR NEW.plan_expires_at IS DISTINCT FROM OLD.plan_expires_at
    OR NEW.trial_expires_at IS DISTINCT FROM OLD.trial_expires_at
    OR NEW.subscription_provider IS DISTINCT FROM OLD.subscription_provider
    OR NEW.subscription_id IS DISTINCT FROM OLD.subscription_id
    OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
  ) THEN
    RAISE EXCEPTION 'Billing fields can only be changed by the billing system' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS guard_shop_billing_columns ON public.shops;
CREATE TRIGGER guard_shop_billing_columns
  BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.guard_shop_billing_columns();

CREATE OR REPLACE FUNCTION public.guard_user_privilege_columns()
RETURNS trigger AS $$
BEGIN
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon') AND (
       NEW.role IS DISTINCT FROM OLD.role
    OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
  ) THEN
    RAISE EXCEPTION 'role and workspace_id can only be changed by the server' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS guard_user_privilege_columns ON public.users;
CREATE TRIGGER guard_user_privilege_columns
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_privilege_columns();

-- plans: readable by everyone, written only by the service role (admin actions)
DROP POLICY IF EXISTS "Super Admin can edit plans" ON public.plans;

-- ------------------------------------------------------------------------------
-- 2. Plans: new prices and a monthly slip-check allowance
-- ------------------------------------------------------------------------------
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS slips INT NOT NULL DEFAULT 0; -- -1 = unlimited

INSERT INTO public.plans (key, name, price, messages, tokens, slips, description, badge_color, features)
VALUES
  ('free', 'Free', 0, 100, 1000000, 0,
   'บอทตอบคำถามลูกค้าได้ ออเดอร์และสลิปส่งให้แอดมินดูแลเอง',
   'bg-surface-container-high text-on-surface',
   ARRAY['ข้อความ AI 100 ข้อความ/เดือน', 'ตอบแชท LINE OA และ Messenger', 'ระบบแชทสด (Inbox)']),
  ('starter', 'Starter', 590, 1000, 5000000, 100,
   'สำหรับร้านเล็กที่เริ่มให้บอทปิดการขาย',
   'bg-electric-blue/10 text-electric-blue border border-electric-blue/20',
   ARRAY['ข้อความ AI 1,000 ข้อความ/เดือน', 'ตรวจสลิปอัตโนมัติ 100 ครั้ง/เดือน', 'รับออเดอร์ ส่ง QR และติดตามการชำระเงิน', 'ใบเสนอราคาและส่วนลด']),
  ('pro', 'Pro', 1690, 3000, 15000000, 300,
   'สำหรับร้านที่มีแชทหนาแน่นและระบบจองคิว',
   'bg-amber-500/10 text-amber-600 border border-amber-500/20 font-bold',
   ARRAY['ข้อความ AI 3,000 ข้อความ/เดือน', 'ตรวจสลิปอัตโนมัติ 300 ครั้ง/เดือน', 'ฟีเจอร์ Starter ทั้งหมด', 'ระบบจองคิวและแจ้งเตือนลูกค้า']),
  ('agency', 'Business', 4490, 8000, 50000000, 1000,
   'สำหรับแบรนด์หรือร้านหลายช่องทางที่มียอดแชทสูง',
   'bg-purple-500/10 text-purple-600 border border-purple-500/20 font-bold',
   ARRAY['ข้อความ AI 8,000 ข้อความ/เดือน', 'ตรวจสลิปอัตโนมัติ 1,000 ครั้ง/เดือน', 'ฟีเจอร์ Pro ทั้งหมด', 'ซัพพอร์ตแบบเร่งด่วน']),
  ('byok', 'BYOK', 790, -1, -1, 300,
   'ใช้ Gemini API Key ของร้านเอง ค่า AI จ่ายตรงกับ Google',
   'bg-success-green/10 text-success-green border border-success-green/20',
   ARRAY['ข้อความ AI ไม่จำกัด (ใช้ API Key ของร้าน)', 'ตรวจสลิปอัตโนมัติ 300 ครั้ง/เดือน', 'ฟีเจอร์ Pro ทั้งหมด'])
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  messages = EXCLUDED.messages,
  slips = EXCLUDED.slips,
  description = EXCLUDED.description,
  badge_color = EXCLUDED.badge_color,
  features = EXCLUDED.features,
  updated_at = now();

-- ------------------------------------------------------------------------------
-- 3. Usage: monthly slip checks made with the platform's slip-provider key
-- ------------------------------------------------------------------------------
ALTER TABLE public.usage_logs ADD COLUMN IF NOT EXISTS slips_used INTEGER NOT NULL DEFAULT 0;

-- ------------------------------------------------------------------------------
-- 4. Wallet, ledger, add-on catalog and purchased add-on credits
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shop_wallets (
  shop_id UUID PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  -- plan_expires_at value each billing notice was last sent for, so the cron
  -- sends each one once per billing cycle
  renewal_notice_for TIMESTAMPTZ,
  lapse_notice_for TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Every balance change, with the balance after it. The balance column above is
-- only ever moved together with a row here (wallet_apply).
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('topup', 'plan', 'renewal', 'plan_credit', 'addon', 'adjust')),
  amount NUMERIC(12,2) NOT NULL, -- + credit, - debit
  balance_after NUMERIC(12,2) NOT NULL,
  payment_id UUID REFERENCES public.billing_payments(id),
  plan_key TEXT,
  addon_key TEXT,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_shop ON public.wallet_transactions (shop_id, created_at DESC);
-- A verified top-up credits the wallet exactly once
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_transactions_topup_once
  ON public.wallet_transactions (payment_id) WHERE kind = 'topup';

CREATE TABLE IF NOT EXISTS public.addon_packs (
  key TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('messages', 'slips')),
  name TEXT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  price NUMERIC(12,2) NOT NULL CHECK (price > 0),
  valid_days INT NOT NULL DEFAULT 90,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.addon_packs (key, kind, name, quantity, price, sort_order) VALUES
  ('msg_500', 'messages', 'ข้อความ AI 500 ข้อความ', 500, 390, 1),
  ('msg_1500', 'messages', 'ข้อความ AI 1,500 ข้อความ', 1500, 990, 2),
  ('msg_5000', 'messages', 'ข้อความ AI 5,000 ข้อความ', 5000, 2990, 3),
  ('slip_100', 'slips', 'ตรวจสลิป 100 ครั้ง', 100, 89, 11),
  ('slip_300', 'slips', 'ตรวจสลิป 300 ครั้ง', 300, 219, 12),
  ('slip_1000', 'slips', 'ตรวจสลิป 1,000 ครั้ง', 1000, 590, 13)
ON CONFLICT (key) DO UPDATE SET
  kind = EXCLUDED.kind,
  name = EXCLUDED.name,
  quantity = EXCLUDED.quantity,
  price = EXCLUDED.price,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.shop_addon_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('messages', 'slips')),
  addon_key TEXT,
  quantity INT NOT NULL,
  remaining INT NOT NULL CHECK (remaining >= 0),
  expires_at TIMESTAMPTZ NOT NULL,
  transaction_id UUID REFERENCES public.wallet_transactions(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_addon_credits_active
  ON public.shop_addon_credits (shop_id, kind, expires_at) WHERE remaining > 0;

-- Merchants read their own rows; every write goes through the RPCs below
ALTER TABLE public.shop_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addon_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_addon_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_wallets_select" ON public.shop_wallets;
CREATE POLICY "shop_wallets_select" ON public.shop_wallets FOR SELECT
  USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "wallet_transactions_select" ON public.wallet_transactions;
CREATE POLICY "wallet_transactions_select" ON public.wallet_transactions FOR SELECT
  USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "addon_packs_select" ON public.addon_packs;
CREATE POLICY "addon_packs_select" ON public.addon_packs FOR SELECT USING (true);

DROP POLICY IF EXISTS "shop_addon_credits_select" ON public.shop_addon_credits;
CREATE POLICY "shop_addon_credits_select" ON public.shop_addon_credits FOR SELECT
  USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));

-- ------------------------------------------------------------------------------
-- 5. Wallet RPCs (service role only)
-- ------------------------------------------------------------------------------

-- Locks the shop's wallet row (creating it on first use) and returns it
CREATE OR REPLACE FUNCTION public.wallet_lock(p_shop_id UUID)
RETURNS public.shop_wallets AS $$
DECLARE
  v_wallet public.shop_wallets;
BEGIN
  INSERT INTO public.shop_wallets (shop_id) VALUES (p_shop_id) ON CONFLICT (shop_id) DO NOTHING;
  SELECT * INTO v_wallet FROM public.shop_wallets WHERE shop_id = p_shop_id FOR UPDATE;
  RETURN v_wallet;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Moves the balance and writes the ledger row; callers lock first (wallet_lock)
CREATE OR REPLACE FUNCTION public.wallet_apply(
  p_shop_id UUID,
  p_amount NUMERIC,
  p_kind TEXT,
  p_description TEXT,
  p_payment_id UUID DEFAULT NULL,
  p_plan_key TEXT DEFAULT NULL,
  p_addon_key TEXT DEFAULT NULL,
  p_actor UUID DEFAULT NULL
) RETURNS public.wallet_transactions AS $$
DECLARE
  v_balance NUMERIC(12,2);
  v_tx public.wallet_transactions;
BEGIN
  UPDATE public.shop_wallets
  SET balance = balance + p_amount, updated_at = now()
  WHERE shop_id = p_shop_id
  RETURNING balance INTO v_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet for shop % not found', p_shop_id;
  END IF;

  INSERT INTO public.wallet_transactions (shop_id, kind, amount, balance_after, payment_id, plan_key, addon_key, description, created_by)
  VALUES (p_shop_id, p_kind, p_amount, v_balance, p_payment_id, p_plan_key, p_addon_key, p_description, p_actor)
  RETURNING * INTO v_tx;

  RETURN v_tx;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Buys (or switches to) a monthly plan from the wallet. Switching from another
-- plan that was bought from the wallet credits back the unused part of it.
CREATE OR REPLACE FUNCTION public.wallet_buy_plan(p_shop_id UUID, p_plan_key TEXT, p_actor UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_wallet public.shop_wallets;
  v_plan RECORD;
  v_shop RECORD;
  v_current TEXT;
  v_old_price NUMERIC;
  v_credit NUMERIC(12,2) := 0;
  v_expires TIMESTAMPTZ;
  v_tx public.wallet_transactions;
BEGIN
  v_wallet := public.wallet_lock(p_shop_id);

  SELECT key, name, price INTO v_plan FROM public.plans WHERE key = p_plan_key;
  IF NOT FOUND OR v_plan.price <= 0 OR p_plan_key IN ('free', 'trial') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_plan');
  END IF;

  SELECT plan, plan_key, plan_expires_at, subscription_provider INTO v_shop
  FROM public.shops WHERE id = p_shop_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'shop_not_found');
  END IF;

  v_current := lower(coalesce(v_shop.plan_key, v_shop.plan, 'free'));

  IF v_current <> p_plan_key AND v_shop.subscription_provider = 'wallet' AND v_shop.plan_expires_at > now() THEN
    SELECT price INTO v_old_price FROM public.plans WHERE key = v_current;
    v_credit := floor(
      coalesce(v_old_price, 0)
      * LEAST(1, extract(epoch FROM (v_shop.plan_expires_at - now())) / (30 * 86400))
      * 100
    ) / 100;
  END IF;

  IF v_wallet.balance + v_credit < v_plan.price THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_balance',
      'balance', v_wallet.balance,
      'credit', v_credit,
      'price', v_plan.price,
      'needed', v_plan.price - v_credit - v_wallet.balance
    );
  END IF;

  IF v_credit > 0 THEN
    PERFORM public.wallet_apply(p_shop_id, v_credit, 'plan_credit',
      'คืนมูลค่าวันที่เหลือของแพ็กเกจ ' || upper(v_current), NULL, v_current, NULL, p_actor);
  END IF;

  v_tx := public.wallet_apply(p_shop_id, -v_plan.price, 'plan',
    'ซื้อแพ็กเกจ ' || v_plan.name || ' 30 วัน', NULL, p_plan_key, NULL, p_actor);

  -- Paying early for the same plan extends it; anything else starts a fresh 30 days
  v_expires := CASE
    WHEN v_current = p_plan_key AND v_shop.subscription_provider = 'wallet' AND v_shop.plan_expires_at > now()
      THEN v_shop.plan_expires_at + interval '30 days'
    ELSE now() + interval '30 days'
  END;

  UPDATE public.shops
  SET plan = p_plan_key,
      plan_key = p_plan_key,
      subscription_provider = 'wallet',
      subscription_status = 'active',
      plan_expires_at = v_expires,
      updated_at = now()
  WHERE id = p_shop_id;

  UPDATE public.shop_wallets
  SET renewal_notice_for = NULL, lapse_notice_for = NULL
  WHERE shop_id = p_shop_id;

  RETURN jsonb_build_object(
    'success', true,
    'plan_key', p_plan_key,
    'plan_expires_at', v_expires,
    'credit', v_credit,
    'charged', v_plan.price,
    'balance', v_tx.balance_after
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Renews a wallet plan that has ended (or ends within 10 minutes), within the
-- 3-day grace period. Run by the follow-up cron.
CREATE OR REPLACE FUNCTION public.wallet_renew_plan(p_shop_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_wallet public.shop_wallets;
  v_shop RECORD;
  v_plan RECORD;
  v_key TEXT;
  v_expires TIMESTAMPTZ;
  v_tx public.wallet_transactions;
BEGIN
  v_wallet := public.wallet_lock(p_shop_id);

  SELECT plan, plan_key, plan_expires_at, subscription_provider INTO v_shop
  FROM public.shops WHERE id = p_shop_id FOR UPDATE;

  IF NOT FOUND OR v_shop.subscription_provider IS DISTINCT FROM 'wallet' OR v_shop.plan_expires_at IS NULL THEN
    RETURN jsonb_build_object('status', 'skipped');
  END IF;
  IF v_shop.plan_expires_at > now() + interval '10 minutes' THEN
    RETURN jsonb_build_object('status', 'not_due');
  END IF;
  IF v_shop.plan_expires_at < now() - interval '3 days' THEN
    RETURN jsonb_build_object('status', 'lapsed');
  END IF;
  IF NOT v_wallet.auto_renew THEN
    RETURN jsonb_build_object('status', 'auto_renew_off');
  END IF;

  v_key := lower(coalesce(v_shop.plan_key, v_shop.plan));
  SELECT key, name, price INTO v_plan FROM public.plans WHERE key = v_key;
  IF NOT FOUND OR v_plan.price <= 0 THEN
    RETURN jsonb_build_object('status', 'skipped');
  END IF;

  IF v_wallet.balance < v_plan.price THEN
    RETURN jsonb_build_object('status', 'insufficient', 'balance', v_wallet.balance, 'price', v_plan.price);
  END IF;

  v_tx := public.wallet_apply(p_shop_id, -v_plan.price, 'renewal',
    'ต่ออายุแพ็กเกจ ' || v_plan.name || ' 30 วัน', NULL, v_key, NULL, NULL);

  -- Continues from the old end date so a renewal inside the grace period doesn't add free days
  v_expires := v_shop.plan_expires_at + interval '30 days';
  UPDATE public.shops
  SET subscription_status = 'active', plan_expires_at = v_expires, updated_at = now()
  WHERE id = p_shop_id;

  UPDATE public.shop_wallets
  SET renewal_notice_for = NULL, lapse_notice_for = NULL
  WHERE shop_id = p_shop_id;

  RETURN jsonb_build_object(
    'status', 'renewed',
    'plan_key', v_key,
    'charged', v_plan.price,
    'balance', v_tx.balance_after,
    'plan_expires_at', v_expires
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.wallet_buy_addon(p_shop_id UUID, p_addon_key TEXT, p_actor UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_wallet public.shop_wallets;
  v_pack public.addon_packs;
  v_tx public.wallet_transactions;
  v_expires TIMESTAMPTZ;
BEGIN
  v_wallet := public.wallet_lock(p_shop_id);

  SELECT * INTO v_pack FROM public.addon_packs WHERE key = p_addon_key AND is_active;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_addon');
  END IF;

  IF v_wallet.balance < v_pack.price THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_balance',
      'balance', v_wallet.balance,
      'price', v_pack.price,
      'needed', v_pack.price - v_wallet.balance
    );
  END IF;

  v_tx := public.wallet_apply(p_shop_id, -v_pack.price, 'addon',
    'ซื้อแพ็กเสริม ' || v_pack.name, NULL, NULL, v_pack.key, p_actor);

  v_expires := now() + make_interval(days => v_pack.valid_days);
  INSERT INTO public.shop_addon_credits (shop_id, kind, addon_key, quantity, remaining, expires_at, transaction_id)
  VALUES (p_shop_id, v_pack.kind, v_pack.key, v_pack.quantity, v_pack.quantity, v_expires, v_tx.id);

  RETURN jsonb_build_object(
    'success', true,
    'addon_key', v_pack.key,
    'kind', v_pack.kind,
    'quantity', v_pack.quantity,
    'expires_at', v_expires,
    'balance', v_tx.balance_after
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Takes one unit from the add-on credit that expires first; false when none is left
CREATE OR REPLACE FUNCTION public.consume_addon_credit(p_shop_id UUID, p_kind TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_id UUID;
BEGIN
  UPDATE public.shop_addon_credits
  SET remaining = remaining - 1
  WHERE id = (
    SELECT id FROM public.shop_addon_credits
    WHERE shop_id = p_shop_id AND kind = p_kind AND remaining > 0 AND expires_at > now()
    ORDER BY expires_at
    LIMIT 1
    FOR UPDATE
  )
  RETURNING id INTO v_id;
  RETURN v_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Counts one automatic slip check against the month's plan allowance, falling
-- back to a slip add-on pack. Returns 'plan', 'addon', or 'none' (nothing counted).
CREATE OR REPLACE FUNCTION public.claim_slip_check(p_shop_id UUID, p_period TEXT, p_limit INT)
RETURNS TEXT AS $$
DECLARE
  v_used INT;
  v_source TEXT;
BEGIN
  INSERT INTO public.usage_logs (shop_id, period) VALUES (p_shop_id, p_period)
  ON CONFLICT (shop_id, period) DO NOTHING;

  SELECT slips_used INTO v_used FROM public.usage_logs
  WHERE shop_id = p_shop_id AND period = p_period FOR UPDATE;

  IF p_limit < 0 OR v_used < p_limit THEN
    v_source := 'plan';
  ELSIF public.consume_addon_credit(p_shop_id, 'slips') THEN
    v_source := 'addon';
  ELSE
    RETURN 'none';
  END IF;

  UPDATE public.usage_logs
  SET slips_used = slips_used + 1, updated_at = now()
  WHERE shop_id = p_shop_id AND period = p_period;

  RETURN v_source;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------------------------
-- 6. Top-ups ride on the existing slip payment flow
-- ------------------------------------------------------------------------------
-- billing_payments rows with plan_key 'wallet_topup' credit the wallet with the
-- billed amount (the full amount when 3% was withheld) instead of changing the plan.
CREATE OR REPLACE FUNCTION public.verify_manual_payment(
  p_payment_id UUID,
  p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_payment RECORD;
  v_receipt_no TEXT;
  v_expires_at TIMESTAMPTZ;
  v_tx public.wallet_transactions;
BEGIN
  -- Lock row to prevent race conditions
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

  v_receipt_no := public.next_receipt_number();

  UPDATE public.billing_payments
  SET status = 'verified',
      receipt_number = v_receipt_no,
      verified_at = now(),
      verified_by = p_admin_id
  WHERE id = p_payment_id;

  IF v_payment.plan_key = 'wallet_topup' THEN
    PERFORM public.wallet_lock(v_payment.shop_id);
    v_tx := public.wallet_apply(
      v_payment.shop_id,
      coalesce(v_payment.billed_amount, v_payment.amount),
      'topup',
      'เติมเงินผ่าน PromptPay (ใบเสร็จ ' || v_receipt_no || ')',
      p_payment_id, NULL, NULL, p_admin_id
    );

    RETURN jsonb_build_object(
      'success', true,
      'payment_id', p_payment_id,
      'receipt_number', v_receipt_no,
      'wallet_topup', true,
      'credited', v_tx.amount,
      'balance', v_tx.balance_after
    );
  END IF;

  -- Legacy: a payment for a specific plan extends it by 30 days
  SELECT CASE
    WHEN plan_expires_at > now() THEN plan_expires_at + interval '30 days'
    ELSE now() + interval '30 days'
  END INTO v_expires_at
  FROM public.shops
  WHERE id = v_payment.shop_id;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------------------------
-- 7. Billing and usage RPCs are for the server only
-- ------------------------------------------------------------------------------
-- They are SECURITY DEFINER, so a signed-in merchant calling them through the
-- REST API could otherwise approve their own payment, credit their wallet or
-- rewrite usage counters.
DO $$
DECLARE
  fn TEXT;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.wallet_lock(uuid)',
    'public.wallet_apply(uuid, numeric, text, text, uuid, text, text, uuid)',
    'public.wallet_buy_plan(uuid, text, uuid)',
    'public.wallet_renew_plan(uuid)',
    'public.wallet_buy_addon(uuid, text, uuid)',
    'public.consume_addon_credit(uuid, text)',
    'public.claim_slip_check(uuid, text, int)',
    'public.verify_manual_payment(uuid, uuid)',
    'public.reject_manual_payment(uuid, text, uuid)',
    'public.increment_usage(uuid, text, int, bigint)'
  ] LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
  END LOOP;
END $$;

SELECT 'wallet billing ready' AS result,
       (SELECT string_agg(key || '=' || price || '/' || messages || 'msg/' || slips || 'slip', ', ' ORDER BY price)
        FROM public.plans) AS plans;
