-- Repair for databases that already applied 20261104–20261107.
-- Safe to run after the corrected originals as well.

-- Telemetry inserts are service-role only. Shop owners can still read their own rows.
DROP POLICY IF EXISTS "Service role inserts skill exposures" ON public.skill_exposures;
CREATE POLICY "Service role inserts skill exposures" ON public.skill_exposures
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
REVOKE INSERT ON public.skill_exposures FROM authenticated, anon, public;

DROP POLICY IF EXISTS "Service role inserts tool usage" ON public.tool_usage_log;
CREATE POLICY "Service role inserts tool usage" ON public.tool_usage_log
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
REVOKE INSERT ON public.tool_usage_log FROM authenticated, anon, public;

DROP POLICY IF EXISTS "Service role inserts skill revisions" ON public.shop_skill_revisions;
CREATE POLICY "Service role inserts skill revisions" ON public.shop_skill_revisions
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
REVOKE INSERT ON public.shop_skill_revisions FROM authenticated, anon, public;

-- conversation_outcomes.outcome is 'conversion', never 'paid'.
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

CREATE OR REPLACE VIEW public.tool_usage_stats
WITH (security_invoker = true) AS
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

REVOKE ALL ON public.tool_usage_stats FROM anon, public;
GRANT SELECT ON public.tool_usage_stats TO authenticated, service_role;

REVOKE ALL ON public.ai_response_cache FROM anon, public;
GRANT SELECT ON public.ai_response_cache TO authenticated;
GRANT ALL ON public.ai_response_cache TO service_role;

REVOKE ALL ON public.slip_transactions FROM anon, public;
GRANT SELECT, INSERT, UPDATE ON public.slip_transactions TO authenticated;
GRANT ALL ON public.slip_transactions TO service_role;

-- Drop later copies of the same slip reference before the unique index.
DELETE FROM public.slip_transactions a
USING public.slip_transactions b
WHERE a.shop_id = b.shop_id
  AND a.trans_ref IS NOT NULL
  AND btrim(a.trans_ref) <> ''
  AND a.trans_ref = b.trans_ref
  AND a.id <> b.id
  AND (
    a.created_at > b.created_at
    OR (a.created_at = b.created_at AND a.id > b.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_slip_txn_shop_trans_ref
  ON public.slip_transactions (shop_id, trans_ref)
  WHERE trans_ref IS NOT NULL AND btrim(trans_ref) <> '';

SELECT 'Audit security fixes applied' AS result;
