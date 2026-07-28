-- ================================================================
-- Provider-aware, cache-aware AI usage tracking — prerequisite for
-- the admin Margin Dashboard and for accurately costing Claude's
-- prompt caching (cache-read tokens are billed at a steep discount
-- vs. full-price tokens, so they must be tracked separately).
--
-- Deliberately a separate table from usage_logs: usage_logs stays
-- purely for quota gating (messages/tokens vs. plan limit); this
-- table is for cost/margin analytics only — different concern.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.ai_provider_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  period TEXT NOT NULL,           -- 'YYYY-MM'
  provider TEXT NOT NULL,         -- 'gemini' | 'claude' | 'openai'
  message_count INTEGER NOT NULL DEFAULT 0,
  prompt_tokens BIGINT NOT NULL DEFAULT 0,
  completion_tokens BIGINT NOT NULL DEFAULT 0,
  cache_read_tokens BIGINT NOT NULL DEFAULT 0,   -- Claude only, stays 0 for others
  cache_write_tokens BIGINT NOT NULL DEFAULT 0,  -- Claude only
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(shop_id, period, provider)
);

ALTER TABLE public.ai_provider_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_provider_usage_select" ON public.ai_provider_usage FOR SELECT
  USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));

-- NOTE: no insert/update policy for the authenticated role — all writes go
-- through the service-role admin client, same convention as usage_logs
-- (Phase 2) and customer_profiles (Phase 3). The admin Margin Dashboard
-- reads across ALL shops via the service-role client too (gated in the
-- application layer by verifySuperAdmin(), same as the rest of /admin).

CREATE OR REPLACE FUNCTION public.increment_provider_usage(
  p_shop_id UUID, p_period TEXT, p_provider TEXT,
  p_prompt_tokens BIGINT, p_completion_tokens BIGINT,
  p_cache_read_tokens BIGINT, p_cache_write_tokens BIGINT
) RETURNS void AS $$
BEGIN
  INSERT INTO public.ai_provider_usage (
    shop_id, period, provider, message_count,
    prompt_tokens, completion_tokens, cache_read_tokens, cache_write_tokens
  )
  VALUES (
    p_shop_id, p_period, p_provider, 1,
    p_prompt_tokens, p_completion_tokens, p_cache_read_tokens, p_cache_write_tokens
  )
  ON CONFLICT (shop_id, period, provider) DO UPDATE
    SET message_count = public.ai_provider_usage.message_count + 1,
        prompt_tokens = public.ai_provider_usage.prompt_tokens + excluded.prompt_tokens,
        completion_tokens = public.ai_provider_usage.completion_tokens + excluded.completion_tokens,
        cache_read_tokens = public.ai_provider_usage.cache_read_tokens + excluded.cache_read_tokens,
        cache_write_tokens = public.ai_provider_usage.cache_write_tokens + excluded.cache_write_tokens,
        updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Provider usage tracking schema applied successfully' AS result;
