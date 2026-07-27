# Botify SaaS - Development Roadmap to Production

> อัปเดต: 28 กรกฎาคม 2026
> เป้าหมาย: Production-Ready SaaS ที่ร้านค้าสมัครและจ่ายเงินได้จริง
>
> เอกสารนี้คือแผนพัฒนาในอนาคตฉบับเดียว (single source of truth) — สำหรับสถานะปัจจุบันของโปรเจกต์ (progress bar, feature ที่เสร็จแล้ว, บั๊กที่พบ) ดูที่ [PROJECT_STATUS.md](./PROJECT_STATUS.md) แทน เพื่อไม่ให้ตัวเลข % ค้างเก่าไม่ตรงกันระหว่างสองไฟล์

---

## PHASE 1 - Core Reliability (สัปดาห์ 1-2)
> เป้าหมาย: ทุก Tool ที่ AI เรียกใช้ต้องทำงานจริง + ระบบปลอดภัย

### 1.1 Tool Execution จริง

| Task | ไฟล์ | ทำอะไร |
|---|---|---|
| search_products | webhook/route.ts | Query products table ตาม keyword |
| check_stock | webhook/route.ts | Query stock จาก products |
| check_order_status | webhook/route.ts | Query orders ตาม order_id |
| book_appointment | webhook/route.ts | INSERT into bookings |
| check_available_slots | webhook/route.ts | Query bookings ตามวันที่ |
| cancel_booking | webhook/route.ts | UPDATE bookings.status = cancelled |
| get_customer_history | webhook/route.ts | Query orders ตาม user_id |
| check_loyalty_points | webhook/route.ts | Sum orders.total_amount ตาม user_id |
| get_active_promotions | webhook/route.ts | Query promotions table |

### 1.2 LINE Webhook Security

- Signature Verification ตรวจสอบ X-Line-Signature ทุก request ด้วย line_secret
- Rate Limiting จำกัด request per userId per minute
- Message Length Guard ตัดข้อความยาวเกิน limit

### 1.3 Error Handling

- Error Logging ใน Vercel Logs + Sentry
- AI Fallback: ถ้า Gemini+Claude+OpenAI ล้มหมด → ส่ง default message
- Supabase Timeout: ใส่ timeout ทุก DB query (Vercel limit 10s)

### 1.4 orders table ที่ขาดอยู่

ALTER TABLE orders ADD COLUMN IF NOT EXISTS conversation_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS quantity TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS variants TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_invoice TEXT;

Definition of Done Phase 1:
- [ ] ลูกค้าพิมพ์ "มีชุดนอนไหม" บอทค้นหาจาก DB จริง ไม่ตอบเดา
- [ ] บอทกด take_order ออเดอร์ขึ้น Dashboard จริง
- [ ] LINE ส่ง fake webhook มา ระบบ reject ด้วย 403

---

## PHASE 2 - Billing & Monetization (สัปดาห์ 3-4)
> เป้าหมาย: ร้านค้าสมัคร + จ่ายเงินผ่านระบบได้จริง + ถูก block เมื่อหมด quota

### 2.1 Subscription Payment Gateway

ตัวเลือก A: Stripe (แนะนำ - recurring subscription, global)
ตัวเลือก B: Omise (ถ้าเน้นลูกค้าไทย - PromptPay + Thai bank)

ไฟล์ที่ต้องสร้าง:
- src/app/api/billing/checkout/route.ts  - สร้าง checkout session
- src/app/api/billing/webhook/route.ts   - รับ payment event
- src/app/api/billing/portal/route.ts    - Customer billing portal
- src/app/billing/page.tsx               - Pricing page + upgrade UI

### 2.2 Usage Tracking

Table ใหม่:
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id),
  period TEXT NOT NULL,           -- '2026-07'
  messages_used INT DEFAULT 0,
  tokens_used INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

เพิ่มใน shops:
ALTER TABLE shops ADD COLUMN IF NOT EXISTS plan_key TEXT DEFAULT 'free';
ALTER TABLE shops ADD COLUMN IF NOT EXISTS subscription_id TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';
ALTER TABLE shops ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;

### 2.3 Plan Enforcement (Gate Keeper)

