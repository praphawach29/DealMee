-- ================================================================
-- Seed Test Products — for Chat Playground testing (search_products,
-- check_stock, get_active_promotions). Safe to re-run: skips any
-- product that already exists (matched by name) for the target shop.
--
-- Matched to the REAL deployed schema (confirmed via information_schema,
-- differs from supabase_schema_update.sql in this repo):
--   - products has no `status` column at all.
--   - products.stock is TEXT (default 'มี'), not an integer — the
--     Products dashboard (src/app/dashboard/products/actions.ts) writes
--     it as a stringified integer via parseInt(...).toString(), so we
--     seed it the same way for consistency with real product rows.
-- ================================================================

DO $$
DECLARE
  v_shop_id UUID;
BEGIN
  -- Matches by shop name directly (simplest, doesn't depend on which
  -- column links a shop to its owning user). Change the name below if
  -- you want to seed a different shop.
  SELECT id INTO v_shop_id
  FROM public.shops
  WHERE name = 'JackShop'
  LIMIT 1;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'ไม่พบร้านชื่อ "JackShop" กรุณาแก้ไขชื่อร้านในสคริปต์ให้ตรงกับร้านที่ใช้ทดสอบ';
  END IF;

  INSERT INTO public.products (shop_id, name, price, stock, category, description)
  SELECT v_shop_id, v.name, v.price, v.stock, v.category, v.description
  FROM (VALUES
    ('เสื้อยืดลายการ์ตูน', 259, '30', 'เสื้อผ้า', 'เสื้อยืดผ้าคอตตอน 100% พิมพ์ลายการ์ตูนน่ารัก มีให้เลือกหลายไซส์'),
    ('กางเกงยีนส์ขาม้า', 590, '15', 'เสื้อผ้า', 'กางเกงยีนส์ทรงขาม้า ผ้าหนานุ่ม ใส่สบาย'),
    ('กระเป๋าสะพายหนัง PU', 890, '8', 'กระเป๋า', 'กระเป๋าสะพายข้างหนัง PU สีดำ ทรงสวย จุของได้เยอะ'),
    ('รองเท้าผ้าใบสีขาว', 1290, '0', 'รองเท้า', 'รองเท้าผ้าใบสีขาวคลาสสิก ใส่ได้ทุกชุด (สินค้าหมดชั่วคราว)'),
    ('หมวกแก๊ปปักลาย', 350, '20', 'เครื่องประดับ', 'หมวกแก๊ปปักลายโลโก้ ปรับขนาดได้'),
    ('เคสมือถือลายการ์ตูน', 199, '50', 'อุปกรณ์เสริม', 'เคสมือถือซิลิโคนกันกระแทก ลายการ์ตูนน่ารัก'),
    ('ผ้าพันคอไหมพรม', 450, '12', 'เครื่องประดับ', 'ผ้าพันคอไหมพรมนุ่ม กันหนาว มีหลายสี'),
    ('กระบอกน้ำสแตนเลส', 320, '25', 'ของใช้ทั่วไป', 'กระบอกน้ำสแตนเลสเก็บความเย็น 12 ชม.')
  ) AS v(name, price, stock, category, description)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p WHERE p.shop_id = v_shop_id AND p.name = v.name
  );
END $$;

SELECT 'Seeded test products successfully' AS result;
