-- Fix: production's usage_logs predates the Phase 2 billing migration, which
-- only did CREATE TABLE IF NOT EXISTS and so kept the old shape without a
-- `period` column. Every increment_usage() call failed ("column "period" of
-- relation "usage_logs" does not exist"), so no message was ever counted:
-- quotas (Free 100 messages, ended trials) were never enforced and the
-- billing page always showed 0.
--
-- Rebuilds the table in the shape the code expects. Refuses to run (and
-- changes nothing) if the old table holds rows or if any other function or
-- view still uses it, since dropping it would then lose data or break that
-- code. Safe to run more than once.

DO $$
DECLARE
  dependents TEXT;
BEGIN
  IF to_regclass('public.usage_logs') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'usage_logs' AND column_name = 'period'
     )
  THEN
    IF EXISTS (SELECT 1 FROM public.usage_logs LIMIT 1) THEN
      RAISE EXCEPTION 'usage_logs has rows in the old shape; not dropping it. Back it up and migrate by hand.';
    END IF;

    SELECT string_agg(p.proname, ', ') INTO dependents
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname <> 'increment_usage'
      AND p.prokind = 'f'
      AND pg_get_functiondef(p.oid) ILIKE '%usage_logs%';
    IF dependents IS NOT NULL THEN
      RAISE EXCEPTION 'Functions still use usage_logs: %. Check them before rebuilding the table.', dependents;
    END IF;

    SELECT string_agg(DISTINCT v.relname, ', ') INTO dependents
    FROM pg_depend d
    JOIN pg_rewrite r ON r.oid = d.objid
    JOIN pg_class v ON v.oid = r.ev_class
    WHERE d.refobjid = 'public.usage_logs'::regclass AND v.relname <> 'usage_logs';
    IF dependents IS NOT NULL THEN
      RAISE EXCEPTION 'Views still use usage_logs: %. Check them before rebuilding the table.', dependents;
    END IF;

    DROP TABLE public.usage_logs;
    RAISE NOTICE 'Dropped empty old-shape usage_logs';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  period TEXT NOT NULL, -- 'YYYY-MM'
  messages_used INTEGER NOT NULL DEFAULT 0,
  tokens_used BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(shop_id, period)
);

ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usage_logs_select" ON public.usage_logs;
CREATE POLICY "usage_logs_select" ON public.usage_logs FOR SELECT
  USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));

-- Writes go only through increment_usage() via the service role (see Phase 2)
CREATE OR REPLACE FUNCTION public.increment_usage(
  p_shop_id UUID, p_period TEXT, p_messages INT, p_tokens BIGINT
) RETURNS void AS $$
BEGIN
  INSERT INTO public.usage_logs (shop_id, period, messages_used, tokens_used)
  VALUES (p_shop_id, p_period, p_messages, p_tokens)
  ON CONFLICT (shop_id, period) DO UPDATE
    SET messages_used = public.usage_logs.messages_used + excluded.messages_used,
        tokens_used = public.usage_logs.tokens_used + excluded.tokens_used,
        updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'usage_logs rebuilt' AS result,
       (SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'usage_logs') AS columns;
