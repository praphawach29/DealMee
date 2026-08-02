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
  doc_number TEXT NOT NULL DEFAULT 'QT-001',
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

-- Ensure all columns exist in case documents table was pre-existing
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS doc_number TEXT NOT NULL DEFAULT 'QT-001',
  ADD COLUMN IF NOT EXISTS doc_type TEXT NOT NULL DEFAULT 'quotation',
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS customer_address TEXT,
  ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- RLS for documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access for document links" ON public.documents;
CREATE POLICY "Allow public read access for document links" ON public.documents
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow shop owners to manage documents" ON public.documents;
CREATE POLICY "Allow shop owners to manage documents" ON public.documents
  FOR ALL USING (
    shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()) OR
    shop_id IN (SELECT id FROM public.shops WHERE id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()))
  );
