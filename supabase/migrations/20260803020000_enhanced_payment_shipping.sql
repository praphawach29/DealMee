-- Migration: Add enhanced payment & shipping columns to shops table
ALTER TABLE public.shops
ADD COLUMN IF NOT EXISTS promptpay_qr_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS shipping_zone_bkk NUMERIC DEFAULT 40,
ADD COLUMN IF NOT EXISTS shipping_zone_upcountry NUMERIC DEFAULT 60,
ADD COLUMN IF NOT EXISTS shipping_zone_remote NUMERIC DEFAULT 100,
ADD COLUMN IF NOT EXISTS cod_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cod_fee_type TEXT DEFAULT 'flat',
ADD COLUMN IF NOT EXISTS cod_fee_amount NUMERIC DEFAULT 30;

COMMENT ON COLUMN public.shops.promptpay_qr_enabled IS 'Whether AI generates dynamic PromptPay QR code in chat';
COMMENT ON COLUMN public.shops.shipping_zone_bkk IS 'Shipping rate for Bangkok and vicinity (THB)';
COMMENT ON COLUMN public.shops.shipping_zone_upcountry IS 'Shipping rate for upcountry provinces (THB)';
COMMENT ON COLUMN public.shops.shipping_zone_remote IS 'Shipping rate for remote/island areas (THB)';
COMMENT ON COLUMN public.shops.cod_enabled IS 'Whether Cash on Delivery (COD) is supported';
COMMENT ON COLUMN public.shops.cod_fee_type IS 'COD fee calculation type: flat or percent';
COMMENT ON COLUMN public.shops.cod_fee_amount IS 'COD fee amount in THB or percentage';
