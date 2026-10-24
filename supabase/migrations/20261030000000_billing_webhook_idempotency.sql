-- ================================================================
-- Billing webhooks must be safe to retry.
-- Omise re-delivers charge.complete; applying it again used to set
-- plan_expires_at = now() + 1 month, which is a free renewal.
-- Stripe re-delivers events; each one inserted another billing_payments row.
-- One row per provider charge/session/invoice, and one row per webhook event.
-- ================================================================

DELETE FROM public.billing_payments
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           row_number() OVER (
             PARTITION BY provider, provider_ref
             ORDER BY
               CASE WHEN status IN ('succeeded', 'verified') THEN 0 ELSE 1 END,
               created_at ASC NULLS LAST,
               id ASC
           ) AS rn
    FROM public.billing_payments
    WHERE provider_ref IS NOT NULL
  ) ranked
  WHERE rn > 1
);

ALTER TABLE public.billing_payments
  DROP CONSTRAINT IF EXISTS billing_payments_provider_ref_key;

ALTER TABLE public.billing_payments
  ADD CONSTRAINT billing_payments_provider_ref_key UNIQUE (provider, provider_ref);

CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  shop_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, event_id)
);

ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;

-- Omise: claim the charge id, then extend from the current expiry when it is still
-- in the future. A charge that is already succeeded does not move the expiry.
CREATE OR REPLACE FUNCTION public.apply_omise_charge_once(
  p_shop_id UUID,
  p_plan_key TEXT,
  p_charge_id TEXT,
  p_amount NUMERIC,
  p_currency TEXT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_current TIMESTAMPTZ;
  v_expires TIMESTAMPTZ;
  v_claimed INT;
BEGIN
  IF p_shop_id IS NULL OR p_plan_key IS NULL OR p_charge_id IS NULL OR length(trim(p_charge_id)) = 0 THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'invalid');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('omise:' || p_charge_id, 0));

  SELECT plan_expires_at INTO v_current
  FROM public.shops
  WHERE id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'shop_not_found');
  END IF;

  SELECT status INTO v_status
  FROM public.billing_payments
  WHERE provider = 'omise' AND provider_ref = p_charge_id
  FOR UPDATE;

  INSERT INTO public.billing_webhook_events (provider, event_id, shop_id)
  VALUES ('omise', p_charge_id, p_shop_id)
  ON CONFLICT (provider, event_id) DO NOTHING;

  GET DIAGNOSTICS v_claimed = ROW_COUNT;

  IF v_claimed = 0 OR v_status IN ('succeeded', 'verified') THEN
    RETURN jsonb_build_object(
      'applied', false,
      'reason', CASE WHEN v_status IN ('succeeded', 'verified') THEN 'already_succeeded' ELSE 'duplicate' END
    );
  END IF;

  IF v_current IS NOT NULL AND v_current > now() THEN
    v_expires := v_current + interval '1 month';
  ELSE
    v_expires := now() + interval '1 month';
  END IF;

  UPDATE public.shops
  SET plan_key = p_plan_key,
      plan = p_plan_key,
      package_name = p_plan_key,
      subscription_provider = 'omise',
      subscription_id = NULL,
      subscription_status = 'active',
      plan_expires_at = v_expires,
      updated_at = now()
  WHERE id = p_shop_id;

  INSERT INTO public.billing_payments (
    shop_id, provider, plan_key, amount, currency, status, provider_ref
  ) VALUES (
    p_shop_id,
    'omise',
    p_plan_key,
    COALESCE(p_amount, 0),
    COALESCE(NULLIF(p_currency, ''), 'THB'),
    'succeeded',
    p_charge_id
  )
  ON CONFLICT (provider, provider_ref)
  DO UPDATE SET
    status = 'succeeded',
    plan_key = EXCLUDED.plan_key;

  RETURN jsonb_build_object('applied', true, 'plan_expires_at', v_expires);
END;
$$;

