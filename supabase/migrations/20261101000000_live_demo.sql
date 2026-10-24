-- Live demo on the landing page: visitors chat with the real sales engine without signing up.
--
-- Three sample shops (an online clothes shop, a spa that takes bookings, and a cleaning
-- service that answers from its knowledge base). They have no LINE token and admin alerts
-- off, so nothing a visitor does reaches anyone's phone, and a PromptPay ID that belongs to
-- nobody, so a demo QR can't take real money. The app shows a placeholder instead of the QR.
--
-- Cost and abuse are capped in the database, not in memory (serverless instances don't share
-- memory): claim_demo_message() allows a fixed number of messages per visitor per day and a
-- fixed number for everybody per day. cleanup_demo_shops(), run by the follow-up cron, deletes
-- what visitors created and puts stock back.

-- ─── Usage caps ─────────────────────────────────────────────────────────────
create table if not exists public.demo_usage (
  visitor_id text not null,
  day date not null default ((now() at time zone 'Asia/Bangkok')::date),
  messages int not null default 0,
  primary key (visitor_id, day)
);

alter table public.demo_usage enable row level security;
revoke all on table public.demo_usage from anon, authenticated;
grant select, insert, update, delete on table public.demo_usage to service_role;

/**
 * Takes one demo message for a key ('v:<visitor cookie>' or 'ip:<address>'). 'ok', or which
 * cap stopped it. The global count is read first so a refused message doesn't use up a slot.
 */
create or replace function public.claim_demo_message(p_visitor text, p_per_visitor int, p_global int)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'Asia/Bangkok')::date;
  v_global int;
  v_mine int;
begin
  -- Visitors are 'v:<cookie>'; the per-network guard rows ('ip:<address>') count the same
  -- messages a second time, so they stay out of the global total
  select coalesce(sum(messages), 0) into v_global
  from public.demo_usage where day = v_day and visitor_id not like 'ip:%';
  if v_global >= p_global then
    return 'global_limit';
  end if;

  insert into public.demo_usage (visitor_id, day, messages)
  values (p_visitor, v_day, 1)
  on conflict (visitor_id, day) do update
    set messages = public.demo_usage.messages + 1
    where public.demo_usage.messages < p_per_visitor
  returning messages into v_mine;

  if v_mine is null then
    return 'visitor_limit';
  end if;
  return 'ok';
end;
$$;

revoke execute on function public.claim_demo_message(text, int, int) from public;
grant execute on function public.claim_demo_message(text, int, int) to service_role;

-- ─── Sample shops ───────────────────────────────────────────────────────────
-- Fixed ids: the app refers to them (src/lib/demo/shops.ts). Paid plan with no end date so the
-- sales tools are on and no renewal or trial job ever picks them up.
-- The PromptPay columns the app reads (shop.promptpay_id || shop.promptpay_number). Production has
-- promptpay_number but not promptpay_id, so the seed writes promptpay_number and makes sure it exists.
alter table public.shops add column if not exists promptpay_number text;
alter table public.shops add column if not exists promptpay_name text;