ก่อน AI ตอบ ตรวจ quota:
- free: 500 messages
- starter: 3,000 messages
- pro: 10,000 messages
- agency: 30,000 messages
- byok: unlimited

### 2.4 Billing Dashboard Page

/dashboard/billing:
- แสดงแผนปัจจุบัน
- Usage Bar (used / limit)
- ปุ่ม Upgrade Plan
- ประวัติการชำระเงิน (Stripe Portal)

Definition of Done Phase 2:
- [ ] ร้านสมัคร Pro จ่าย 990 บาท plan_key เปลี่ยนเป็น 'pro' อัตโนมัติ
- [ ] ร้านใช้ครบ quota บอทหยุดตอบ + แจ้งลูกค้า
- [ ] Dashboard แสดง usage จริง

---

## PHASE 3 - Growth & UX (สัปดาห์ 5-7)
> เป้าหมาย: ร้านค้าสมัครเองได้ + ใช้งานได้โดยไม่ต้องมีคนช่วย

### 3.1 Slip Auto-Verification API (จุดขายหลัก)

API ที่ต้องใช้:
- SlipOK (slipok.com): รองรับ PromptPay ทุกธนาคาร
- EasySlip (easyslip.com): ใช้งานง่าย

Flow:
  ลูกค้าส่งรูปสลิป LINE
  -> Download image จาก LINE API
  -> ส่งไป SlipOK/EasySlip
  -> ตรวจสอบ amount + receiver
  -> UPDATE orders.payment_status = 'paid'
  -> แจ้งยืนยันให้ลูกค้า + เจ้าของร้าน

เวอร์ชันขั้นสูงกว่า (ในอนาคต หลัง SlipOK/EasySlip เสถียรแล้ว): เชื่อมต่อ API ธนาคารโดยตรง (Automated Bank Slip Verification API) แทนการพึ่งพา 3rd-party aggregator

### 3.2 Landing Page (Marketing Site)

/ (Landing Page):
  - Hero: "บอท AI ขายของบน LINE ให้คุณตลอด 24 ชม"
  - Features (36 Tools, QR PromptPay, Slip Verify)
  - Pricing (5 แผน)
  - Demo Video / Chat Demo
  - Testimonials
  - CTA: "ทดลองฟรี 14 วัน"

/about, /features, /pricing (SEO pages)

### 3.3 Email Notifications (Resend.com)

| Trigger | Email |
|---|---|
| สมัครใหม่ | Welcome + setup guide |
| มีออเดอร์ใหม่ | แจ้งเจ้าของร้าน |
| ลูกค้าส่งสลิป | แจ้งเจ้าของร้าน |
| quota 80% | เตือน upgrade |
| quota หมด | แจ้งด่วน + ลิงก์ upgrade |

### 3.4 Analytics / ROI & Performance Dashboard

/dashboard/analytics:
  - ยอดขายรายวัน/เดือน (Chart)
  - อัตราปิดการขาย (Conversion Rate)
  - สินค้าขายดี Top 5
  - ชั่วโมงที่ลูกค้าแชทมากที่สุด
  - Leads ที่ยังไม่ปิดการขาย
  - AI Tools ที่ถูกเรียกมากที่สุด
  - Cost Per Conversation (CPC) — ต้นทุน AI ต่อบทสนทนา
  - Average Response Time — เวลาตอบเฉลี่ยของบอท
  - CSAT Score — ความพึงพอใจลูกค้า

### 3.6 Customer Memory Graph (Entity Profile)

บันทึกรสนิยม ไซส์สินค้า และประวัติสั่งซื้อของลูกค้าแต่ละคนแบบ Graph/Entity แทนการดึงแค่ chat history ย้อนหลัง 10 ข้อความ เพื่อให้ AI ทำตัวเป็น Personal Shopper ที่จำลูกค้าได้ข้ามบทสนทนา ไม่ใช่แค่ภายในบทสนทนาเดียว

### 3.5 Onboarding ที่สมบูรณ์

