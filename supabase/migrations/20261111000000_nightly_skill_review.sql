-- Nightly per-shop skill review.
--
-- Do not apply this from the app. Paste this file into the Supabase SQL
-- editor for the target project (or run `supabase db push`). It is safe to
-- run more than once.
--
-- Until it is applied, the cron route records nothing and the skills page
-- hides the nightly proposals. Customer replies are unchanged.
--
-- A proposal is a normal shop_skills row (status candidate, facts_confirmed
-- false). These tables only remember the run, which signals were used, and
-- whether the merchant accepted or rejected the draft.

CREATE TABLE IF NOT EXISTS public.shop_skill_review_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id           UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  review_date       DATE NOT NULL,
  status            TEXT NOT NULL CHECK (status IN ('running', 'completed', 'skipped', 'failed')),
  skip_reason       TEXT,
  signals_seen      INTEGER NOT NULL DEFAULT 0,
  proposals_created INTEGER NOT NULL DEFAULT 0,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, review_date)
);

CREATE INDEX IF NOT EXISTS idx_skill_review_runs_date
  ON public.shop_skill_review_runs (review_date, status);

CREATE TABLE IF NOT EXISTS public.shop_skill_review_signals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  review_run_id UUID REFERENCES public.shop_skill_review_runs(id) ON DELETE SET NULL,
  signal_type   TEXT NOT NULL CHECK (signal_type IN ('gap', 'feedback', 'admin_reply')),
  signal_id     UUID NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, signal_type, signal_id)
);

CREATE INDEX IF NOT EXISTS idx_skill_review_signals_shop
  ON public.shop_skill_review_signals (shop_id, signal_type, signal_id);

CREATE TABLE IF NOT EXISTS public.shop_skill_review_proposals (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id            UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  review_run_id      UUID REFERENCES public.shop_skill_review_runs(id) ON DELETE SET NULL,
  skill_id           UUID NOT NULL REFERENCES public.shop_skills(id) ON DELETE CASCADE,
  revises_skill_id   UUID REFERENCES public.shop_skills(id) ON DELETE SET NULL,
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  summary_th         TEXT NOT NULL,
  needs_merchant_fact BOOLEAN NOT NULL DEFAULT false,
  fingerprint        TEXT NOT NULL,
  topic_keys         TEXT[] NOT NULL DEFAULT '{}',
  source_signals     JSONB NOT NULL DEFAULT '[]'::jsonb,
  decided_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skill_review_proposals_shop
  ON public.shop_skill_review_proposals (shop_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS shop_skill_review_proposals_open_fingerprint
  ON public.shop_skill_review_proposals (shop_id, fingerprint)
  WHERE status IN ('pending', 'accepted');

CREATE TABLE IF NOT EXISTS public.shop_skill_review_rejections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  topic_keys  TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, fingerprint)
);

ALTER TABLE public.shop_skill_review_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_skill_review_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_skill_review_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_skill_review_rejections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shop members read skill review runs" ON public.shop_skill_review_runs;
CREATE POLICY "Shop members read skill review runs"
  ON public.shop_skill_review_runs
  FOR SELECT
  USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Shop members read skill review proposals" ON public.shop_skill_review_proposals;
CREATE POLICY "Shop members read skill review proposals"
  ON public.shop_skill_review_proposals
  FOR SELECT
  USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));

REVOKE ALL ON TABLE public.shop_skill_review_runs FROM anon, authenticated, public;
REVOKE ALL ON TABLE public.shop_skill_review_signals FROM anon, authenticated, public;
REVOKE ALL ON TABLE public.shop_skill_review_proposals FROM anon, authenticated, public;
REVOKE ALL ON TABLE public.shop_skill_review_rejections FROM anon, authenticated, public;

GRANT SELECT ON TABLE public.shop_skill_review_runs TO authenticated;
GRANT SELECT ON TABLE public.shop_skill_review_proposals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shop_skill_review_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shop_skill_review_signals TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shop_skill_review_proposals TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shop_skill_review_rejections TO service_role;

COMMENT ON TABLE public.shop_skill_review_runs IS
  'One nightly review per shop per Asia/Bangkok date. A second run the same date does not call the model again.';
COMMENT ON TABLE public.shop_skill_review_signals IS
  'Learning signals already considered. Gaps, thumbs-down, and admin replies are not proposed twice.';
COMMENT ON TABLE public.shop_skill_review_proposals IS
  'Merchant-facing draft from the nightly review. The linked skill stays candidate until the merchant activates it.';
COMMENT ON COLUMN public.shop_skill_review_proposals.needs_merchant_fact IS
  'True when no admin or merchant text answered the question, so the draft asks the shop to fill the fact.';
COMMENT ON COLUMN public.shop_skill_review_proposals.source_signals IS
  'Redacted labels and ids of the gaps, feedback, and admin replies behind this draft.';
COMMENT ON TABLE public.shop_skill_review_rejections IS
  'Fingerprints the merchant rejected. The nightly review will not propose that cluster again.';

SELECT 'Nightly skill review schema applied successfully' AS result;
