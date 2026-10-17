-- ================================================================
-- Migration: 20261017010000_processed_webhook_events.sql
-- Description: Remember LINE webhookEventIds so a redelivered event
-- (LINE retries when a webhook answers slowly or fails) is not processed
-- twice — which could create a duplicate order, QR or quotation.
-- Only the service role writes here; no RLS policies are needed for merchants.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
  event_id TEXT PRIMARY KEY,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_created
  ON public.processed_webhook_events(created_at);

ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;
