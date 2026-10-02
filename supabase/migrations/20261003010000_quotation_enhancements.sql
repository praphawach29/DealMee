-- Migration: 20261003010000_quotation_enhancements.sql
-- Add Authorized Digital Signature to shops and customer acceptance tracking to documents

-- 1. Add company_signature_url to shops
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS company_signature_url TEXT;

-- 2. Add status and accepted_at to documents
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_by TEXT;
