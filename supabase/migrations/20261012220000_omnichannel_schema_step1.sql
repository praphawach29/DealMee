-- ================================================================
-- Migration: 20261012220000_omnichannel_schema_step1.sql
-- Description: Step 1 Omnichannel Unified Inbox Schema
-- Supports: LINE, Facebook, TikTok, Shopee, Lazada, Instagram, Web
-- Features: AI Mode Control (Auto, Copilot, Manual) + Channel Accounts
-- ================================================================

-- 1. Enhance public.conversations table
ALTER TABLE public.conversations 
  ADD COLUMN IF NOT EXISTS ai_mode VARCHAR(20) DEFAULT 'auto';

-- Ensure constraint on ai_mode
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_conversations_ai_mode'
  ) THEN
    ALTER TABLE public.conversations 
      ADD CONSTRAINT chk_conversations_ai_mode 
      CHECK (ai_mode IN ('auto', 'copilot', 'manual'));
  END IF;
END $$;

-- Backfill ai_mode based on status if any rows exist
UPDATE public.conversations 
SET ai_mode = CASE 
  WHEN status = 'human' THEN 'manual' 
  ELSE 'auto' 
END 
WHERE ai_mode IS NULL;

ALTER TABLE public.conversations 
  ALTER COLUMN ai_mode SET NOT NULL,
  ALTER COLUMN ai_mode SET DEFAULT 'auto';

-- Add platform sender ID (e.g. Facebook PSID, LINE userId)
ALTER TABLE public.conversations 
  ADD COLUMN IF NOT EXISTS platform_sender_id TEXT;

-- Backfill platform_sender_id from user_id if null
UPDATE public.conversations 
SET platform_sender_id = user_id 
WHERE platform_sender_id IS NULL;

-- Add channel account ID (which Page or Line OA this belongs to)
ALTER TABLE public.conversations 
  ADD COLUMN IF NOT EXISTS channel_account_id TEXT;

-- Add flexible metadata (stores extra channel profile details)
ALTER TABLE public.conversations 
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Standardize platform default to lowercase 'line'
UPDATE public.conversations 
SET platform = LOWER(platform) 
WHERE platform IS NOT NULL;

ALTER TABLE public.conversations 
  ALTER COLUMN platform SET DEFAULT 'line';

-- Indexes on conversations for high performance omnichannel inbox queries
CREATE INDEX IF NOT EXISTS idx_conversations_shop_platform_last_message 
  ON public.conversations(shop_id, platform, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_shop_ai_mode 
  ON public.conversations(shop_id, ai_mode);

CREATE INDEX IF NOT EXISTS idx_conversations_platform_sender 
  ON public.conversations(shop_id, platform, platform_sender_id);


-- 2. Enhance public.chat_messages table
ALTER TABLE public.chat_messages 
  ADD COLUMN IF NOT EXISTS platform VARCHAR(30) DEFAULT 'line';

ALTER TABLE public.chat_messages 
  ADD COLUMN IF NOT EXISTS platform_message_id TEXT;

ALTER TABLE public.chat_messages 
  ADD COLUMN IF NOT EXISTS ai_suggested_reply TEXT;

ALTER TABLE public.chat_messages 
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.chat_messages 
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Indexes on chat_messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_created 
  ON public.chat_messages(conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_platform_msg_id 
  ON public.chat_messages(platform, platform_message_id);


-- 3. Create public.channel_accounts table for managing connected store channels
CREATE TABLE IF NOT EXISTS public.channel_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  platform VARCHAR(30) NOT NULL CHECK (platform IN ('line', 'facebook', 'tiktok', 'shopee', 'lazada', 'instagram', 'web')),
  account_name TEXT NOT NULL,
  account_id TEXT NOT NULL,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  ai_mode_default VARCHAR(20) NOT NULL DEFAULT 'auto' CHECK (ai_mode_default IN ('auto', 'copilot', 'manual')),
  credentials JSONB DEFAULT '{}'::jsonb,
  webhook_secret TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_shop_channel_account UNIQUE (shop_id, platform, account_id)
);

-- Enable RLS for channel_accounts
ALTER TABLE public.channel_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their shop channel accounts" ON public.channel_accounts;
CREATE POLICY "Users can view their shop channel accounts" ON public.channel_accounts FOR SELECT USING (
  shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can insert their shop channel accounts" ON public.channel_accounts;
CREATE POLICY "Users can insert their shop channel accounts" ON public.channel_accounts FOR INSERT WITH CHECK (
  shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can update their shop channel accounts" ON public.channel_accounts;
CREATE POLICY "Users can update their shop channel accounts" ON public.channel_accounts FOR UPDATE USING (
  shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can delete their shop channel accounts" ON public.channel_accounts;
CREATE POLICY "Users can delete their shop channel accounts" ON public.channel_accounts FOR DELETE USING (
  shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
);

-- Indexes for channel_accounts
CREATE INDEX IF NOT EXISTS idx_channel_accounts_shop_platform 
  ON public.channel_accounts(shop_id, platform);

CREATE INDEX IF NOT EXISTS idx_channel_accounts_platform_account 
  ON public.channel_accounts(platform, account_id);

COMMENT ON TABLE public.channel_accounts IS 'Connected social and e-commerce channels per shop (LINE OA, Facebook Pages, TikTok Shop, etc.)';
COMMENT ON COLUMN public.conversations.ai_mode IS 'AI handling mode for this conversation: auto (full AI auto-reply), copilot (AI draft suggestion), manual (human only)';
COMMENT ON COLUMN public.chat_messages.ai_suggested_reply IS 'AI draft suggestion ready for one-click approval by merchant admin in copilot mode';
