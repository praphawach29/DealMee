-- ================================================================
-- Knowledge gaps: questions the sales bot could not answer from
-- shop data. Merchants see open rows on the knowledge page.
--
-- Do not apply this against production from the app. Run it yourself
-- with `supabase db push`, or paste this file into the Supabase SQL
-- editor for the target project. Until it is applied, the bot still
-- answers and simply skips writing the log.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.knowledge_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  question_key TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('unsupported_shop_fact', 'invented_citation', 'unanswered')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed')),
  ask_count INTEGER NOT NULL DEFAULT 1 CHECK (ask_count >= 1),
  last_asked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS knowledge_gaps_shop_question
  ON public.knowledge_gaps (shop_id, question_key);

CREATE INDEX IF NOT EXISTS knowledge_gaps_shop_open
  ON public.knowledge_gaps (shop_id, last_asked_at DESC)
  WHERE status = 'open';

ALTER TABLE public.knowledge_gaps ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  shop_scope TEXT := 'shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())';
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shops' AND column_name = 'owner_id'
  ) THEN
    shop_scope := shop_scope || ' OR shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())';
  END IF;
  shop_scope := '(' || shop_scope || ')';

  EXECUTE 'DROP POLICY IF EXISTS "Shop members manage own rows" ON public.knowledge_gaps';
  EXECUTE format(
    'CREATE POLICY %I ON public.knowledge_gaps FOR ALL USING %s WITH CHECK %s',
    'Shop members manage own rows', shop_scope, shop_scope
  );
END $$;

REVOKE ALL ON TABLE public.knowledge_gaps FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.knowledge_gaps TO authenticated, service_role;

SELECT 'Knowledge gaps schema applied successfully' AS result;
