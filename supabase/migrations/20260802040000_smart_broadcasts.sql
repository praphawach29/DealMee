-- 20260802040000_smart_broadcasts.sql
-- Create broadcasts table for targeted marketing messages based on customer_profiles memory tags/preferences

CREATE TABLE IF NOT EXISTS public.broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_tag TEXT,
  target_pref_key TEXT,
  target_pref_value TEXT,
  message TEXT NOT NULL,
  recipient_count INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "broadcasts_select" ON public.broadcasts FOR SELECT
  USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_broadcasts_shop ON broadcasts (shop_id, created_at);

COMMENT ON TABLE broadcasts IS 'Smart targeted broadcast campaigns using customer memory profiles';
