-- =====================================================================
-- STEP 4: MARKETPLACE PRODUCT SYNC & CENTRAL INVENTORY POOLING
-- =====================================================================

-- 1. Extend products table with Central Stock and Marketplace Source attributes
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS master_sku TEXT,
ADD COLUMN IF NOT EXISTS source_platform VARCHAR(50) DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS external_item_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS marketplace_sync_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_stock_sync TIMESTAMPTZ DEFAULT now();

-- 2. Create index for fast Master SKU lookup and platform filtering
CREATE INDEX IF NOT EXISTS idx_products_master_sku ON public.products(shop_id, master_sku);
CREATE INDEX IF NOT EXISTS idx_products_source_platform ON public.products(shop_id, source_platform);

-- 3. Create marketplace_stock_logs table for cross-channel stock audit trail
CREATE TABLE IF NOT EXISTS public.marketplace_stock_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL DEFAULT 'manual', -- 'shopee', 'tiktok', 'line', 'facebook', 'manual'
    change_amount INTEGER NOT NULL DEFAULT 0,
    balance_after INTEGER NOT NULL DEFAULT 0,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_logs_shop_created ON public.marketplace_stock_logs(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_logs_product ON public.marketplace_stock_logs(product_id);

-- 4. Enable RLS on marketplace_stock_logs
ALTER TABLE public.marketplace_stock_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'marketplace_stock_logs' AND policyname = 'Users can view their shop stock logs'
    ) THEN
        CREATE POLICY "Users can view their shop stock logs"
            ON public.marketplace_stock_logs
            FOR SELECT
            USING (
                shop_id IN (
                    SELECT users.workspace_id FROM public.users WHERE users.id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'marketplace_stock_logs' AND policyname = 'Users can insert their shop stock logs'
    ) THEN
        CREATE POLICY "Users can insert their shop stock logs"
            ON public.marketplace_stock_logs
            FOR INSERT
            WITH CHECK (
                shop_id IN (
                    SELECT users.workspace_id FROM public.users WHERE users.id = auth.uid()
                )
            );
    END IF;
END $$;