-- Stripe Checkout: one event id, one payment row (session id). Shop fields are set
-- once; a redelivery does not insert a second billing_payments row.
CREATE OR REPLACE FUNCTION public.apply_stripe_checkout_once(
  p_event_id TEXT,
  p_shop_id UUID,
  p_plan_key TEXT,
  p_amount NUMERIC,
  p_currency TEXT,
  p_session_id TEXT,
  p_subscription_id TEXT,
  p_customer_id TEXT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claimed INT;
BEGIN
  IF p_event_id IS NULL OR p_shop_id IS NULL OR p_plan_key IS NULL OR p_session_id IS NULL THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'invalid');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('stripe:' || p_event_id, 0));

  PERFORM 1 FROM public.shops WHERE id = p_shop_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'shop_not_found');
  END IF;

  INSERT INTO public.billing_webhook_events (provider, event_id, shop_id)
  VALUES ('stripe', p_event_id, p_shop_id)
  ON CONFLICT (provider, event_id) DO NOTHING;

  GET DIAGNOSTICS v_claimed = ROW_COUNT;
  IF v_claimed = 0 THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'duplicate');
  END IF;

  UPDATE public.shops
  SET plan_key = p_plan_key,
      plan = p_plan_key,
      subscription_provider = 'stripe',
      subscription_id = COALESCE(p_subscription_id, subscription_id),
      subscription_status = 'active',
      stripe_customer_id = COALESCE(p_customer_id, stripe_customer_id),
      updated_at = now()
  WHERE id = p_shop_id;

  INSERT INTO public.billing_payments (
    shop_id, provider, plan_key, amount, currency, status, provider_ref
  ) VALUES (
    p_shop_id,
    'stripe',
    p_plan_key,
    COALESCE(p_amount, 0),
    COALESCE(NULLIF(p_currency, ''), 'THB'),
    'succeeded',
    p_session_id
  )
  ON CONFLICT (provider, provider_ref) DO NOTHING;

  RETURN jsonb_build_object('applied', true);
END;
$$;

-- Stripe invoice.payment_failed: one row per invoice id, and the event id is claimed
-- so a retry does not insert another failed payment.
CREATE OR REPLACE FUNCTION public.apply_stripe_invoice_failed_once(
  p_event_id TEXT,
  p_invoice_id TEXT,
  p_subscription_id TEXT,
  p_amount NUMERIC,
  p_currency TEXT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id UUID;
  v_claimed INT;
BEGIN
  IF p_event_id IS NULL OR p_invoice_id IS NULL THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'invalid');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('stripe:' || p_event_id, 0));

  IF p_subscription_id IS NULL OR length(trim(p_subscription_id)) = 0 THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'no_subscription');
  END IF;

  SELECT id INTO v_shop_id
  FROM public.shops
  WHERE subscription_id = p_subscription_id
  LIMIT 1;

  IF v_shop_id IS NULL THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'shop_not_found');
  END IF;

  PERFORM 1 FROM public.shops WHERE id = v_shop_id FOR UPDATE;

  INSERT INTO public.billing_webhook_events (provider, event_id, shop_id)
  VALUES ('stripe', p_event_id, v_shop_id)
  ON CONFLICT (provider, event_id) DO NOTHING;

  GET DIAGNOSTICS v_claimed = ROW_COUNT;
  IF v_claimed = 0 THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'duplicate');
  END IF;

  UPDATE public.shops
  SET subscription_status = 'past_due',
      updated_at = now()
  WHERE id = v_shop_id;

  INSERT INTO public.billing_payments (
    shop_id, provider, amount, currency, status, provider_ref
  ) VALUES (
    v_shop_id,
    'stripe',
    COALESCE(p_amount, 0),
    COALESCE(NULLIF(p_currency, ''), 'THB'),
    'failed',
    p_invoice_id
  )
  ON CONFLICT (provider, provider_ref) DO NOTHING;

  RETURN jsonb_build_object('applied', true, 'shop_id', v_shop_id);
END;
$$;

DO $$
DECLARE
  fn TEXT;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.apply_omise_charge_once(uuid, text, text, numeric, text)',
    'public.apply_stripe_checkout_once(text, uuid, text, numeric, text, text, text, text)',
    'public.apply_stripe_invoice_failed_once(text, text, text, numeric, text)'
  ] LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
  END LOOP;
END $$;
