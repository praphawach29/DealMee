-- ================================================================
-- Migration: 20261012230000_facebook_messenger_step2.sql
-- Description: Step 2 Facebook Messenger Integration Schema
-- Supports: Facebook Page ID, Page Access Token, App Secret, Verify Token
-- ================================================================

-- 1. Add Facebook configuration fields to public.shops
ALTER TABLE public.shops 
  ADD COLUMN IF NOT EXISTS facebook_page_id TEXT,
  ADD COLUMN IF NOT EXISTS facebook_page_token TEXT,
  ADD COLUMN IF NOT EXISTS facebook_verify_token TEXT,
  ADD COLUMN IF NOT EXISTS facebook_app_secret TEXT;

-- 2. Add comments explaining the columns
COMMENT ON COLUMN public.shops.facebook_page_id IS 'Facebook Page ID (numeric string) connected to Dealmee';
COMMENT ON COLUMN public.shops.facebook_page_token IS 'Facebook Page Access Token (long-lived or system user token) for Graph API';
COMMENT ON COLUMN public.shops.facebook_verify_token IS 'Custom token for Meta Webhook verification handshake (hub.verify_token)';
COMMENT ON COLUMN public.shops.facebook_app_secret IS 'Meta App Secret for X-Hub-Signature-256 HMAC verification';

-- 3. Ensure composite index for fast conversation lookups by platform + sender
CREATE INDEX IF NOT EXISTS idx_conversations_shop_platform_sender 
  ON public.conversations(shop_id, platform, platform_sender_id);

CREATE INDEX IF NOT EXISTS idx_conversations_shop_platform_user 
  ON public.conversations(shop_id, platform, user_id);
