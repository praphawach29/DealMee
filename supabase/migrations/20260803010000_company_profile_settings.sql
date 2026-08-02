-- Migration: 20260803010000_company_profile_settings.sql
-- Add Company & Document Profile columns to shops table

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS company_tax_id TEXT,
  ADD COLUMN IF NOT EXISTS company_address TEXT,
  ADD COLUMN IF NOT EXISTS company_phone TEXT,
  ADD COLUMN IF NOT EXISTS company_email TEXT,
  ADD COLUMN IF NOT EXISTS company_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS vat_enabled BOOLEAN DEFAULT false;

-- Add paused_until column to conversations table for Smart Human Auto-Pause
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS paused_until TIMESTAMPTZ;

-- Add documents table if not exists
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  doc_number TEXT NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'quotation',
  customer_name TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  vat_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access for document links" ON public.documents
  FOR SELECT USING (true);

CREATE POLICY "Allow shop owners to manage documents" ON public.documents
  FOR ALL USING (
    shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())
  );
