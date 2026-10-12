-- ================================================================
-- Migration: 20261013020000_omnichannel_step3.sql
-- Description: Step 3 Omnichannel Multi-Channel Broadcast & Marketplace Integration
-- Supports: LINE, Facebook, TikTok Shop, Shopee
-- ================================================================

-- 1. Extend shops table for TikTok Shop & Shopee credentials
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS tiktok_app_key TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_app_secret TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_shop_id TEXT,
  ADD COLUMN IF NOT EXISTS shopee_partner_id TEXT,
  ADD COLUMN IF NOT EXISTS shopee_partner_key TEXT,
  ADD COLUMN IF NOT EXISTS shopee_shop_id TEXT;

-- 2. Extend broadcasts table for Multi-Channel Omnichannel delivery
ALTER TABLE public.broadcasts
  ADD COLUMN IF NOT EXISTS channels TEXT[] DEFAULT ARRAY['line']::TEXT[],
  ADD COLUMN IF NOT EXISTS channel_stats JSONB DEFAULT '{"line": 0, "facebook": 0}'::JSONB,
  ADD COLUMN IF NOT EXISTS success_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_count INTEGER DEFAULT 0;

-- 3. Create index for platform filtering on conversations
CREATE INDEX IF NOT EXISTS idx_conversations_shop_platform 
  ON public.conversations (shop_id, platform, last_message_at DESC);

-- 4. Ensure channel_accounts table has unique constraint on shop_id and platform
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_channel_accounts_shop_platform'
  ) THEN
    ALTER TABLE public.channel_accounts
      ADD CONSTRAINT uq_channel_accounts_shop_platform UNIQUE (shop_id, platform);
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;
