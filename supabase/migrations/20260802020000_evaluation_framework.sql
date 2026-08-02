-- 20260802020000_evaluation_framework.sql
-- Add tokens_used to chat_messages and create conversation_feedback table
-- for tracking CSAT (Customer Satisfaction) and AI Cost per Conversation (ROADMAP_AI_AGENT.md Section 8).

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS tokens_used INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.conversation_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  feedback_type VARCHAR(50) DEFAULT 'csat',
  feedback_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.conversation_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversation_feedback_select" ON public.conversation_feedback FOR SELECT
  USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_conversation_feedback_shop ON conversation_feedback (shop_id, created_at);

COMMENT ON COLUMN chat_messages.tokens_used IS 'Token count spent generating this AI message turn';
COMMENT ON TABLE conversation_feedback IS 'Customer satisfaction rating (CSAT) and feedback';
