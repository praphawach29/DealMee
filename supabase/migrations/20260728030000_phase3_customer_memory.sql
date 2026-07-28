-- ================================================================
-- Customer Memory Graph — Phase 1 of the AI Agent Architecture
-- Upgrade (see ROADMAP_AI_AGENT.md). Durable, structured per-customer
-- profile that accumulates (not overwrites) tags/notes and tracks
-- order stats, auto-injected into every AI reply as context.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.customer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,              -- LINE userId, matches conversations.user_id
  customer_name TEXT,
  tags JSONB NOT NULL DEFAULT '[]',        -- array of tag strings, append+dedupe
  notes JSONB NOT NULL DEFAULT '[]',       -- array of {text, created_at}, append-only
  preferences JSONB NOT NULL DEFAULT '{}', -- free-form key/value (size, color, interests...)
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_spend NUMERIC NOT NULL DEFAULT 0,
  last_order_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(shop_id, user_id)
);

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_profiles_select" ON public.customer_profiles FOR SELECT
  USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));

-- NOTE: no insert/update policy for the authenticated role — all writes go
-- through the service-role admin client (src/lib/supabase/admin.ts), same
-- convention as usage_logs/billing_payments from Phase 2.

-- 1. Insert-if-missing, always bump last_seen_at (called on every incoming message)
CREATE OR REPLACE FUNCTION public.upsert_customer_profile(
  p_shop_id UUID, p_user_id TEXT, p_customer_name TEXT
) RETURNS void AS $$
BEGIN
  INSERT INTO public.customer_profiles (shop_id, user_id, customer_name)
  VALUES (p_shop_id, p_user_id, p_customer_name)
  ON CONFLICT (shop_id, user_id) DO UPDATE
    SET last_seen_at = now(),
        updated_at = now(),
        customer_name = COALESCE(public.customer_profiles.customer_name, excluded.customer_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Append-only note history (fixes conversations.customer_note's overwrite problem)
CREATE OR REPLACE FUNCTION public.append_customer_note(
  p_shop_id UUID, p_user_id TEXT, p_note TEXT
) RETURNS void AS $$
BEGIN
  UPDATE public.customer_profiles
  SET notes = notes || jsonb_build_array(jsonb_build_object('text', p_note, 'created_at', now())),
      updated_at = now()
  WHERE shop_id = p_shop_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Append a tag only if not already present (fixes customer_tag's overwrite problem)
CREATE OR REPLACE FUNCTION public.add_customer_tag_unique(
  p_shop_id UUID, p_user_id TEXT, p_tag TEXT
) RETURNS void AS $$
BEGIN
  UPDATE public.customer_profiles
  SET tags = tags || jsonb_build_array(p_tag),
      updated_at = now()
  WHERE shop_id = p_shop_id AND user_id = p_user_id
    AND NOT (tags @> jsonb_build_array(p_tag));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Merge a key/value pair into preferences without clobbering existing keys
CREATE OR REPLACE FUNCTION public.update_customer_preference(
  p_shop_id UUID, p_user_id TEXT, p_key TEXT, p_value TEXT
) RETURNS void AS $$
BEGIN
  UPDATE public.customer_profiles
  SET preferences = preferences || jsonb_build_object(p_key, p_value),
      updated_at = now()
  WHERE shop_id = p_shop_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Roll up order stats automatically when take_order succeeds
CREATE OR REPLACE FUNCTION public.record_customer_order(
  p_shop_id UUID, p_user_id TEXT, p_amount NUMERIC
) RETURNS void AS $$
BEGIN
  UPDATE public.customer_profiles
  SET total_orders = total_orders + 1,
      total_spend = total_spend + p_amount,
      last_order_at = now(),
      updated_at = now()
  WHERE shop_id = p_shop_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Customer Memory Graph schema applied successfully' AS result;
