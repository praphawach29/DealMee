-- 20260802010000_sales_workflow_engine.sql
-- Add sales_stage column to conversations table for tracking customer journey stages:
-- 'greeting' -> 'showcase' -> 'closing' -> 'post_sale'

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS sales_stage VARCHAR(50) NOT NULL DEFAULT 'greeting';

-- Ensure valid stage values via constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_conversations_sales_stage'
  ) THEN
    ALTER TABLE conversations ADD CONSTRAINT chk_conversations_sales_stage
      CHECK (sales_stage IN ('greeting', 'showcase', 'closing', 'post_sale'));
  END IF;
END $$;

-- Create index for filtering conversations by stage
CREATE INDEX IF NOT EXISTS idx_conversations_shop_stage ON conversations (shop_id, sales_stage);

COMMENT ON COLUMN conversations.sales_stage IS 'Current sales funnel stage: greeting, showcase, closing, post_sale';
