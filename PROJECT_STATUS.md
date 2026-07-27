# Botify SaaS - Project Status

> อัปเดตล่าสุด: 28 กรกฎาคม 2026 เวลา 00:31 น.
> GitHub: praphawach29/ai-agent-google-SDK branch main
> Last Commit: e78ff62 - feat(phase-1): implement Phase 1 Core Reliability

---

## Overall Progress

Foundation    ████████████████░░░░  80%
AI Engine     ██████████████████░░  90%
Reliability   ████████████████░░░░  80%  [Phase 1 DONE]
Billing       ░░░░░░░░░░░░░░░░░░░░   0%  [Phase 2 - Next]
Core UX       █████████████░░░░░░░  65%

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.11 (App Router) |
| Language | TypeScript |
| UI Library | shadcn/ui + Base UI + Lucide React |
| Styling | Tailwind CSS + tw-animate-css |
| Database | Supabase (PostgreSQL + RLS + Storage) |
| Auth | Supabase Auth (Email/Password) |
| AI Providers | Gemini (primary) -> Claude -> OpenAI (fallback) |
| LINE Integration | LINE Messaging API (Reply + Push) |
| QR Generation | promptpay-qr + qrcode |
| Slip Verification | EasySlip API (developer.easyslip.com) |
| Deployment | Vercel |

---

## Project Structure

src/app/api/webhook/[shop_id]/ - LINE Webhook + 36-Tool Dispatcher + EasySlip
src/app/api/generate-qr/      - PromptPay QR Code API
src/app/auth/                 - Login / Signup
src/app/onboarding/           - Shop Setup Wizard
src/app/dashboard/
  page.tsx                    - Dashboard Home (Stats)
  inbox/                      - Live Chat Inbox
  orders/                     - Order Management
  products/                   - Product Catalog
  bookings/                   - Booking Calendar
  knowledge/                  - Knowledge Base (FAQ)
  services/                   - Services Management
  modules/                    - Feature Toggles
  menu/                       - Quick Reply Menu
  settings/                   - Shop Settings + actions.ts
  components/ChatPlaygroundModal.tsx - Test chatbot UI
src/app/admin/                - Super Admin Panel (Overview, Shops, Plans, Logs)
src/lib/ai/salesAgentEngine.ts - AI Brain (36 Tools, 3 Providers, Complexity Router)
supabase_schema_update.sql    - Full DB Schema + RLS + Phase 1 updates

---

## Database Schema

| Table | Description | Status |
|---|---|---|
| users | ผู้ใช้งาน linked to auth.users | ACTIVE |
| shops | ข้อมูลร้านค้า (bot_name, line_token, line_secret, promptpay_id, features) | ACTIVE |
| conversations | บทสนทนา LINE ต่อลูกค้า (status: ai/human, customer_note, customer_tag) | ACTIVE |
| chat_messages | ข้อความในแต่ละบทสนทนา | ACTIVE |
| products | สินค้า (name, price, stock, image_url) | ACTIVE |
| orders | ออเดอร์ (+conversation_id, +customer_phone, +product_name, +quantity, +variants, +address, +payment_method, +tax_invoice, payment_status, slip_url) | UPDATED Phase 1 |
| bookings | การจองคิว (booking_no, booking_date, booking_time, status) | ACTIVE |
| services | บริการของร้าน | ACTIVE |
| knowledge_base | FAQ / นโยบายร้าน | ACTIVE |
| promotions | โปรโมชั่นและส่วนลด (discount_type, discount_value, code, end_date) | NEW Phase 1 |
| leads | ลูกค้าสนใจแต่ยังไม่ซื้อ (unique: shop_id+user_id) | NEW Phase 1 |
| plans | SaaS Pricing Plans | ACTIVE |

Supabase Storage:
- qr-codes bucket: เก็บรูป QR PromptPay

---

## AI Brain - salesAgentEngine.ts

### Botify Brain Router
Router เลือก Tool Set ตาม intent ลูกค้า:

| Intent | Tool Set | Provider |
|---|---|---|
| ต่อรองราคา/ขอส่วนลด | Sales Tools (27) | Claude (High-Persuasion) |
| จอง/นัดหมาย | Booking Tools (10) | Gemini |
| ถามออเดอร์/พัสดุ | Support Tools (10) | Gemini |
| ถามทั่วไป | General Tools (4) | Gemini |

