-- ================================================================
-- Migration: 20261014000000_competitor_intelligence.sql
-- Description: Competitor Intelligence & Market Scraping Schema
-- Inspired by cporter202/social-media-scraping-apis
-- ================================================================

-- 1. Create competitors table
CREATE TABLE IF NOT EXISTS public.competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform VARCHAR(50) NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'facebook', 'shopee', 'lazada')),
  target_url TEXT NOT NULL,
  handle TEXT,
  avatar_url TEXT,
  follower_count BIGINT DEFAULT 0,
  avg_engagement_rate NUMERIC(6, 2) DEFAULT 0.00,
  price_range_min NUMERIC(12, 2) DEFAULT 0.00,
  price_range_max NUMERIC(12, 2) DEFAULT 0.00,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  last_scanned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create competitor_posts table (stores top performing viral posts)
CREATE TABLE IF NOT EXISTS public.competitor_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  post_url TEXT NOT NULL,
  thumbnail_url TEXT,
  title_or_caption TEXT,
  views_count BIGINT DEFAULT 0,
  likes_count BIGINT DEFAULT 0,
  comments_count BIGINT DEFAULT 0,
  shares_count BIGINT DEFAULT 0,
  estimated_sales BIGINT DEFAULT 0,
  engagement_rate NUMERIC(6, 2) DEFAULT 0.00,
  hashtags TEXT[] DEFAULT '{}',
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_competitors_shop ON public.competitors(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_competitors_platform ON public.competitors(shop_id, platform);
CREATE INDEX IF NOT EXISTS idx_competitor_posts_competitor ON public.competitor_posts(competitor_id, views_count DESC);
CREATE INDEX IF NOT EXISTS idx_competitor_posts_shop ON public.competitor_posts(shop_id, published_at DESC);

-- 4. Enable RLS
ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_posts ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'competitors' AND policyname = 'Users can view their shop competitors'
  ) THEN
    CREATE POLICY "Users can view their shop competitors"
      ON public.competitors FOR ALL
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'competitor_posts' AND policyname = 'Users can view their shop competitor posts'
  ) THEN
    CREATE POLICY "Users can view their shop competitor posts"
      ON public.competitor_posts FOR ALL
      USING (true);
  END IF;
END $$;
