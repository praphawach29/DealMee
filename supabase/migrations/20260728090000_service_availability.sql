-- Add per-service availability details for booking/queue workflows.
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS staff_name TEXT;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS available_days TEXT[] DEFAULT ARRAY['mon','tue','wed','thu','fri','sat','sun'];
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS start_time TIME DEFAULT '09:00:00';
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS end_time TIME DEFAULT '18:00:00';
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS buffer_minutes INT DEFAULT 0;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

DROP POLICY IF EXISTS "Users can update their shop services" ON public.services;
CREATE POLICY "Users can update their shop services" ON public.services FOR UPDATE USING (
  shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
) WITH CHECK (
  shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can delete their shop services" ON public.services;
CREATE POLICY "Users can delete their shop services" ON public.services FOR DELETE USING (
  shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
);