Step 1: ตั้งค่าร้านค้า (ชื่อ, ประเภท) - มีแล้ว
Step 2: เชื่อมต่อ LINE OA (Token + Secret + verify webhook) - ยังขาด
Step 3: เพิ่มสินค้า/บริการแรก 3-5 รายการ
Step 4: ตั้งค่าชำระเงิน (PromptPay + บัญชีธนาคาร)
Step 5: ทดสอบบอท (Chat Playground)
Step 6: Launch!

Definition of Done Phase 3:
- [ ] ร้านค้าสมัคร setup เสร็จใน 10 นาที โดยไม่ต้องมีคนช่วย
- [ ] สลิปตรวจสอบจริง ไม่ใช่ mock
- [ ] เจ้าของร้านรับ email เมื่อมีออเดอร์

---

## PHASE 4 - Scale & Polish (สัปดาห์ 8-10)
> เป้าหมาย: รองรับ 100+ ร้านค้าพร้อมกัน

### 4.1 Performance

| ปัญหา | แก้ |
|---|---|
| Webhook ช้า (DB queries เยอะ) | Cache shop data ใน Vercel KV หรือ Redis |
| AI ตอบช้า | Streaming Response แทน wait ทั้งก้อน |
| รูป QR โหลดช้า | Supabase CDN + cache-control header |

### 4.2 Mobile Responsive Dashboard

- Sidebar collapsible บนมือถือ
- Inbox แสดงผลได้บนหน้าจอเล็ก
- Order cards mobile-friendly

### 4.3 Knowledge Base Vector Search

- ติดตั้ง pgvector extension ใน Supabase
- เพิ่ม embedding column ใน knowledge_base
- Semantic search แทน keyword search

### 4.4 Super Admin Panel ให้ครบ

มีแล้ว: Overview, Shops, Plans, Logs
ยังขาด: Revenue graph (MRR, Churn, LTV), Announcements

Definition of Done Phase 4:
- [ ] Webhook ตอบภายใน 3 วินาที (LINE timeout limit)
- [ ] Dashboard ใช้ได้บนมือถือ
- [ ] search_knowledge_base ค้นหา semantic ได้

---

## PHASE 5 - Expansion (หลัง Launch)

### 5.1 Multi-Platform

| Platform | Impact |
|---|---|
| Facebook Messenger | High |
| WhatsApp Business API | High |
| Instagram Direct | Medium |
| TikTok Shop | Medium |
| Web Chat Widget | Medium |

### 5.2 White-Label Solution

ขายให้เอเจนซี่ไปขายต่อ:
- Custom domain
- Custom branding
- Agency dashboard (จัดการหลายร้าน)
- Revenue sharing

### 5.3 Marketplace / Plugin System

- Shopee/Lazada sync
- Google Sheets sync
- Automated Shipping & Tracking: เชื่อมต่อ Flash Express / Kerry / J&T / ไปรษณีย์ไทย สำหรับสร้างเลขพัสดุและแจ้งลูกค้าอัตโนมัติใน LINE OA (ทำให้ tools `track_parcel`/`calculate_shipping` ที่ตอนนี้เป็นแค่ "Defined" กลายเป็น LIVE)

---

## Priority Matrix

ทำ Phase 1 ก่อน โดยเฉพาะ:
1. search_products Tool -> Query DB จริง (1 ชั่วโมง)
2. LINE Signature Verification (30 นาที)
3. orders table columns เพิ่ม (15 นาที)
4. Slip Verification จาก Mock -> SlipOK จริง (จุดขายหลัก)

หลัง Phase 1 -> Phase 2 (Billing) คือขั้นที่เปลี่ยนจาก "ระบบทดสอบ" เป็น "SaaS จริง"

---

## Estimated Timeline

| Phase | งาน | เวลา |
|---|---|---|
| Phase 1 | Core Reliability | 1-2 สัปดาห์ |
| Phase 2 | Billing System | 1-2 สัปดาห์ |
| Phase 3 | Growth & UX | 2-3 สัปดาห์ |
| Phase 4 | Scale & Polish | 2-3 สัปดาห์ |
| Launch | Beta Launch | ~2 เดือน |
| Phase 5 | Expansion | หลัง launch |

---
*อัปเดตไฟล์นี้ทุกครั้งที่ Phase เสร็จสมบูรณ์*
