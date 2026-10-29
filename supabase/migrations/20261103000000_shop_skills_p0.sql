-- Phase 0: Data collection foundation for per-shop AI skills
-- (Hermes-style knowledge packs / golden trajectories)
--
-- Reuses existing infra - does NOT rebuild:
--   conversations, chat_messages, sales_trajectories, conversation_feedback, knowledge_chunks

-- 1. Per-message signals
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(3, 2) CHECK (ai_confidence BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS intent        TEXT,
  ADD COLUMN IF NOT EXISTS outcome_label TEXT;

COMMENT ON COLUMN public.chat_messages.ai_confidence IS 'Heuristic (0-1) response confidence. Not a quality score.';

CREATE INDEX IF NOT EXISTS idx_chat_messages_low_confidence
  ON public.chat_messages (shop_id, ai_confidence)
  WHERE ai_confidence IS NOT NULL AND ai_confidence < 0.5;

-- 2. Conversation outcomes (single source of truth - NO mirror column on conversations)
CREATE TABLE IF NOT EXISTS public.conversation_outcomes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL UNIQUE REFERENCES public.conversations(id) ON DELETE CASCADE,
  shop_id         UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  outcome         TEXT NOT NULL CHECK (outcome IN ('conversion', 'no_conversion', 'info_query', 'handoff')),
  revenue         NUMERIC DEFAULT 0,
  set_by          UUID REFERENCES public.users(id),
  source          TEXT NOT NULL DEFAULT 'system',
  set_at          TIMESTAMPTZ DEFAULT now(),
  notes           TEXT,
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conv_outcomes_shop_outcome ON public.conversation_outcomes (shop_id, outcome);

ALTER TABLE public.conversation_outcomes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read their shop conversation outcomes" ON public.conversation_outcomes;
CREATE POLICY "Users can read their shop conversation outcomes" ON public.conversation_outcomes
  FOR SELECT USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));

REVOKE ALL ON public.conversation_outcomes FROM anon, authenticated, public;
GRANT SELECT ON public.conversation_outcomes TO authenticated;
GRANT ALL ON public.conversation_outcomes TO service_role;

-- 3. Helper RPC: set_conversation_outcome (shop-scoped ownership check)
DROP FUNCTION IF EXISTS public.set_conversation_outcome(UUID, TEXT, NUMERIC, UUID, TEXT);
DROP FUNCTION IF EXISTS public.set_conversation_outcome(UUID, TEXT, UUID, NUMERIC, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.set_conversation_outcome(
  p_conversation_id UUID,
  p_outcome         TEXT,
  p_shop_id         UUID,
  p_revenue         NUMERIC DEFAULT 0,
  p_source          TEXT DEFAULT 'system',
  p_notes           TEXT DEFAULT NULL
) RETURNS TABLE (outcome_set TEXT, conversation_shop UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_conv_shop   UUID;
  v_outcome_set TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;
  SELECT shop_id INTO v_conv_shop FROM public.conversations WHERE id = p_conversation_id;
  IF v_conv_shop IS NULL THEN
    RAISE EXCEPTION 'conversation not found' USING ERRCODE = 'P0404';
  END IF;
  IF p_shop_id IS NULL OR p_shop_id <> v_conv_shop THEN
    RAISE EXCEPTION 'shop_id mismatch: conversation belongs to %', v_conv_shop USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.conversation_outcomes
    (conversation_id, shop_id, outcome, revenue, source, notes)
  VALUES (p_conversation_id, v_conv_shop, p_outcome, p_revenue, p_source, p_notes)
  ON CONFLICT (conversation_id) DO UPDATE
    SET outcome = EXCLUDED.outcome, revenue = EXCLUDED.revenue,
        source = EXCLUDED.source, notes = EXCLUDED.notes,
        set_at = now(), updated_at = now();
  v_outcome_set := p_outcome;
  UPDATE public.conversations SET updated_at = now() WHERE id = p_conversation_id;
  RETURN QUERY SELECT v_outcome_set, v_conv_shop;
END;
$$;
REVOKE ALL ON FUNCTION public.set_conversation_outcome(UUID, TEXT, UUID, NUMERIC, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_conversation_outcome(UUID, TEXT, UUID, NUMERIC, TEXT, TEXT)
  TO service_role;

-- 4. shop_skills registry
CREATE TABLE IF NOT EXISTS public.shop_skills (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  skill_type      TEXT NOT NULL DEFAULT 'knowledge' CHECK (skill_type IN ('knowledge', 'behavior', 'example', 'rule')),
  category        TEXT NOT NULL DEFAULT 'sales',
  version         TEXT NOT NULL DEFAULT '0.1.0',
  status          TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'active', 'archived')),
  trigger_keywords TEXT[],
  knowledge_body  TEXT,
  instruction     TEXT,
  gold_conversations JSONB DEFAULT '[]'::jsonb,
  confidence_avg  NUMERIC(3, 2) CHECK (confidence_avg BETWEEN 0 AND 1),
  usage_count     INTEGER DEFAULT 0,
  created_by      TEXT,
  approved_by     UUID REFERENCES public.users(id),
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.shop_skills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read their shop skills" ON public.shop_skills;
CREATE POLICY "Users read their shop skills" ON public.shop_skills
  FOR SELECT USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));
