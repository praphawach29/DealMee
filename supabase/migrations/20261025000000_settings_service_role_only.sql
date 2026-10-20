-- public.settings holds the platform's AI keys (gemini_key, openai_key, claude_key)
-- and each shop's RapidAPI key (rapidapi_key_<shop_id>). Its only policy,
-- "settings_service_only", was FOR ALL TO public USING (true): despite the name it
-- let anyone holding the public anon key read, change or delete every row.
--
-- Every reader and writer is server code using the service role, which bypasses RLS,
-- so the table needs no policy at all. Safe to run more than once.
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings_service_only" ON public.settings;
REVOKE ALL ON public.settings FROM anon, authenticated;
GRANT ALL ON public.settings TO service_role;

-- Expect: rls_enabled = true, policies = 0, anon_can_select = false, authenticated_can_select = false
SELECT
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.settings'::regclass) AS rls_enabled,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'settings') AS policies,
  has_table_privilege('anon', 'public.settings', 'SELECT') AS anon_can_select,
  has_table_privilege('authenticated', 'public.settings', 'SELECT') AS authenticated_can_select;