### 36 AI Tools + Execution Status

| Category | Tool | Execution Status |
|---|---|---|
| Payment | send_payment_qr | LIVE: Generate QR -> Supabase Storage -> LINE Push |
| Payment | get_payment_slip_status | Defined |
| Payment | send_invoice | Defined |
| Payment | calculate_installment | Defined |
| Payment | apply_custom_discount | Defined |
| Payment | create_quotation | Defined |
| Order | take_order | LIVE: INSERT orders + LINE confirm |
| Order | check_order_status | LIVE: Query orders + status map |
| Order | track_parcel | Defined |
| Order | calculate_shipping | Defined |
| Product | search_products | LIVE: ilike query on products table |
| Product | check_stock | LIVE: stock + price lookup |
| Product | get_product_image | Defined |
| Product | get_upsell_products | Defined |
| Product | get_crosssell_products | Defined |
| Product | recommend_product_match | Defined |
| Product | upsell_suggestion | Defined |
| Booking | check_available_slots | LIVE: Query bookings -> free slots |
| Booking | book_appointment | LIVE: INSERT bookings + confirm |
| Booking | reschedule_booking | Defined |
| Booking | check_booking | Defined |
| Booking | cancel_booking | LIVE: UPDATE status=cancelled |
| Customer | save_lead | LIVE: UPSERT leads |
| Customer | update_customer_note | LIVE: UPDATE conversations.customer_note |
| Customer | add_customer_tag | LIVE: UPDATE conversations.customer_tag |
| Customer | get_customer_history | LIVE: Query orders by conversation |
| Customer | check_loyalty_points | LIVE: Sum paid orders / 100 |
| Knowledge | search_knowledge_base | Defined (needs pgvector) |
| Promotions | get_active_promotions | LIVE: Query promotions table |
| Escalation | request_human_agent | LIVE: status=human + LINE Push |
| Escalation | transfer_to_agent | LIVE: UPDATE + LINE Push |
| Follow-up | schedule_followup | LIVE: setTimeout -> LINE Push |
| New | get_shop_info | Defined |
| New | check_warranty | Defined |
| New | request_review | Defined |
| New | get_return_policy | Defined |

Live Tool Executions: 15/36 (42%)
Defined (AI handles text): 21/36 (58%)

---

## LINE Webhook Flow

LINE OA <- ลูกค้าส่งข้อความ
  ↓
POST /api/webhook/[shop_id]
  ↓
1. Read rawBody (for HMAC)
2. Parse JSON + validate events
3. Fetch shop from Supabase
4. Verify X-Line-Signature (HMAC-SHA256) -> 403 if invalid [NEW Phase 1]
5. Find/Create Conversation
6. Save user message -> chat_messages
7. Check status=human -> skip AI
8. Call processSalesAgentChat() (Botify Brain Router)
9. Save AI reply -> chat_messages
10. LINE Reply API (text)
11. Tool Dispatcher (36 tools, 15 LIVE)
    |- send_payment_qr -> QR -> Supabase Storage -> LINE Push
    |- take_order -> INSERT orders -> LINE Push
    |- search_products -> Query DB -> LINE Push results
    |- book_appointment -> INSERT bookings -> LINE Push
    |- [12 more LIVE tools...]
    |- request_human_agent -> status=human -> LINE Push

Slip Verification Flow (Image Handler):
  ลูกค้าส่งรูปสลิป -> LINE Webhook (event.message.type=image)
    ↓
  Reply: "กำลังตรวจสอบ..."
    ↓
  verifySlipAndNotify() runs in background (non-blocking):
    1. Download image from LINE API
    2. Convert to base64
    3. POST to EasySlip API /v1/verify
    4. Parse: amount, receiver, date, ref
    5. UPDATE orders.payment_status = 'paid'
    6. LINE Push success/fail message
  Fallback: if EASYSLIP_API_KEY not set -> mock approval

---

## SaaS Plans

| Plan | ราคา/เดือน | ข้อความ | Token |
|---|---|---|---|
| ทดลองใช้งาน | ฟรี | 500 | 1M |
| เริ่มต้น | 390 บาท | 3,000 | 5M |
| มืออาชีพ (แนะนำ) | 990 บาท | 10,000 | 15M |
| ธุรกิจองค์กร | 2,490 บาท | 30,000 | 50M |
| BYOK (API Key ตัวเอง) | 590 บาท | ไม่จำกัด | ไม่จำกัด |

