-- Sales Workflow Stage & Auto-FAQ Synthesis (17 สิงหาคม 2026)
--
-- 1. เพิ่มคอลัมน์ sales_stage ใน conversations เพื่อติดตามขั้นตอนการขาย
--    ค่า: 'greeting' | 'discovery' | 'showcase' | 'closing' | 'post_sale'
-- 2. เพิ่ม Index สำหรับค้นหาบทสนทนาตามสถานะการขาย
-- 3. ตรวจสอบและเพิ่ม Index สำหรับ knowledge_base(shop_id, status) เพื่อรองรับ FAQ ที่ AI ร่างอัตโนมัติ (draft)

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS sales_stage TEXT DEFAULT 'greeting';

CREATE INDEX IF NOT EXISTS idx_conversations_shop_sales_stage
  ON public.conversations(shop_id, sales_stage);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_shop_status
  ON public.knowledge_base(shop_id, status);

SELECT 'Sales workflow and FAQ synthesis schema applied successfully' AS result;
