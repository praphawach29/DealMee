-- Phase: Slip-to-Record (LINE photo → transaction)
-- For merchants who need payment evidence without order matching

CREATE TABLE IF NOT EXISTS public.slip_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  amount          NUMERIC NOT NULL,
  trans_ref       TEXT,
  trans_date      TIMESTAMPTZ,
  sender_name     TEXT,
  receiver_name   TEXT,
  bank            TEXT,
  slip_image_url  TEXT,
  source          TEXT NOT NULL DEFAULT 'line_photo' CHECK (source IN ('line_photo', 'manual', 'import')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  confirmed_by    UUID REFERENCES public.users(id),
  confirmed_at    TIMESTAMPTZ,
  note            TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slip_txn_shop_created ON public.slip_transactions (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_slip_txn_shop_status ON public.slip_transactions (shop_id, status);

ALTER TABLE public.slip_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read their shop slip transactions" ON public.slip_transactions;
CREATE POLICY "Users read their shop slip transactions" ON public.slip_transactions
  FOR SELECT USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));
DROP POLICY IF EXISTS "Users insert their shop slip transactions" ON public.slip_transactions;
CREATE POLICY "Users insert their shop slip transactions" ON public.slip_transactions
  FOR INSERT WITH CHECK (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));
DROP POLICY IF EXISTS "Users update their shop slip transactions" ON public.slip_transactions;
CREATE POLICY "Users update their shop slip transactions" ON public.slip_transactions
  FOR UPDATE USING (shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid()));
DROP POLICY IF EXISTS "Service role manages slip transactions" ON public.slip_transactions;
CREATE POLICY "Service role manages slip transactions" ON public.slip_transactions
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

SELECT 'Slip-to-Record (slip_transactions) table created' AS result;
