-- 20260802030000_customer_memory_capping.sql
-- Update append_customer_note PostgreSQL function to cap notes array at 50 items
-- preventing unbounded row bloat in customer_profiles table.

CREATE OR REPLACE FUNCTION public.append_customer_note(
  p_shop_id UUID, p_user_id TEXT, p_note TEXT
) RETURNS void AS $$
BEGIN
  UPDATE public.customer_profiles
  SET notes = (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM (
      SELECT elem FROM jsonb_array_elements(
        notes || jsonb_build_array(jsonb_build_object('text', p_note, 'created_at', now()))
      ) AS elem
      ORDER BY (elem->>'created_at') DESC
      LIMIT 50
    ) t
  ),
  updated_at = now()
  WHERE shop_id = p_shop_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Customer memory capping applied successfully' AS result;
