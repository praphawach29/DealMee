-- Proactive Sales Follow-up & Recovery Engine Migration (18 สิงหาคม 2026)
--
-- 1. สร้างตาราง follow_up_tasks สำหรับจัดคิวส่งข้อความติดตามลูกค้าเชิงรุก (Proactive Follow-up)
--    - qr_recovery: ตามสลิปหลังส่ง QR Code 15-30 นาที
--    - booking_reminder: เตือนนัดหมายล่วงหน้า 24 ชม. และ 3 ชม.
--    - repurchase_check: ทักถามความพึงพอใจและเสนอโปรซื้อซ้ำหลังได้รับสินค้า
-- 2. สร้าง Indexes เพื่อให้ Cron Worker ดึง Task ที่ถึงเวลาทำงานได้อย่างรวดเร็ว

CREATE TABLE IF NOT EXISTS public.follow_up_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  customer_user_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  reference_id TEXT,
  trigger_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_at TIMESTAMPTZ,
  error_message TEXT
);

-- Index สำหรับค้นหา Task ที่ถึงกำหนดเวลาส่ง
CREATE INDEX IF NOT EXISTS idx_follow_up_tasks_status_trigger
  ON public.follow_up_tasks(status, trigger_at);

-- Index สำหรับค้นหา/ยกเลิก Task ตาม shop และ reference_id (เช่น เลขออเดอร์)
CREATE INDEX IF NOT EXISTS idx_follow_up_tasks_shop_ref
  ON public.follow_up_tasks(shop_id, reference_id);

-- Index สำหรับค้นหาตาม conversation_id
CREATE INDEX IF NOT EXISTS idx_follow_up_tasks_conversation
  ON public.follow_up_tasks(conversation_id);

-- เพิ่มคอลัมน์การตั้งค่า Follow-up ในตาราง shops (ถ้ายังไม่มี)
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS follow_up_config JSONB DEFAULT '{
    "qr_recovery_enabled": true,
    "qr_recovery_delay_mins": 20,
    "booking_reminder_enabled": true,
    "repurchase_enabled": true,
    "repurchase_delay_days": 21
  }'::jsonb;

SELECT 'Proactive follow-up engine schema created successfully' AS result;
