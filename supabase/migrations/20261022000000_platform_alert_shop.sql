-- Which shop's LINE OA carries platform alerts (wallet top-ups) to the owner: the
-- message goes to that shop's linked admin LINE account. Null = no alerts.
-- Safe to run more than once.
ALTER TABLE public.platform_billing_settings
  ADD COLUMN IF NOT EXISTS notify_shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL;
