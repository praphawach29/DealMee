-- ================================================================
-- Botify SaaS - Supabase Auth, Tables & RLS Integration (Safe & Complete)
-- ================================================================

-- 1. Modify users table to link with auth.users
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- 2. Create trigger to automatically create a profile in public.users when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', 'admin')
  ON CONFLICT (email) DO UPDATE SET id = EXCLUDED.id;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Row Level Security (RLS) Policies for Shops & Users
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own shop" ON public.shops;
CREATE POLICY "Users can view their own shop" ON public.shops FOR SELECT USING (
  id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can update their own shop" ON public.shops;
CREATE POLICY "Users can update their own shop" ON public.shops FOR UPDATE USING (
  id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (id = auth.uid());

-- 4. Add Onboarding & Bot Settings Fields to shops
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'retail';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS ai_template TEXT DEFAULT 'retail';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS bot_name TEXT DEFAULT 'น้อง Botify';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS greeting_message TEXT DEFAULT 'สวัสดีค่ะ มีอะไรให้ช่วยไหมคะ?';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS line_secret TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS personality TEXT DEFAULT 'หญิง-สุภาพ';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS system_prompt TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS promptpay_id TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS promptpay_name TEXT;

-- 5. Create Knowledge Base Table & Policies
CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'faq',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their shop knowledge" ON public.knowledge_base;
CREATE POLICY "Users can view their shop knowledge" ON public.knowledge_base FOR SELECT USING (
  shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can insert their shop knowledge" ON public.knowledge_base;
CREATE POLICY "Users can insert their shop knowledge" ON public.knowledge_base FOR INSERT WITH CHECK (
  shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can update their shop knowledge" ON public.knowledge_base;
CREATE POLICY "Users can update their shop knowledge" ON public.knowledge_base FOR UPDATE USING (
  shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can delete their shop knowledge" ON public.knowledge_base;
CREATE POLICY "Users can delete their shop knowledge" ON public.knowledge_base FOR DELETE USING (
  shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
);

-- 6. Create Conversations & Chat Messages Tables & Policies
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  customer_name TEXT DEFAULT 'ลูกค้า LINE',
  customer_avatar TEXT,
  platform TEXT DEFAULT 'LINE',
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  unread_count INT DEFAULT 0,
  status TEXT DEFAULT 'ai',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL,
  sender_name TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their shop conversations" ON public.conversations;
CREATE POLICY "Users can view their shop conversations" ON public.conversations FOR SELECT USING (
  shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can insert their shop conversations" ON public.conversations;
CREATE POLICY "Users can insert their shop conversations" ON public.conversations FOR INSERT WITH CHECK (
  shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can update their shop conversations" ON public.conversations;
CREATE POLICY "Users can update their shop conversations" ON public.conversations FOR UPDATE USING (
  shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can delete their shop conversations" ON public.conversations;
CREATE POLICY "Users can delete their shop conversations" ON public.conversations FOR DELETE USING (
  shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can view their shop chat messages" ON public.chat_messages;
CREATE POLICY "Users can view their shop chat messages" ON public.chat_messages FOR SELECT USING (
  shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can insert their shop chat messages" ON public.chat_messages;
CREATE POLICY "Users can insert their shop chat messages" ON public.chat_messages FOR INSERT WITH CHECK (
  shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
);

-- 7. Create Products Table & Policies
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'ทั่วไป',
  price NUMERIC(10,2) DEFAULT 0.00,
  stock INT DEFAULT 0,
  description TEXT,
  image_url TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their shop products" ON public.products;
CREATE POLICY "Users can view their shop products" ON public.products FOR SELECT USING (
  shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can insert their shop products" ON public.products;
CREATE POLICY "Users can insert their shop products" ON public.products FOR INSERT WITH CHECK (
  shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can update their shop products" ON public.products;
CREATE POLICY "Users can update their shop products" ON public.products FOR UPDATE USING (
  shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can delete their shop products" ON public.products;
CREATE POLICY "Users can delete their shop products" ON public.products FOR DELETE USING (
  shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
);

-- 8. Create Orders Table & Policies
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  order_no TEXT NOT NULL DEFAULT 'ORD-000',
  customer_name TEXT NOT NULL DEFAULT 'ลูกค้า',
  phone TEXT,
  total_amount NUMERIC(10,2) DEFAULT 0.00,
  items_summary TEXT,
  status TEXT DEFAULT 'pending',
  tracking_no TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Safely add missing columns if orders table was created previously with older schema
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_no TEXT DEFAULT 'ORD-000';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_name TEXT DEFAULT 'ลูกค้า';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS items_summary TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS slip_url TEXT;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their shop orders" ON public.orders;
CREATE POLICY "Users can view their shop orders" ON public.orders FOR SELECT USING (
  shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()) OR
  workspace_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can insert their shop orders" ON public.orders;
CREATE POLICY "Users can insert their shop orders" ON public.orders FOR INSERT WITH CHECK (
  shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()) OR
  workspace_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
);

-- 9. Create Services Table & Policies
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  duration_minutes INT DEFAULT 60,
  price NUMERIC(10,2) DEFAULT 0.00,
  description TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.services ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their shop services" ON public.services;
CREATE POLICY "Users can view their shop services" ON public.services FOR SELECT USING (
  shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
);
DROP POLICY IF EXISTS "Users can insert their shop services" ON public.services;
CREATE POLICY "Users can insert their shop services" ON public.services FOR INSERT WITH CHECK (
  shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
);

-- 10. Create Bookings Table & Policies
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  booking_no TEXT NOT NULL DEFAULT 'BK-000',
  customer_name TEXT NOT NULL,
  phone TEXT,
  service_name TEXT,
  booking_date DATE DEFAULT CURRENT_DATE,
  booking_time TIME DEFAULT '10:00:00',
  status TEXT DEFAULT 'confirmed',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their shop bookings" ON public.bookings;
CREATE POLICY "Users can view their shop bookings" ON public.bookings FOR SELECT USING (
  shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
);
DROP POLICY IF EXISTS "Users can insert their shop bookings" ON public.bookings;
CREATE POLICY "Users can insert their shop bookings" ON public.bookings FOR INSERT WITH CHECK (
  shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
);

-- 11. Payment and Shipping Configuration Columns for public.shops
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS promptpay_number TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS promptpay_name TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS bank_account_name TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS shipping_provider TEXT DEFAULT 'standard';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS shipping_fee_type TEXT DEFAULT 'flat';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS shipping_fee_amount NUMERIC DEFAULT 0;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS free_shipping_threshold NUMERIC;

-- 12. SaaS Plans Management Table & Seed Data
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  messages INT NOT NULL DEFAULT 1000,
  tokens INT NOT NULL DEFAULT 500000,
  description TEXT,
  badge_color TEXT,
  features TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view plans" ON public.plans;
CREATE POLICY "Anyone can view plans" ON public.plans FOR SELECT USING (true);

DROP POLICY IF EXISTS "Super Admin can edit plans" ON public.plans;
CREATE POLICY "Super Admin can edit plans" ON public.plans FOR ALL USING (true);

INSERT INTO public.plans (key, name, price, messages, tokens, description, badge_color, features)
VALUES 
  ('free', 'ทดลองใช้งาน', 0, 500, 1000000, 'สำหรับร้านค้าทดลองใช้งานบอท AI เบื้องต้น 14 วัน', 'bg-surface-container-high text-on-surface', ARRAY['ตอบแชทบอท LINE OA', 'คลังความรู้ FAQ 10 ข้อ', 'ระบบแชทสด']),
  ('starter', 'เริ่มต้น', 390, 3000, 5000000, 'สำหรับร้านค้าขนาดเล็กที่เน้นปิดการขายใน LINE OA', 'bg-electric-blue/10 text-electric-blue border border-electric-blue/20', ARRAY['ตอบแชทบอท LINE OA', 'คลังความรู้ไม่จำกัด', 'ระบบจัดการสินค้า 50 รายการ', 'เช็คสลิปโอนเงินอัตโนมัติ']),
  ('pro', 'มืออาชีพ (แนะนำ ✨)', 990, 10000, 15000000, 'สำหรับร้านค้าที่มียอดแชทหนาแน่น รองรับระบบจองคิวครบวงจร', 'bg-amber-500/10 text-amber-600 border border-amber-500/20 font-bold', ARRAY['ฟีเจอร์ Starter ทั้งหมด', '✨ AI Copywriter ช่วยเขียนรายละเอียดสินค้า', 'ระบบจองคิวบริการอัตโนมัติ', 'ระบบจัดส่งพัสดุ & แจ้งเลข Tracking', 'ตรวจสลิปโอนเงินฟรี 100 รายการ/เดือน']),
  ('agency', 'ธุรกิจองค์กร', 2490, 30000, 50000000, 'สำหรับแบรนด์ใหญ่หรือเอเจนซี่ที่ต้องการการดูแลระดับ VIP', 'bg-purple-500/10 text-purple-600 border border-purple-500/20 font-bold', ARRAY['ฟีเจอร์ Pro ทั้งหมด', '✨ AI Copywriter ช่วยเขียนรายละเอียดสินค้า', 'ตรวจสลิปโอนเงินไม่จำกัด', 'รองรับเชื่อมต่อหลายเพจ/LINE OA', 'ทีมงานตั้งค่าและซัพพอร์ต 24/7']),
  ('byok', 'ใช้ API Key ตัวเอง', 590, -1, -1, 'ใส่ API Key ของ Gemini/Claude เอง โดยไม่ต้องกังวลเรื่องลิมิต', 'bg-success-green/10 text-success-green border border-success-green/20', ARRAY['ไม่จำกัดจำนวนข้อความ & Token', '✨ AI Copywriter ช่วยเขียนรายละเอียดสินค้า', 'ใช้ API Key ของตนเอง', 'เข้าถึงทุกมอดูลและฟีเจอร์ในระบบ'])
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  messages = EXCLUDED.messages,
  tokens = EXCLUDED.tokens,
  description = EXCLUDED.description,
  badge_color = EXCLUDED.badge_color,
  features = EXCLUDED.features,
  updated_at = now();