---

## Completed Features [Phase 1 DONE]

- [x] Next.js 16 App Router + TypeScript
- [x] Supabase Auth + RLS ทุก Table
- [x] Onboarding Wizard
- [x] Dashboard UI ครบ (Inbox, Orders, Products, Bookings, Knowledge, Settings)
- [x] LINE Webhook รับ-ส่งข้อความ
- [x] AI Sales Agent Engine (Gemini + Claude + OpenAI Fallback)
- [x] Botify Brain Router (ส่ง Tool Set ตาม intent)
- [x] 36 AI Tools (Function Calling ทั้ง 3 Provider)
- [x] PromptPay QR Code (Generate + Supabase Storage + LINE Push)
- [x] Webhook Tool Dispatcher (Side Effects ครบ)
- [x] Admin Takeover (human mode)
- [x] Chat Playground
- [x] SaaS Plans 5 แผน
- [x] Admin Panel (Overview, Shops, Plans, Logs)
- [x] PHASE 1: LINE Signature Verification (HMAC-SHA256)
- [x] PHASE 1: 9 Live Tool Executions (query Supabase จริง)
- [x] PHASE 1: EasySlip API Integration (slip verification จริง)
- [x] PHASE 1: orders table extended (8 columns ใหม่)
- [x] PHASE 1: promotions table + RLS
- [x] PHASE 1: leads table + RLS
- [x] PHASE 1: conversations.customer_note + customer_tag

---

## TODO - Phase 2 (Billing) - สัปดาห์หน้า

| Priority | Feature | Notes |
|---|---|---|
| HIGH | Stripe/Omise Subscription | checkout session, webhook, portal |
| HIGH | usage_logs table | นับ messages/tokens per month |
| HIGH | Plan Enforcement | block AI เมื่อหมด quota |
| HIGH | Billing Dashboard /dashboard/billing | usage bar, upgrade button |
| HIGH | shops.plan_key + subscription fields | track current plan |

## TODO - Phase 3 (Growth) - 2-3 สัปดาห์ถัดไป

| Priority | Feature |
|---|---|
| HIGH | Landing Page (/) - marketing site |
| HIGH | Email Notifications (Resend.com) |
| MEDIUM | Analytics Dashboard /dashboard/analytics |
| MEDIUM | Onboarding ครบทุก step (เชื่อม LINE, เพิ่มสินค้า, ทดสอบ) |

## TODO - Phase 4-5 (Scale + Expansion)

| Priority | Feature |
|---|---|
| MEDIUM | Knowledge Base Vector Search (pgvector) |
| MEDIUM | Mobile Responsive Dashboard |
| LOW | Multi-platform (Facebook, WhatsApp) |
| LOW | White-label Solution |
| LOW | Marketplace / Plugin System |

---

## Environment Variables (Vercel)

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=         # upload Supabase Storage
GEMINI_API_KEY=                    # Primary AI
CLAUDE_API_KEY=                    # High-Persuasion (ต่อรองราคา)
OPENAI_API_KEY=                    # Fallback
EASYSLIP_API_KEY=                  # Slip Verification [Phase 1]
GEMINI_MODEL=gemini-2.5-flash      # optional
OPENAI_MODEL=gpt-4o-mini           # optional

---

## Git History

e78ff62  feat(phase-1): implement Phase 1 Core Reliability
029386e  docs: add ROADMAP.md - 5-phase plan to production SaaS
566b18d  docs: add PROJECT_STATUS.md
c262374  feat: expand AI tool system to 36 tools
10e7b74  feat: implement AI Function Calling (QR payment)
01a6e6a  feat: add PromptPay QR code generation
ae0534f  fix: update payment and shipping settings

---

## Roadmap Overview (แผนทั้งหมด)

Phase 1: Core Reliability  [DONE] 28 กรกฎาคม 2026
Phase 2: Billing System    [NEXT] สัปดาห์ที่ 3-4
Phase 3: Growth & UX              สัปดาห์ที่ 5-7
Phase 4: Scale & Polish           สัปดาห์ที่ 8-10
Phase 5: Expansion                หลัง launch
Beta Launch Target: ~2 เดือน