DROP POLICY IF EXISTS "Users create candidate shop skills" ON public.shop_skills;
CREATE POLICY "Users create candidate shop skills" ON public.shop_skills
  FOR INSERT WITH CHECK (
    shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
    AND status = 'candidate' AND approved_by IS NULL AND approved_at IS NULL
  );
DROP POLICY IF EXISTS "Users update candidate shop skills" ON public.shop_skills;
CREATE POLICY "Users update candidate shop skills" ON public.shop_skills
  FOR UPDATE USING (
    shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
    AND status = 'candidate'
  ) WITH CHECK (
    shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
    AND status = 'candidate' AND approved_by IS NULL AND approved_at IS NULL
  );

REVOKE ALL ON public.shop_skills FROM anon, authenticated, public;
GRANT SELECT, INSERT, UPDATE ON public.shop_skills TO authenticated;
GRANT ALL ON public.shop_skills TO service_role;

CREATE INDEX IF NOT EXISTS idx_shop_skills_shop_type   ON public.shop_skills (shop_id, skill_type);
CREATE INDEX IF NOT EXISTS idx_shop_skills_shop_status ON public.shop_skills (shop_id, status);
CREATE INDEX IF NOT EXISTS idx_shop_skills_shop_cat    ON public.shop_skills (shop_id, category);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_skills_id_shop ON public.shop_skills (id, shop_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_shop_skills_updated ON public.shop_skills;
CREATE TRIGGER trg_shop_skills_updated
  BEFORE UPDATE ON public.shop_skills FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.shop_skills IS 'Per-shop AI skill. status: candidate->active->archived. gold_conversations stores IDs only.';

CREATE TABLE IF NOT EXISTS public.shop_skill_revisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id        UUID NOT NULL,
  shop_id         UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  version         TEXT NOT NULL, skill_type TEXT NOT NULL, category TEXT NOT NULL,
  instruction     TEXT, knowledge_body  TEXT, gold_conversations JSONB,
  trigger_keywords TEXT[], confidence_avg NUMERIC(3, 2),
  created_at      TIMESTAMPTZ DEFAULT now(),
  created_by      TEXT,
  UNIQUE (skill_id, version),
  FOREIGN KEY (skill_id, shop_id) REFERENCES public.shop_skills(id, shop_id) ON DELETE CASCADE
);
ALTER TABLE public.shop_skill_revisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read their shop skill revisions" ON public.shop_skill_revisions;
CREATE POLICY "Users read their shop skill revisions" ON public.shop_skill_revisions
  FOR SELECT USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));

REVOKE ALL ON public.shop_skill_revisions FROM anon, authenticated, public;
GRANT SELECT ON public.shop_skill_revisions TO authenticated;
GRANT ALL ON public.shop_skill_revisions TO service_role;

