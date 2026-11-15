-- Real shadow replay results for a candidate skill.
--
-- Do not apply this from the app. Paste this file into the Supabase SQL
-- editor for the target project (or run `supabase db push`). It is safe to
-- run more than once.
--
-- Until it is applied, the merchant can still save skills, but "ทดสอบกับแชทจริง"
-- cannot store a result. The bot's customer replies are unchanged.

ALTER TABLE public.shop_skill_shadow_evals
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE public.shop_skill_shadow_evals
  ADD COLUMN IF NOT EXISTS sample_size INTEGER;
ALTER TABLE public.shop_skill_shadow_evals
  ADD COLUMN IF NOT EXISTS improved_count INTEGER;
ALTER TABLE public.shop_skill_shadow_evals
  ADD COLUMN IF NOT EXISTS regressed_count INTEGER;
ALTER TABLE public.shop_skill_shadow_evals
  ADD COLUMN IF NOT EXISTS tied_count INTEGER;
ALTER TABLE public.shop_skill_shadow_evals
  ADD COLUMN IF NOT EXISTS grounded_with INTEGER;
ALTER TABLE public.shop_skill_shadow_evals
  ADD COLUMN IF NOT EXISTS grounded_without INTEGER;
ALTER TABLE public.shop_skill_shadow_evals
  ADD COLUMN IF NOT EXISTS handoff_with INTEGER;
ALTER TABLE public.shop_skill_shadow_evals
  ADD COLUMN IF NOT EXISTS handoff_without INTEGER;
ALTER TABLE public.shop_skill_shadow_evals
  ADD COLUMN IF NOT EXISTS judge_with INTEGER;
ALTER TABLE public.shop_skill_shadow_evals
  ADD COLUMN IF NOT EXISTS judge_without INTEGER;
ALTER TABLE public.shop_skill_shadow_evals
  ADD COLUMN IF NOT EXISTS judge_used BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.shop_skill_shadow_evals
  ADD COLUMN IF NOT EXISTS prompt_tokens INTEGER;
ALTER TABLE public.shop_skill_shadow_evals
  ADD COLUMN IF NOT EXISTS completion_tokens INTEGER;
ALTER TABLE public.shop_skill_shadow_evals
  ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(12, 6);
ALTER TABLE public.shop_skill_shadow_evals
  ADD COLUMN IF NOT EXISTS metrics JSONB;
ALTER TABLE public.shop_skill_shadow_evals
  ADD COLUMN IF NOT EXISTS skill_digest TEXT;
ALTER TABLE public.shop_skill_shadow_evals
  ADD COLUMN IF NOT EXISTS error TEXT;
ALTER TABLE public.shop_skill_shadow_evals
  ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

DO $$
BEGIN
  IF to_regclass('public.shop_skill_shadow_evals') IS NOT NULL THEN
    ALTER TABLE public.shop_skill_shadow_evals DROP CONSTRAINT IF EXISTS shop_skill_shadow_evals_winner_check;
    ALTER TABLE public.shop_skill_shadow_evals
      ADD CONSTRAINT shop_skill_shadow_evals_winner_check
      CHECK (winner IN ('original', 'shadow', 'tie', 'pending'));

    ALTER TABLE public.shop_skill_shadow_evals DROP CONSTRAINT IF EXISTS shop_skill_shadow_evals_status_check;
    ALTER TABLE public.shop_skill_shadow_evals
      ADD CONSTRAINT shop_skill_shadow_evals_status_check
      CHECK (status IN ('legacy', 'running', 'completed', 'insufficient', 'failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_shadow_evals_skill_recent
  ON public.shop_skill_shadow_evals (shop_id, skill_id, created_at DESC);

DROP POLICY IF EXISTS "Service role updates shadow evals" ON public.shop_skill_shadow_evals;
CREATE POLICY "Service role updates shadow evals"
  ON public.shop_skill_shadow_evals
  FOR UPDATE
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

GRANT SELECT, INSERT, UPDATE ON TABLE public.shop_skill_shadow_evals TO service_role;

COMMENT ON TABLE public.shop_skill_shadow_evals IS
  'Replay of this shop''s own chats with and without a skill. Not shop knowledge and not grounding evidence.';
COMMENT ON COLUMN public.shop_skill_shadow_evals.status IS
  'legacy = old heuristic. running/completed/insufficient/failed = replay of this shop''s own chats.';
COMMENT ON COLUMN public.shop_skill_shadow_evals.metrics IS
  'Per-sample scores only. Customer text is not stored.';
COMMENT ON COLUMN public.shop_skill_shadow_evals.estimated_cost_usd IS
  'Estimate from token counts at Gemini 2.5 Flash list price. Not an invoice.';

SELECT 'Skill shadow replay schema applied successfully' AS result;
