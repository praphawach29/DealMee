-- Migration: Enable Row Level Security (RLS) on bot_templates
-- Remediation for Supabase Linter rule: rls_disabled_in_public (0013_rls_disabled_in_public)

ALTER TABLE IF EXISTS public.bot_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view bot templates" ON public.bot_templates;
CREATE POLICY "Anyone can view bot templates"
  ON public.bot_templates
  FOR SELECT
  USING (true);