CREATE TABLE IF NOT EXISTS public.shop_skill_sources (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id            UUID NOT NULL,
  shop_id             UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  conversation_id     UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  chat_message_id     UUID REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  sales_trajectory_id UUID REFERENCES public.sales_trajectories(id) ON DELETE CASCADE,
  weight              NUMERIC(3, 2) DEFAULT 1.0,
  created_at          TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT shop_skill_sources_has_source CHECK (
    conversation_id IS NOT NULL OR chat_message_id IS NOT NULL OR sales_trajectory_id IS NOT NULL
  ),
  FOREIGN KEY (skill_id, shop_id) REFERENCES public.shop_skills(id, shop_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_skill_sources_skill ON public.shop_skill_sources (skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_sources_conv  ON public.shop_skill_sources (conversation_id);
CREATE INDEX IF NOT EXISTS idx_skill_sources_shop  ON public.shop_skill_sources (shop_id);

CREATE OR REPLACE FUNCTION public.validate_shop_skill_source_scope()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.conversation_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.conversations WHERE id = NEW.conversation_id AND shop_id = NEW.shop_id
  ) THEN
    RAISE EXCEPTION 'conversation source belongs to another shop' USING ERRCODE = '23514';
  END IF;
  IF NEW.chat_message_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.chat_messages WHERE id = NEW.chat_message_id AND shop_id = NEW.shop_id
  ) THEN
    RAISE EXCEPTION 'message source belongs to another shop' USING ERRCODE = '23514';
  END IF;
  IF NEW.sales_trajectory_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.sales_trajectories WHERE id = NEW.sales_trajectory_id AND shop_id = NEW.shop_id
  ) THEN
    RAISE EXCEPTION 'trajectory source belongs to another shop' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_shop_skill_source_scope ON public.shop_skill_sources;
CREATE TRIGGER trg_validate_shop_skill_source_scope
  BEFORE INSERT OR UPDATE ON public.shop_skill_sources
  FOR EACH ROW EXECUTE FUNCTION public.validate_shop_skill_source_scope();

ALTER TABLE public.shop_skill_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read their shop skill sources" ON public.shop_skill_sources;
CREATE POLICY "Users read their shop skill sources" ON public.shop_skill_sources
  FOR SELECT USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users insert their shop skill sources" ON public.shop_skill_sources;
CREATE POLICY "Users insert their shop skill sources" ON public.shop_skill_sources
  FOR INSERT WITH CHECK (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users update their shop skill sources" ON public.shop_skill_sources;
CREATE POLICY "Users update their shop skill sources" ON public.shop_skill_sources
  FOR UPDATE USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));

REVOKE ALL ON public.shop_skill_sources FROM anon, authenticated, public;
GRANT SELECT, INSERT, UPDATE ON public.shop_skill_sources TO authenticated;
GRANT ALL ON public.shop_skill_sources TO service_role;




-- Trigger: validate that referenced sources belong to the same shop as the skill
CREATE OR REPLACE FUNCTION public.validate_shop_skill_source_scope()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.conversation_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.conversations
      WHERE id = NEW.conversation_id AND shop_id = NEW.shop_id
    ) THEN
      RAISE EXCEPTION 'conversation does not belong to this shop';
    END IF;
  END IF;
  IF NEW.chat_message_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.chat_messages
      WHERE id = NEW.chat_message_id AND shop_id = NEW.shop_id
    ) THEN
      RAISE EXCEPTION 'chat message does not belong to this shop';
    END IF;
  END IF;
  IF NEW.sales_trajectory_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.sales_trajectories
      WHERE id = NEW.sales_trajectory_id AND shop_id = NEW.shop_id
    ) THEN
      RAISE EXCEPTION 'sales trajectory does not belong to this shop';
    END IF;
  END IF;
  -- Also ensure the skill itself belongs to the same shop
  IF NOT EXISTS (
    SELECT 1 FROM public.shop_skills
    WHERE id = NEW.skill_id AND shop_id = NEW.shop_id
  ) THEN
    RAISE EXCEPTION 'skill does not belong to this shop';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_shop_skill_source_scope
  BEFORE INSERT OR UPDATE ON public.shop_skill_sources
  FOR EACH ROW EXECUTE FUNCTION public.validate_shop_skill_source_scope();

SELECT 'Phase 0 (shop_skills data collection foundation) schema applied successfully' AS result;