insert into public.shops (
  id, name, business_type, ai_template, plan, plan_key,
  bot_name, greeting_message, personality, promptpay_number, promptpay_name, features
) values
  ('d3300000-0000-4000-8000-000000000001', 'Sunday Clothing (ร้านตัวอย่าง)', 'retail', 'retail', 'pro', 'pro',
   'น้องซันเดย์', 'สวัสดีค่ะ ร้าน Sunday Clothing ยินดีต้อนรับค่ะ สนใจเสื้อผ้าแบบไหนบอกได้เลยนะคะ',
   'หญิง-สุภาพ เป็นกันเอง', '0000000000', 'ร้านตัวอย่าง (ไม่ใช่บัญชีจริง)',
   '{"is_demo": true, "admin_notify": false, "auto_reply": true, "booking_system": false}'::jsonb),
  ('d3300000-0000-4000-8000-000000000002', 'Moonlight Spa (ร้านตัวอย่าง)', 'service', 'service', 'pro', 'pro',
   'น้องมูน', 'สวัสดีค่ะ Moonlight Spa ยินดีให้บริการค่ะ อยากดูคิวว่างหรือสอบถามบริการไหนบอกได้เลยนะคะ',
   'หญิง-สุภาพ อบอุ่น', '0000000000', 'ร้านตัวอย่าง (ไม่ใช่บัญชีจริง)',
   '{"is_demo": true, "admin_notify": false, "auto_reply": true, "booking_system": true}'::jsonb),
  ('d3300000-0000-4000-8000-000000000003', 'CleanMate ทำความสะอาดบ้าน (ร้านตัวอย่าง)', 'service', 'service', 'pro', 'pro',
   'น้องคลีน', 'สวัสดีครับ CleanMate บริการทำความสะอาดบ้านและคอนโด สอบถามราคาหรือพื้นที่ให้บริการได้เลยครับ',
   'ชาย-สุภาพ กระชับ', '0000000000', 'ร้านตัวอย่าง (ไม่ใช่บัญชีจริง)',
   '{"is_demo": true, "admin_notify": false, "auto_reply": true, "booking_system": false}'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  business_type = excluded.business_type,
  ai_template = excluded.ai_template,
  plan = excluded.plan,
  plan_key = excluded.plan_key,
  bot_name = excluded.bot_name,
  greeting_message = excluded.greeting_message,
  personality = excluded.personality,
  promptpay_number = excluded.promptpay_number,
  promptpay_name = excluded.promptpay_name,
  features = excluded.features;

-- Never let a sample shop carry a LINE token or a linked admin, whatever was saved on it
update public.shops
set line_token = null, line_secret = null, owner_line_id = null
where id in ('d3300000-0000-4000-8000-000000000001', 'd3300000-0000-4000-8000-000000000002', 'd3300000-0000-4000-8000-000000000003');

-- Products: Sunday Clothing
insert into public.products (id, shop_id, name, category, price, stock, description, status) values
  ('d3300000-0000-4000-8001-000000000001', 'd3300000-0000-4000-8000-000000000001', 'เสื้อเชิ้ตลินิน สีขาว', 'เสื้อ', 590, 50, 'ผ้าลินินผสมคอตตอน ใส่สบาย ระบายอากาศดี มีไซซ์ S M L XL', 'active'),
  ('d3300000-0000-4000-8001-000000000002', 'd3300000-0000-4000-8000-000000000001', 'เสื้อเชิ้ตลินิน สีครีม', 'เสื้อ', 590, 50, 'ผ้าลินินผสมคอตตอน โทนอบอุ่น มีไซซ์ S M L XL', 'active'),
  ('d3300000-0000-4000-8001-000000000003', 'd3300000-0000-4000-8000-000000000001', 'เสื้อยืด Oversize สีดำ', 'เสื้อ', 350, 50, 'คอตตอน 100% ทรงโอเวอร์ไซซ์ ไซซ์ M L XL', 'active'),
  ('d3300000-0000-4000-8001-000000000004', 'd3300000-0000-4000-8000-000000000001', 'กางเกงขากว้าง ผ้าพลีท', 'กางเกง', 690, 50, 'เอวยางยืด ผ้าพลีทไม่ต้องรีด ยาวคลุมข้อเท้า ฟรีไซซ์ เอว 24-34 นิ้ว', 'active'),
  ('d3300000-0000-4000-8001-000000000005', 'd3300000-0000-4000-8000-000000000001', 'กระโปรงยีนส์ทรงเอ', 'กระโปรง', 490, 50, 'ยีนส์ฟอกนุ่ม ยาวเหนือเข่า ไซซ์ S M L', 'active'),
  ('d3300000-0000-4000-8001-000000000006', 'd3300000-0000-4000-8000-000000000001', 'เดรสผ้าฝ้าย ลายดอกเล็ก', 'เดรส', 890, 50, 'ผ้าฝ้ายเนื้อนุ่ม มีซับใน ผูกเอวได้ ไซซ์ S M L', 'active'),
  ('d3300000-0000-4000-8001-000000000007', 'd3300000-0000-4000-8000-000000000001', 'หมวกบักเก็ต ผ้าลินิน', 'เครื่องประดับ', 290, 50, 'ปีกกว้าง กันแดด พับเก็บได้', 'active'),
  ('d3300000-0000-4000-8001-000000000008', 'd3300000-0000-4000-8000-000000000001', 'กระเป๋าผ้าแคนวาส', 'กระเป๋า', 390, 50, 'แคนวาสหนา มีช่องซิปด้านใน ใส่โน้ตบุ๊ก 14 นิ้วได้', 'active')
on conflict (id) do nothing;

-- Services: Moonlight Spa (booking)
insert into public.services (id, shop_id, name, duration_minutes, price, description, status, booking_type, available_days, start_time, end_time, capacity_per_slot) values
  ('d3300000-0000-4000-8002-000000000001', 'd3300000-0000-4000-8000-000000000002', 'นวดไทย 60 นาที', 60, 450, 'นวดไทยแผนโบราณ คลายกล้ามเนื้อทั้งตัว', 'active', 'service', array['mon','tue','wed','thu','fri','sat','sun'], '10:00', '20:00', 3),
  ('d3300000-0000-4000-8002-000000000002', 'd3300000-0000-4000-8000-000000000002', 'นวดน้ำมันอโรมา 90 นาที', 90, 890, 'น้ำมันหอมระเหยเลือกกลิ่นได้ ผ่อนคลายลึก', 'active', 'service', array['mon','tue','wed','thu','fri','sat','sun'], '10:00', '20:00', 2),
  ('d3300000-0000-4000-8002-000000000003', 'd3300000-0000-4000-8000-000000000002', 'นวดเท้า 45 นาที', 45, 350, 'นวดฝ่าเท้าและน่อง กดจุดสะท้อน', 'active', 'service', array['mon','tue','wed','thu','fri','sat','sun'], '10:00', '20:00', 3),
  ('d3300000-0000-4000-8002-000000000004', 'd3300000-0000-4000-8000-000000000002', 'สปาหน้า 60 นาที', 60, 990, 'ทำความสะอาดผิวหน้า มาสก์ และนวดหน้า', 'active', 'service', array['tue','wed','thu','fri','sat','sun'], '11:00', '19:00', 1)
on conflict (id) do nothing;

-- Knowledge: one set per shop
insert into public.knowledge_base (id, shop_id, title, content, category, status) values
  ('d3300000-0000-4000-8003-000000000101', 'd3300000-0000-4000-8000-000000000001', 'ค่าส่งและระยะเวลาจัดส่ง', 'ส่งทั่วประเทศผ่าน Kerry และไปรษณีย์ไทย ค่าส่ง 40 บาท ซื้อครบ 1,000 บาทส่งฟรี สั่งก่อนบ่ายสองโมงส่งของภายในวันนั้น ได้รับภายใน 1-3 วันทำการ', 'faq', 'active'),
  ('d3300000-0000-4000-8003-000000000102', 'd3300000-0000-4000-8000-000000000001', 'การเปลี่ยนไซซ์และคืนสินค้า', 'เปลี่ยนไซซ์ได้ภายใน 7 วันหลังได้รับสินค้า สินค้าต้องยังไม่ผ่านการซักและป้ายยังอยู่ ลูกค้าออกค่าส่งกลับ ร้านส่งตัวใหม่ให้ฟรี', 'faq', 'active'),
  ('d3300000-0000-4000-8003-000000000103', 'd3300000-0000-4000-8000-000000000001', 'ตารางไซซ์เสื้อ', 'S รอบอก 34 นิ้ว · M รอบอก 36 นิ้ว · L รอบอก 38 นิ้ว · XL รอบอก 40 นิ้ว ถ้าชอบใส่หลวมแนะนำเพิ่ม 1 ไซซ์', 'faq', 'active'),
  ('d3300000-0000-4000-8003-000000000201', 'd3300000-0000-4000-8000-000000000002', 'เวลาเปิดและที่ตั้ง', 'เปิดทุกวัน 10:00-20:00 น. อยู่ซอยสุขุมวิท 39 มีที่จอดรถ 4 คัน (ร้านตัวอย่าง ที่อยู่สมมติ)', 'faq', 'active'),
  ('d3300000-0000-4000-8003-000000000202', 'd3300000-0000-4000-8000-000000000002', 'การจองและการยกเลิก', 'จองผ่านแชทได้เลย เลื่อนหรือยกเลิกได้ฟรีก่อนเวลานัด 3 ชั่วโมง มาสายเกิน 15 นาทีอาจได้เวลาน้อยลง', 'faq', 'active'),
  ('d3300000-0000-4000-8003-000000000203', 'd3300000-0000-4000-8000-000000000002', 'ข้อควรรู้ก่อนนวด', 'ไม่แนะนำให้นวดหลังทานอาหารอิ่มทันที ผู้ที่ตั้งครรภ์หรือมีโรคประจำตัวกรุณาแจ้งพนักงานก่อน ร้านมีชุดเปลี่ยนให้', 'faq', 'active'),
  ('d3300000-0000-4000-8003-000000000301', 'd3300000-0000-4000-8000-000000000003', 'ราคาทำความสะอาด', 'คอนโด 1 ห้องนอน 890 บาท (2 ชั่วโมง) · 2 ห้องนอน 1,290 บาท (3 ชั่วโมง) · บ้านเดี่ยวหรือทาวน์โฮมประเมินราคาตามพื้นที่ ส่งรูปหรือบอกจำนวนห้องให้ทีมงานประเมินได้', 'faq', 'active'),
  ('d3300000-0000-4000-8003-000000000302', 'd3300000-0000-4000-8000-000000000003', 'พื้นที่ให้บริการ', 'ให้บริการในกรุงเทพฯ นนทบุรี และสมุทรปราการ (ร้านตัวอย่าง) นอกพื้นที่ติดต่อทีมงานเพื่อสอบถามค่าเดินทาง', 'faq', 'active'),
  ('d3300000-0000-4000-8003-000000000303', 'd3300000-0000-4000-8000-000000000003', 'สิ่งที่รวมในบริการ', 'กวาด ถู ดูดฝุ่น เช็ดฝุ่นเฟอร์นิเจอร์ ล้างห้องน้ำ เช็ดกระจกด้านใน ทิ้งขยะ ทีมงานนำอุปกรณ์และน้ำยามาเอง ไม่รวมการซักผ้าและล้างแอร์', 'faq', 'active'),
  ('d3300000-0000-4000-8003-000000000304', 'd3300000-0000-4000-8000-000000000003', 'การนัดหมาย', 'นัดล่วงหน้าอย่างน้อย 1 วัน ทีมงานจะโทรยืนยันเวลาและราคาก่อนเข้าบริการ ชำระเงินหลังทำความสะอาดเสร็จ', 'faq', 'active')
on conflict (id) do nothing;

-- ─── Cleanup ────────────────────────────────────────────────────────────────
/**
 * Deletes what visitors created in the sample shops (older than p_hours) and puts stock
 * back, so the shops look the same for the next visitor and the tables don't grow.
 * Tables are found by name so a table that doesn't exist on this install is skipped.
 */
create or replace function public.cleanup_demo_shops(p_hours int default 6)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shops uuid[] := array[
    'd3300000-0000-4000-8000-000000000001'::uuid,
    'd3300000-0000-4000-8000-000000000002'::uuid,
    'd3300000-0000-4000-8000-000000000003'::uuid
  ];
  v_cutoff timestamptz := now() - make_interval(hours => p_hours);
  v_stale uuid[];
  v_table text;
  v_count int;
  v_total int := 0;
begin
  -- A conversation is stale once nobody has written in it for p_hours
  select coalesce(array_agg(id), '{}') into v_stale
  from public.conversations
  where shop_id = any(v_shops) and coalesce(last_message_at, created_at) < v_cutoff;

  -- Children first. Each delete runs in its own block: a table this install doesn't have,
  -- or a foreign key nobody expected, skips that one table instead of the whole cleanup.
  foreach v_table in array array[
    'chat_messages', 'payment_slips', 'follow_up_tasks', 'orders', 'bookings',
    'leads', 'customer_profiles', 'sales_trajectories'
  ] loop
    begin
      if to_regclass('public.' || v_table) is null then continue; end if;
      if exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = v_table and column_name = 'conversation_id') then
        execute format('delete from public.%I where conversation_id = any($1)', v_table) using v_stale;
        get diagnostics v_count = row_count;
        v_total := v_total + v_count;
      end if;
      if exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = v_table and column_name = 'shop_id')
         and exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = v_table and column_name = 'created_at') then
        execute format('delete from public.%I where shop_id = any($1) and created_at < $2', v_table)
          using v_shops, v_cutoff;
        get diagnostics v_count = row_count;
        v_total := v_total + v_count;
      end if;
    exception when others then
      raise warning '[cleanup_demo_shops] skipped %: %', v_table, sqlerrm;
    end;
  end loop;

  begin
    delete from public.conversations where id = any(v_stale);
    get diagnostics v_count = row_count;
    v_total := v_total + v_count;
  exception when others then
    raise warning '[cleanup_demo_shops] skipped conversations: %', sqlerrm;
  end;

  update public.products set stock = 50 where shop_id = any(v_shops) and stock < 50;
  delete from public.demo_usage where day < (now() at time zone 'Asia/Bangkok')::date - 7;

  return v_total;
end;
$$;

revoke execute on function public.cleanup_demo_shops(int) from public;
grant execute on function public.cleanup_demo_shops(int) to service_role;
