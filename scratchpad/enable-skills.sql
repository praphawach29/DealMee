-- Enable shop_skills_enabled for all shops (or specific shop)
UPDATE public.shops
SET features = COALESCE(features, '{}'::jsonb) || '{"shop_skills_enabled": true}'::jsonb
WHERE id = 'b806c7e1-ccfa-4f38-bdde-ae215946bfd7';
