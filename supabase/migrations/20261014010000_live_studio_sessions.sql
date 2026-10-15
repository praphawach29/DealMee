-- ================================================================
-- Migration: 20261014010000_live_studio_sessions.sql
-- Description: DealMee AI Live Studio & Real-time Stream Engine
-- Supports 24/7 Virtual Commerce Streamer for TikTok, FB, Shopee
-- ================================================================

-- 1. Create live_sessions table
CREATE TABLE IF NOT EXISTS public.live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'DealMee 24/7 AI Live Stream',
  platform VARCHAR(50) NOT NULL DEFAULT 'tiktok' CHECK (platform IN ('tiktok', 'facebook', 'shopee', 'all')),
  status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'idle', 'ended')),
  current_basket_no INT NOT NULL DEFAULT 1,
  current_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  total_comments INT NOT NULL DEFAULT 0,
  total_cf_orders INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create live_baskets table (Product Lineup for Live Session)
CREATE TABLE IF NOT EXISTS public.live_baskets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  basket_no INT NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  custom_live_price NUMERIC(12, 2),
  pin_status BOOLEAN DEFAULT false,
  highlight_tag TEXT DEFAULT 'สินค้าขายดี',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, basket_no)
);

-- 3. Create live_comments table (Real-time live audit & CF orders)
CREATE TABLE IF NOT EXISTS public.live_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  platform VARCHAR(50) NOT NULL DEFAULT 'tiktok',
  comment_text TEXT NOT NULL,
  action_type VARCHAR(50) DEFAULT 'general', -- 'basket_switch', 'cf_order', 'question', 'general'
  basket_no_triggered INT,
  ai_reply_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS idx_live_sessions_shop ON public.live_sessions(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_live_baskets_shop ON public.live_baskets(shop_id, basket_no);
CREATE INDEX IF NOT EXISTS idx_live_comments_shop ON public.live_comments(shop_id, created_at DESC);

-- 5. Enable RLS
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_baskets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_comments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'live_sessions' AND policyname = 'Users can view live sessions'
  ) THEN
    CREATE POLICY "Users can view live sessions" ON public.live_sessions FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'live_baskets' AND policyname = 'Users can view live baskets'
  ) THEN
    CREATE POLICY "Users can view live baskets" ON public.live_baskets FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'live_comments' AND policyname = 'Users can view live comments'
  ) THEN
    CREATE POLICY "Users can view live comments" ON public.live_comments FOR ALL USING (true);
  END IF;
END $$;
