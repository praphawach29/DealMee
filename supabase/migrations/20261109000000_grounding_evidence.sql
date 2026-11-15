-- Grounding evidence: shadow evals, confirmed skill facts, trajectory approval.
--
-- Do not apply this from the app. Paste this file into the Supabase SQL
-- editor for the target project (or run `supabase db push`). It is safe to
-- run more than once.
--
-- Until it is applied:
--   * new shadow evals cannot be stored
--   * new golden trajectories inserted as "candidate" fail the status check
--   * skill rows have no facts_confirmed column, so the bot treats every
--     skill as unconfirmed and will not quote it as evidence

-- ----------------------------------------------------------------
-- 1. Shadow eval results. Service role writes. Shop members read.
--    These rows are not agent memory and cannot prove a shop fact.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shop_skill_shadow_evals (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id              UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  skill_id             UUID NOT NULL REFERENCES public.shop_skills(id) ON DELETE CASCADE,
  conversation_id      UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  skill_version        TEXT,
  user_query           TEXT,
  original_confidence  NUMERIC(4,3),
  shadow_confidence    NUMERIC(4,3),
  original_intent      TEXT,
  shadow_intent        TEXT,
  winner               TEXT NOT NULL CHECK (winner IN ('original', 'shadow', 'tie')),
  recommendation       TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shadow_evals_shop
  ON public.shop_skill_shadow_evals (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shadow_evals_skill
  ON public.shop_skill_shadow_evals (skill_id);

ALTER TABLE public.shop_skill_shadow_evals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shop members read shadow evals" ON public.shop_skill_shadow_evals;
CREATE POLICY "Shop members read shadow evals"
  ON public.shop_skill_shadow_evals
  FOR SELECT
  USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Service role inserts shadow evals" ON public.shop_skill_shadow_evals;
CREATE POLICY "Service role inserts shadow evals"
  ON public.shop_skill_shadow_evals
  FOR INSERT
  TO service_role
  WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON TABLE public.shop_skill_shadow_evals FROM anon, authenticated, public;
GRANT SELECT ON TABLE public.shop_skill_shadow_evals TO authenticated;
GRANT SELECT, INSERT ON TABLE public.shop_skill_shadow_evals TO service_role;

COMMENT ON TABLE public.shop_skill_shadow_evals IS
  'Background comparison of a candidate skill. Not shop knowledge and not grounding evidence.';

-- ----------------------------------------------------------------
-- 2. Remove eval notes that were written into agent memory as facts.
-- ----------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.shop_agent_memory') IS NOT NULL THEN
    DELETE FROM public.shop_agent_memory
    WHERE category IN ('shadow_eval', 'shadow-eval')
       OR content LIKE 'Shadow eval for skill %';
  END IF;
END $$;

-- ----------------------------------------------------------------
-- 3. Only merchant-confirmed skill text may ground a shop fact.
--    Rows the merchant created (created_by set) and that are not
--    template placeholders are backfilled as confirmed. Extracted
--    rows leave created_by null and stay unconfirmed.
-- ----------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.shop_skills') IS NOT NULL THEN
    ALTER TABLE public.shop_skills
      ADD COLUMN IF NOT EXISTS facts_confirmed BOOLEAN NOT NULL DEFAULT false;
    UPDATE public.shop_skills
    SET facts_confirmed = true
    WHERE facts_confirmed = false
      AND created_by IS NOT NULL
      AND COALESCE(knowledge_body, '') NOT LIKE '%[ใส่%'
      AND COALESCE(instruction, '') NOT LIKE '%[ใส่%';
  END IF;
END $$;

COMMENT ON COLUMN public.shop_skills.facts_confirmed IS
  'Merchant wrote, edited, or explicitly confirmed this text. Only then may grounding quote it.';

-- ----------------------------------------------------------------
-- 4. New golden trajectories are candidates. Existing active rows stay.
--    Production has a check that only allowed active/archived.
-- ----------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.sales_trajectories') IS NOT NULL THEN
    ALTER TABLE public.sales_trajectories DROP CONSTRAINT IF EXISTS sales_trajectories_status_check;
    ALTER TABLE public.sales_trajectories
      ADD CONSTRAINT sales_trajectories_status_check
      CHECK (status IN ('candidate', 'active', 'archived'));
  END IF;
END $$;

SELECT 'Grounding evidence schema applied successfully' AS result;
