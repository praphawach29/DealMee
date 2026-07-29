-- Knowledge Base import sources (30 กรกฎาคม 2026)
--
-- เดิมเจ้าของร้านต้องพิมพ์ถาม-ตอบเองทีละข้อ ซึ่งเป็นกำแพงตอนเริ่มใช้งานจริง
-- รอบนี้เพิ่มการดูดข้อมูลจาก URL / PDF / CSV เข้ามาอัตโนมัติ
--
-- คอลัมน์ที่เพิ่ม:
--   source      = ที่มาของข้อมูล ('manual' | 'url' | 'pdf' | 'csv')
--   source_ref  = อ้างอิงต้นทาง เช่น URL หรือชื่อไฟล์ ใช้ให้ผู้ใช้ลบยกชุดได้
--                 ตอน import ใหม่ทับของเก่า โดยไม่ต้องลบทีละข้อ
--
-- ตรวจ schema จริงก่อนรันเสมอ (กฎเหล็กข้อ 5): supabase/tools/check_schema.sql

ALTER TABLE public.knowledge_base
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

ALTER TABLE public.knowledge_base
  ADD COLUMN IF NOT EXISTS source_ref TEXT;

-- ใช้ตอนลบ/แทนที่ข้อมูลทั้งชุดจากต้นทางเดียวกัน และตอนดึงเข้า prompt
CREATE INDEX IF NOT EXISTS idx_knowledge_base_shop_source
  ON public.knowledge_base(shop_id, source, source_ref);

SELECT 'Knowledge import source columns applied successfully' AS result;
