-- Golden Closers & Sales Trajectories Migration (18 สิงหาคม 2026)
--
-- 1. สร้างตาราง sales_trajectories สำหรับเก็บประวัติการปิดการขายที่สำเร็จจริง (Golden Trajectories)
--    สไตล์ Hermes Agent เพื่อนำมาเป็น Few-shot Prompt สอน AI ในการรับมือลูกค้าและปิดการขาย
-- 2. สร้าง Indexes เพื่อให้ค้นหาตัวอย่างสคริปต์ที่ตรงกับบริบทของลูกค้าได้อย่างรวดเร็ว

CREATE TABLE IF NOT EXISTS public.sales_trajectories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_objection_type TEXT DEFAULT 'general_purchase',
  customer_intent_summary TEXT NOT NULL,
  winning_turn_dialogue JSONB NOT NULL DEFAULT '[]'::jsonb,
  closing_technique TEXT,
  revenue NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index สำหรับค้นหาตามร้านค้าและสถานะ
CREATE INDEX IF NOT EXISTS idx_sales_trajectories_shop_status
  ON public.sales_trajectories(shop_id, status);

-- Index สำหรับค้นหาตามประเภทข้อกังวล/คำถามของลูกค้า
CREATE INDEX IF NOT EXISTS idx_sales_trajectories_objection
  ON public.sales_trajectories(shop_id, customer_objection_type);

-- RLS Policies
ALTER TABLE public.sales_trajectories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their shop sales trajectories" ON public.sales_trajectories;
CREATE POLICY "Users can manage their shop sales trajectories" ON public.sales_trajectories
  FOR ALL
  USING (
    shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
  )
  WITH CHECK (
    shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
  );

SELECT 'Sales trajectories schema created successfully' AS result;
