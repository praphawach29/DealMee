-- Phase 5: Persistent agent memory + tool usage analytics + skill versioning
-- Migration: 20261105000000_phase5_agent_memory.sql

-- ============================================================
-- 1. shop_agent_memory — cross-conversation bot knowledge
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shop_agent_memory (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  memory_type         TEXT NOT NULL CHECK (memory_type IN ('procedure', 'preference', 'pitfall', 'fact')),
  category            TEXT NOT NULL DEFAULT 'general',
  content             TEXT NOT NULL,
  source_conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  confidence          NUMERIC(3,2) DEFAULT 0.8,
  usage_count          INTEGER DEFAULT 0,
  last_used_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_memory_shop ON public.shop_agent_memory (shop_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_type ON public.shop_agent_memory (memory_type);
CREATE INDEX IF NOT EXISTS idx_agent_memory_category ON public.shop_agent_memory (category);

ALTER TABLE public.shop_agent_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their shop agent memory" ON public.shop_agent_memory
  FOR SELECT USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "Users insert their shop agent memory" ON public.shop_agent_memory
  FOR INSERT WITH CHECK (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "Users update their shop agent memory" ON public.shop_agent_memory
  FOR UPDATE USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "Users delete their shop agent memory" ON public.shop_agent_memory
  FOR DELETE USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));

REVOKE ALL ON public.shop_agent_memory FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_agent_memory TO authenticated, service_role;

-- ============================================================
-- 2. tool_usage_log — track which tools are used and their outcomes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tool_usage_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  conversation_id     UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  tool_name           TEXT NOT NULL,
  args_summary        TEXT,
  success             BOOLEAN DEFAULT true,
  error_message       TEXT,
  duration_ms         INTEGER,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tool_usage_shop ON public.tool_usage_log (shop_id);
CREATE INDEX IF NOT EXISTS idx_tool_usage_tool ON public.tool_usage_log (tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_usage_created ON public.tool_usage_log (created_at);

ALTER TABLE public.tool_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their shop tool usage" ON public.tool_usage_log
  FOR SELECT USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "Service role inserts tool usage" ON public.tool_usage_log
  FOR INSERT WITH CHECK (auth.role() IS DISTINCT FROM 'anon');

REVOKE ALL ON public.tool_usage_log FROM anon, public;
GRANT SELECT, INSERT ON public.tool_usage_log TO authenticated, service_role;

-- ============================================================
-- 3. shop_skill_revisions — immutable skill version history
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shop_skill_revisions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id            UUID NOT NULL REFERENCES public.shop_skills(id) ON DELETE CASCADE,
  shop_id             UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  version             TEXT NOT NULL,
  skill_type          TEXT NOT NULL,
  category            TEXT NOT NULL,
  trigger_keywords    TEXT[] NOT NULL DEFAULT '{}',
  knowledge_body      TEXT,
  instruction         TEXT,
  changed_by          UUID REFERENCES auth.users(id),
  change_reason       TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skill_revisions_skill ON public.shop_skill_revisions (skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_revisions_shop ON public.shop_skill_revisions (shop_id);

ALTER TABLE public.shop_skill_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their shop skill revisions" ON public.shop_skill_revisions
  FOR SELECT USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "Service role inserts skill revisions" ON public.shop_skill_revisions
  FOR INSERT WITH CHECK (auth.role() IS DISTINCT FROM 'anon');

REVOKE ALL ON public.shop_skill_revisions FROM anon, public;
GRANT SELECT, INSERT ON public.shop_skill_revisions TO authenticated, service_role;

-- ============================================================
-- 4. Trigger: auto-create revision on skill update
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_skill_revision()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.version IS DISTINCT FROM NEW.version
     OR OLD.knowledge_body IS DISTINCT FROM NEW.knowledge_body
     OR OLD.instruction IS DISTINCT FROM NEW.instruction
     OR OLD.trigger_keywords IS DISTINCT FROM NEW.trigger_keywords THEN
    INSERT INTO public.shop_skill_revisions (
      skill_id, shop_id, version, skill_type, category,
      trigger_keywords, knowledge_body, instruction, change_reason
    ) VALUES (
      OLD.id, OLD.shop_id, OLD.version, OLD.skill_type, OLD.category,
      OLD.trigger_keywords, OLD.knowledge_body, OLD.instruction,
      'auto: skill updated'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_skill_revision_on_update
  BEFORE UPDATE ON public.shop_skills
  FOR EACH ROW EXECUTE FUNCTION public.create_skill_revision();

-- ============================================================
-- 5. View: tool_usage_stats — tool usage analytics
-- ============================================================
CREATE OR REPLACE VIEW public.tool_usage_stats AS
SELECT
  shop_id,
  tool_name,
  COUNT(*) AS total_calls,
  COUNT(*) FILTER (WHERE success = true) AS successful_calls,
  COUNT(*) FILTER (WHERE success = false) AS failed_calls,
  ROUND(AVG(duration_ms)) AS avg_duration_ms,
  MAX(created_at) AS last_used_at
FROM public.tool_usage_log
GROUP BY shop_id, tool_name;

CREATE OR REPLACE FUNCTION public.increment_memory_usage(p_memory_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.shop_agent_memory
  SET usage_count = usage_count + 1, last_used_at = now()
  WHERE id = p_memory_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_memory_usage(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_memory_usage(UUID) TO service_role;

SELECT 'Phase 5 (agent memory + tool analytics + skill versioning) schema applied successfully' AS result;
