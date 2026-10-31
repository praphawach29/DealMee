-- Phase 4: Turn-level feedback + skill exposure logging + conversion attribution
-- Migration: 20261104000000_phase4_feedback_exposure.sql

-- ============================================================
-- 1. chat_message_feedback — turn-level feedback from merchants
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_message_feedback (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  conversation_id     UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  chat_message_id     UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  rating              TEXT NOT NULL CHECK (rating IN ('up', 'down')),
  reason              TEXT CHECK (reason IN ('wrong_fact', 'off_brand', 'too_verbose', 'hallucination', 'other')),
  corrected_response  TEXT,
  reviewed_by         UUID REFERENCES auth.users(id),
  reviewed_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chat_message_feedback_one_per_message UNIQUE (chat_message_id)
);

CREATE INDEX IF NOT EXISTS idx_msg_feedback_shop ON public.chat_message_feedback (shop_id);
CREATE INDEX IF NOT EXISTS idx_msg_feedback_conv ON public.chat_message_feedback (conversation_id);
CREATE INDEX IF NOT EXISTS idx_msg_feedback_rating ON public.chat_message_feedback (rating);

ALTER TABLE public.chat_message_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read their shop message feedback" ON public.chat_message_feedback;
CREATE POLICY "Users read their shop message feedback" ON public.chat_message_feedback
  FOR SELECT USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));
DROP POLICY IF EXISTS "Users insert their shop message feedback" ON public.chat_message_feedback;
CREATE POLICY "Users insert their shop message feedback" ON public.chat_message_feedback
  FOR INSERT WITH CHECK (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));
DROP POLICY IF EXISTS "Users update their shop message feedback" ON public.chat_message_feedback;
CREATE POLICY "Users update their shop message feedback" ON public.chat_message_feedback
  FOR UPDATE USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));

REVOKE ALL ON public.chat_message_feedback FROM anon, public;
GRANT SELECT, INSERT, UPDATE ON public.chat_message_feedback TO authenticated, service_role;

-- ============================================================
-- 2. skill_exposures — log which skills were used in which messages
-- ============================================================
CREATE TABLE IF NOT EXISTS public.skill_exposures (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  conversation_id     UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  chat_message_id     UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  skill_id            UUID NOT NULL REFERENCES public.shop_skills(id) ON DELETE CASCADE,
  skill_version       TEXT NOT NULL,
  exposed_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skill_exposures_shop ON public.skill_exposures (shop_id);
CREATE INDEX IF NOT EXISTS idx_skill_exposures_conv ON public.skill_exposures (conversation_id);
CREATE INDEX IF NOT EXISTS idx_skill_exposures_skill ON public.skill_exposures (skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_exposures_msg ON public.skill_exposures (chat_message_id);

ALTER TABLE public.skill_exposures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read their shop skill exposures" ON public.skill_exposures;
CREATE POLICY "Users read their shop skill exposures" ON public.skill_exposures
  FOR SELECT USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));
DROP POLICY IF EXISTS "Service role inserts skill exposures" ON public.skill_exposures;
CREATE POLICY "Service role inserts skill exposures" ON public.skill_exposures
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON public.skill_exposures FROM anon, authenticated, public;
GRANT SELECT ON public.skill_exposures TO authenticated;
GRANT SELECT, INSERT ON public.skill_exposures TO service_role;

-- ============================================================
-- 3. RPC: record_skill_exposure — batch insert exposures
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_skill_exposure(
  p_shop_id UUID,
  p_conversation_id UUID,
  p_chat_message_id UUID,
  p_skill_ids UUID[],
  p_skill_versions TEXT[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF array_length(p_skill_ids, 1) IS NULL OR array_length(p_skill_ids, 1) = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.skill_exposures (shop_id, conversation_id, chat_message_id, skill_id, skill_version)
  SELECT p_shop_id, p_conversation_id, p_chat_message_id, unnest(p_skill_ids), unnest(p_skill_versions)
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.record_skill_exposure(UUID, UUID, UUID, UUID[], TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_skill_exposure(UUID, UUID, UUID, UUID[], TEXT[]) TO service_role;

-- ============================================================
-- 4. View: skill_conversion_stats — conversion rate per skill
-- ============================================================
CREATE OR REPLACE VIEW public.skill_conversion_stats
WITH (security_invoker = true) AS
SELECT
  se.skill_id,
  ss.shop_id,
  ss.skill_type,
  ss.category,
  ss.version,
  COUNT(DISTINCT se.conversation_id) AS exposed_conversations,
  COUNT(DISTINCT CASE WHEN co.outcome = 'conversion' THEN se.conversation_id END) AS paid_conversations,
  CASE
    WHEN COUNT(DISTINCT se.conversation_id) > 0
    THEN ROUND(
      COUNT(DISTINCT CASE WHEN co.outcome = 'conversion' THEN se.conversation_id END)::numeric
      / COUNT(DISTINCT se.conversation_id)::numeric * 100, 1
    )
    ELSE 0
  END AS conversion_rate_pct,
  AVG(co.ai_confidence) AS avg_confidence
FROM public.skill_exposures se
JOIN public.shop_skills ss ON ss.id = se.skill_id
LEFT JOIN public.conversation_outcomes co ON co.conversation_id = se.conversation_id
GROUP BY se.skill_id, ss.shop_id, ss.skill_type, ss.category, ss.version;

REVOKE ALL ON public.skill_conversion_stats FROM anon, public;
GRANT SELECT ON public.skill_conversion_stats TO authenticated, service_role;

SELECT 'Phase 4 (feedback + exposure + attribution) schema applied successfully' AS result;
