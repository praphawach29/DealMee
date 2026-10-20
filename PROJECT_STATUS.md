# DealMee AI (DealMee.app) - Project Status

> อัปเดตล่าสุด: 20 ตุลาคม 2026 (กระเป๋าเงิน, Super Admin คนเดียว, รีเซ็ตรหัสผ่าน — PR #29–#49 ดูรายละเอียดใน TODO.md)
> แผนงานถัดไปของบอทขาย & onboarding: [docs/plans/2026-10-17-bot-sales-and-onboarding-next-steps.md](./docs/plans/2026-10-17-bot-sales-and-onboarding-next-steps.md)
> GitHub: praphawach29/ai-agent-google-SDK branch main
> Handover & Action Checklist: ดูรายละเอียดเพิ่มเติมที่ [TODO.md](./TODO.md)
>
> เอกสารนี้คือแหล่งข้อมูลสถานะปัจจุบันของโปรเจกต์ฉบับเดียว (single source of truth)
> สำหรับแผนพัฒนาในอนาคตดูที่ [ROADMAP.md](./ROADMAP.md)

---

## Overall Progress

Foundation               ████████████████████  98%
AI Sales Engine          ████████████████████ 100%
Omnichannel AI Agent     ████████████████████ 100%  [Pillar 1: LINE + FB + IG + Pooled Inventory DONE]
Competitor Intelligence  ████████████████████ 100%  [Pillar 2: Social Scraping + Spy Dashboard DONE]
DealMee AI Live Studio   ████████████████████ 100%  [Pillar 3: 24/7 OBS 60fps Overlay + Comment Switcher DONE]
Central Inventory Pool   ████████████████████ 100%  [Realtime Multi-platform Sync DONE]
B2B Quotation Engine     ████████████████████ 100%  [PDF/Word/Excel + Sign DONE]
Billing & Subscription   ████████████████░░░░  85%  [Stripe + Omise + Manual Slip]
Official Branding        ████████████████████ 100%  [DealMee Logo Concept D1]

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.11 (App Router) |
| Language | TypeScript |
| UI Library | shadcn/ui + Base UI + Lucide React |
| Styling | Tailwind CSS + tw-animate-css |
| Database | Supabase (PostgreSQL + RLS + Storage) |
| Auth | Supabase Auth (Email/Password) · Super Admin: `src/lib/auth/superAdmin.ts` · อีเมลใช้ลิงก์ `token_hash` (`docs/email-templates/`) |
| AI Providers | Gemini 3.6 Flash (primary) -> Claude Sonnet 5 (high-persuasion) -> GPT-5.6 Luna (fallback) |
| LINE Integration | LINE Messaging API (Reply + Push) |
| QR Generation | promptpay-qr + qrcode |
| Slip Verification | EasySlip API (developer.easyslip.com) |
| Billing (Stripe) | stripe npm SDK - recurring subscription, Checkout, Billing Portal |
| Billing (Omise) | Omise/Opn Payments REST API - PromptPay one-time charge |
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
  products/                   - Product Catalog (Custom Categories, Local Image Upload + preview, AI Copywriter [Pro/Agency/BYOK only], CSV Bulk Import + template download)
  bookings/                   - Booking Calendar
  knowledge/                  - Knowledge Base (FAQ)
  services/                   - Services Management
  modules/                    - Feature Toggles
  menu/                       - Quick Reply Menu
  settings/                   - Shop Settings + actions.ts (+ Chat Playground quota preview)
  billing/                    - [NEW Phase 2] Billing Dashboard (plan, usage bars, upgrade, payment history)
  components/ChatPlaygroundModal.tsx - Test chatbot UI (shows live quota status + "simulate quota exceeded" preview)
src/app/admin/                - Super Admin Panel (Overview, Shops, Plans, Logs incl. Stripe Price ID)
src/app/api/billing/          - [NEW Phase 2] checkout, portal, webhook/stripe, webhook/omise
src/lib/ai/salesAgentEngine.ts - AI Brain (36 Tools, 3 Providers, Complexity Router, Quota Gate)
src/lib/billing/               - [NEW Phase 2] stripe.ts, omise.ts, usage.ts
src/lib/supabase/admin.ts      - [NEW Phase 2] shared service-role Supabase client
src/proxy.ts                    - [RENAMED Phase 2] was middleware.ts (Next.js 16 Proxy convention)
supabase/                    - [REORGANIZED 28 ก.ค.] all SQL moved out of repo root into migrations/ + tools/ — see supabase/README.md

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
| plans | SaaS Pricing Plans (+stripe_price_id) | UPDATED Phase 2 |
| shops | +plan_key, subscription_provider, subscription_id, subscription_status, plan_expires_at, stripe_customer_id, omise_customer_id | UPDATED Phase 2 |
| usage_logs | นับ messages_used/tokens_used ต่อร้านต่อเดือน (unique: shop_id+period) + increment_usage() RPC | NEW Phase 2 |
| billing_payments | ประวัติการชำระเงิน (provider, plan_key, amount, status, provider_ref) | NEW Phase 2 |
| customer_profiles | Customer Memory Graph: tags/notes แบบ append-only (jsonb), preferences, total_orders/total_spend/last_order_at (unique: shop_id+user_id) | NEW [AI Agent Upgrade 1/5] |
| ai_provider_usage | ต้นทุน AI ต่อ provider ต่อร้าน/เดือน (prompt/completion/cache_read/cache_write tokens, unique: shop_id+period+provider) — ป้อนข้อมูลให้ Margin Dashboard | NEW [Cost Infra] |

Supabase Storage:
- qr-codes bucket: เก็บรูป QR PromptPay

---

## AI Brain - salesAgentEngine.ts

### Consultative Sales Closer & Objection Handling [UPGRADED 17 สิงหาคม 2026]
- **Bridge Questions:** ทุกคำตอบลงท้ายด้วยคำถาม 1 คำถามเพื่อคุมบทสนทนาและนำทางสู่ขั้นตอนต่อไปเสมอ
- **Objection & Hesitation Handling Matrix:** รับมือข้อกังวล 4 ด้าน (ราคา, คุณภาพ/ความมั่นใจ, ไซส์/สูตร, การจัดส่ง) พร้อมชูความคุ้มค่าและ Social Proof
- **Alternative Close:** ปิดการขายด้วยตัวเลือก 2 ทาง (เช่น รับ 1 ชิ้น หรือเซ็ต 2 ชิ้นส่งฟรี / QR หรือเก็บปลายทาง)
- **Hesitation Scoring:** ตรวจจับคำว่า 'คิดดูก่อน', 'ขอดูก่อน', 'ของแท้ไหม', 'กลัวแพ้' ฯลฯ เพื่อกระตุ้น Model Router ให้ส่งโมเดล High-Persuasion

### Customer Memory Graph [NEW - AI Agent Upgrade 1/5, 28 กรกฎาคม 2026]
ทุกข้อความจะ auto-inject โปรไฟล์ลูกค้า (`customer_profiles`) เข้า system prompt โดยไม่ต้องเรียก tool — เห็น tags/notes ที่สะสมมา (append-only ไม่ overwrite เหมือน `conversations.customer_note`/`customer_tag` แบบเดิม), preferences, และสรุปยอดซื้อสะสม (`total_orders`/`total_spend`) ที่อัปเดตอัตโนมัติทุกครั้งที่ `take_order` สำเร็จ ดูรายละเอียดที่ [ROADMAP_AI_AGENT.md](./ROADMAP_AI_AGENT.md)

### Botify Brain Router
Router เลือก Tool Set ตาม intent ลูกค้า:

| Intent | Tool Set | Provider |
|---|---|---|
| ต่อรองราคา/ลังเล/ขอส่วนลด | Sales Tools (27) | Claude (High-Persuasion) / GPT-5.6 |
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
4. Verify X-Line-Signature (HMAC-SHA256, constant-time) -> 403 if invalid OR missing when the shop has a Channel Secret [17 ต.ค. 2026]
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

Quota Gate [NEW Phase 2]:
  ก่อนเรียก AI Provider ทุกครั้ง -> getQuotaStatus(shop) เช็ค usage_logs เดือนปัจจุบัน เทียบกับ plans.messages
    - plan_key = 'byok' หรือ messages = -1 -> ไม่จำกัด ข้ามการเช็ค
    - subscription หมดอายุ (plan_expires_at ผ่านไปแล้ว) -> fallback เป็น limit ของแผน free
    - เกินโควต้า -> ส่งข้อความแจ้งลูกค้า ไม่เรียก AI Provider (ประหยัดค่าใช้จ่าย) ไม่รัน Tool Dispatcher
  ตอบสำเร็จ -> incrementUsage() เพิ่ม messages_used +1 และ tokens_used ตาม usage จริงจาก Provider (atomic RPC)

Slip Verification Flow (Image Handler) [ปรับใหม่ 17 ต.ค. 2026 — PR #2]:
  ลูกค้าส่งรูป -> LINE Webhook (event.message.type=image)
    ↓
  Reply: "กำลังตรวจสอบ..."
    ↓
  verifySlipAndNotify():
    1. Download image from LINE API
    2. หาออเดอร์ pending ของ "ลูกค้าคนนี้" เท่านั้น (conversation เดียวกัน) — ไม่หยิบออเดอร์ของคนอื่นอีกต่อไป
    3. verifySlip() ผ่าน EasySlip / Thunder / SlipOK
       - ไม่มี API key หรือ provider=mock -> manualReview (ไม่อนุมัติอัตโนมัติอีกต่อไป)
    4. ต้องผ่านครบ: ยอดตรง (±1 บาท), บัญชีผู้รับเป็นของร้าน (checkSlipReceiver เทียบเลขที่ถูกปิดบางส่วน), เลขอ้างอิงไม่ซ้ำ ([slip-ref:...] ใน orders.note)
    5. ผ่าน -> UPDATE orders.status='paid' (เฉพาะถ้ายัง pending) + แจ้งลูกค้า + แจ้งแอดมิน
    6. ไม่ผ่าน/ตัดสินไม่ได้ -> แจ้งลูกค้าว่ารอแอดมินตรวจ + แจ้งเตือนแอดมินทาง LINE (ไม่เปลี่ยนสถานะออเดอร์)

Order / QR / Quotation pricing [17 ต.ค. 2026 — PR #3, #4]:
  - take_order: ราคา = ราคาในตาราง products × จำนวน + ค่าส่งตามตั้งค่าร้าน (src/lib/ai/catalogPricing.ts); ไม่พบสินค้า/สต๊อกไม่พอ -> ไม่สร้างออเดอร์
  - send_payment_qr: ยอดดึงจากออเดอร์ pending ของลูกค้าคนนั้น (หรือมัดจำการจอง) ไม่ใช้ยอดจาก AI
  - create_quotation: ราคาต่อรายการจาก products, ไม่มีส่วนลดจาก AI; accept_quotation แปลงใบเสนอราคาของแชทนั้นเป็นออเดอร์
  - apply_custom_discount: ลดได้ครั้งเดียวต่อออเดอร์ ไม่เกิน features.max_discount_percent (ตั้งที่หน้าเครื่องมือ & ทักษะ AI, ค่าเริ่มต้น 0 = ปิด)

Follow-up queue [17 ต.ค. 2026 — PR #4, #5]:
  follow_up_tasks (qr_recovery / booking_reminder / repurchase_check / scheduled_message)
  <- GitHub Actions .github/workflows/follow-up-cron.yml ทุก 5 นาที -> POST /api/cron/follow-up (Bearer CRON_SECRET)
  งานที่เลยเวลาเกิน 24 ชม. ถูกยกเลิก ไม่ส่งย้อนหลัง

---

## Billing Flow [NEW Phase 2]

Subscription (Stripe, global cards):
  /dashboard/billing -> UpgradeButton (provider=stripe) -> POST /api/billing/checkout
    -> Stripe Checkout Session (mode=subscription, metadata: shop_id+plan_key) -> redirect ลูกค้าไปหน้าชำระเงิน Stripe
  Stripe ยิง Webhook -> POST /api/billing/webhook/stripe (verify signature ด้วย STRIPE_WEBHOOK_SECRET)
    |- checkout.session.completed -> shops.plan_key/subscription_provider='stripe'/subscription_id/stripe_customer_id + insert billing_payments (succeeded)
    |- customer.subscription.updated -> sync subscription_status + plan_expires_at
    |- customer.subscription.deleted -> subscription_status='canceled' (plan_key คงเดิมจนกว่า plan_expires_at จะหมดอายุ)
    |- invoice.payment_failed -> subscription_status='past_due' + insert billing_payments (failed)
  จัดการบัญชี: ปุ่ม "จัดการการชำระเงิน" -> POST /api/billing/portal -> Stripe Billing Portal

One-time PromptPay (Omise/Opn Payments, ไม่มี recurring/portal ในตัว):
  /dashboard/billing -> UpgradeButton (provider=omise) -> POST /api/billing/checkout
    -> สร้าง Omise Charge (source=promptpay) -> คืน QR Code ให้สแกนในหน้าเว็บ (ไม่ redirect)
  Omise ยิง Webhook -> POST /api/billing/webhook/omise
    -> ตรวจสอบสถานะจริงด้วยการเรียก Omise API ซ้ำ (ไม่เชื่อ payload ของ webhook เพราะ Omise ไม่เซ็น signature)
    -> ถ้า charge.status === 'successful' -> shops.plan_key/subscription_provider='omise'/plan_expires_at=+1 เดือน + update billing_payments เป็น succeeded
  ข้อจำกัด: ไม่ auto-renew ร้านต้องกลับมาสแกนจ่ายใหม่ก่อนหมดอายุ (Phase 3 TODO: อีเมลแจ้งเตือนก่อนหมดอายุ)

Chat Playground (ทดสอบก่อนใช้งานจริง):
  /dashboard (Chat Playground Modal) แสดงโควต้าที่ใช้ไปเดือนนี้แบบ real-time (getPlaygroundQuotaStatus)
  ปุ่ม "🚫 จำลองโควต้าหมด" แสดงข้อความเดียวกับที่ลูกค้าจริงจะเห็นเมื่อโควต้าหมด โดยไม่หักโควต้าจริงของร้าน

---

## SaaS Plans

| Plan | ราคา/เดือน | ข้อความ | Token |
|---|---|---|---|
| ทดลองใช้งาน (14 วัน, ฟีเจอร์ Pro) | ฟรี | 300 | - |
| Free (หลังหมดช่วงทดลอง, ไม่มีขายอัตโนมัติ) | ฟรี | 100 | 1M |
| เริ่มต้น | 390 บาท | 3,000 | 5M |
| มืออาชีพ (แนะนำ) | 990 บาท | 10,000 | 15M |
| ธุรกิจองค์กร | 2,490 บาท | 30,000 | 50M |
| BYOK (API Key ตัวเอง) | 590 บาท | ไม่จำกัด | ไม่จำกัด |

---

## Completed Features [Bot Sales Hardening — 17 ตุลาคม 2026]

ตรวจทานบอทขายอัตโนมัติ (ตอบคำถาม / ออเดอร์ / ใบเสนอราคา / ตรวจสลิป) และการสมัครใช้งาน แล้วแก้ตามลำดับความเสี่ยง — merge และทดสอบบน production แล้วทั้งหมด

| PR | เรื่อง |
|---|---|
| #1 | API ส่องคู่แข่ง & AI Live ใช้ร้านจาก session (`requireShop`), ตัดเบอร์พร้อมเพย์ placeholder `0812345678` ใน CF ไลฟ์, RLS ของ competitors/live_* จำกัดตามร้าน |
| #2 | ตรวจสลิปเข้มงวด (เจ้าของออเดอร์ / ยอด / บัญชีผู้รับ / สลิปซ้ำ / ไม่อนุมัติเมื่อไม่มีคีย์), บังคับตรวจลายเซ็น LINE |
| #3 | ราคา ค่าส่ง สต๊อก ยอด QR คำนวณจากฐานข้อมูล; ซ่อนเครื่องมือที่ไม่มีโค้ด (เดิมตอบ "ดำเนินการเรียบร้อย" ทั้งที่ไม่ได้ทำ) |
| #4 | `accept_quotation` (ใบเสนอราคา -> ออเดอร์ -> QR), ส่วนลดมีเพดาน, คิวข้อความติดตามแทน `setTimeout`, ปลด `/api/cron` ออกจาก login proxy |
| #5 | ตัวเรียก cron ล้มเหลวชัดเจนเมื่อได้ HTTP ≠ 200 |
| #6 | ส่งเฉพาะคลังความรู้ที่เกี่ยวข้อง (~6,000 ตัวอักษร) ลด token ส่วนนี้ ~80%; ปิดช่องรั่วที่ใส่ใบเสนอราคาของลูกค้าคนอื่นลง prompt; นับ thinking tokens และอัปเดตราคา AI |
| #7 | เครื่องมือขายหลักมีทุกข้อความ (เดิม "ขอ QR" / "สั่งออเดอร์ 2 ชิ้น" ไม่มีเครื่องมือ); ChatGPT failover เป็น GPT-5.6 Luna |
| #8 | `shopHelper` หาร้านผ่าน `users.workspace_id` อย่างเดียว, onboarding สร้างร้านด้วย service client |
| #9 | onboarding บันทึก `business_type` (เดิม hidden input ถูก disabled), ป้ายแพ็กเกจแสดงตามจริง (TRIAL/FREE/…) แทน "PRO PLAN" ตายตัว |

การตั้งค่านอกโค้ดที่ทำแล้ว: `CRON_SECRET` (Vercel + GitHub), `APP_URL` (GitHub), `GEMINI_MODEL=gemini-3.8-flash`, Channel Secret ครบทุกร้านที่เชื่อม LINE, migration `20261017000000_scope_competitor_live_rls.sql` รันแล้ว

สิ่งที่ยังเหลือ -> [docs/plans/2026-10-17-bot-sales-and-onboarding-next-steps.md](./docs/plans/2026-10-17-bot-sales-and-onboarding-next-steps.md)

## Completed Features [Cost Infrastructure: Prompt Caching + Margin Dashboard]

เกิดจากการวิเคราะห์ต้นทุน AI เทียบกับราคาแพ็กเกจ (พบว่า Starter/Pro/Agency อาจขาดทุนถ้าลูกค้าใช้เต็มโควต้า):

- [x] Provider-aware usage tracking: ตาราง `ai_provider_usage` (แยกจาก `usage_logs` ที่ใช้ gate โควต้า) เก็บ token แยกตาม provider พร้อม cache_read/cache_write tokens สำหรับ Claude โดยเฉพาะ
- [x] Claude Prompt Caching: แยก system prompt เป็น static block (identity/knowledge/products/payment — เปลี่ยนไม่บ่อย) กับ dynamic block (customer profile/history) ส่ง `cache_control: {type: "ephemeral"}` ที่ static block เท่านั้น (ขั้นต่ำ 1,024 token ถึงจะแคชได้)
- [x] Gemini 3.6 Flash ใช้ implicit caching อัตโนมัติอยู่แล้ว (ไม่ต้องแก้โค้ด) — โครงสร้าง prompt เดิมที่วางของ dynamic ไว้ท้ายสุดเอื้อต่อ caching อยู่แล้ว
- [x] `src/lib/billing/aiPricing.ts`: ราคาจริงต่อ 1M token ต่อ provider (ตรวจสอบผ่าน web search เพราะเป็นโมเดลหลัง knowledge cutoff) + สูตรคำนวณต้นทุน Claude แบบแยก cache read/write
- [x] `/admin/margin` (Margin Dashboard ใหม่): สรุปรายได้เทียบต้นทุน AI ประมาณการ ทั้งแบบรวมต่อแพ็กเกจและรายร้านค้า (เรียงจากขาดทุนมากสุด) — **หมายเหตุ: ไม่มีข้อมูลย้อนหลังก่อนวันที่ฟีเจอร์นี้ขึ้น และเป็นตัวเลขประมาณการ ไม่ใช่ invoice จริง**
- [x] GPT-5.6 Luna ถูกใช้จริงแล้วในฐานะ failover ลำดับแรก (PR #7, 17 ต.ค. 2026) — ลบ `targetProvider` ที่ไม่ถูกใช้ออกแล้ว (แผนข้อ 1.9)

## AI Agent Architecture Upgrade — Master Plan

`ROADMAP_AI_AGENT.md` ได้รับการปรับปรุงใหญ่ (28 กรกฎาคม 2026): เพิ่มบทเรียนจากการตรวจสอบ 3 โปรเจคเดิมของผู้ใช้ (`aisalesassistant-main`, `botify-v5-hybrid`, `chatbot-agent-V6` — ความพยายามสร้างสินค้าเดียวกันครั้งก่อนหน้าที่ถูกทิ้งไป) และวางแผนละเอียดครบทั้ง 5 หัวข้อ (Model Router, Planning Layer, Customer Memory Graph, Sales Workflow Engine, Evaluation Framework) พร้อม "กฎเหล็ก 5 ข้อ" ป้องกันไม่ให้เดินซ้ำรอยปัญหาเดิม (แยก service เกินจำเป็น, ลืม multi-tenancy, logic ซ้ำต่อช่องทาง, script patch แบบ regex, schema drift) — เอกสารนี้เขียนให้ AI เซสชันไหน/ค่ายไหนก็หยิบไปทำต่อได้โดยไม่ต้องมีบริบทเดิม

## Completed Features [AI Agent Upgrade — 3/5: Planning Layer]

✅ **เสร็จแล้ว (28 กรกฎาคม 2026), เหลือ verification จริงก่อนขึ้น production** — รายละเอียดเต็มดูที่ [ROADMAP_AI_AGENT.md](./ROADMAP_AI_AGENT.md) หัวข้อ 6

- [x] `src/lib/ai/toolDispatcher.ts` (ใหม่): แยก 17 กิ่ง tool-dispatch ออกจาก webhook route มาเป็นโมดูล channel-agnostic (`executeTool()`, `ToolExecutor` type ที่ swap ได้)
- [x] `PlanningTurn` discriminated union + bounded loop สูงสุด 3 step ต่อข้อความลูกค้า 1 ครั้ง (เรียก AI ต่อเนื่องได้หลาย tool ก่อนตอบจริง แทนที่จะ dispatch ได้แค่ 1 tool ต่อข้อความ)
- [x] ทั้ง 3 provider (Gemini/Claude/OpenAI) รองรับ multi-turn tool result ตาม wire format ของตัวเอง — **แก้บั๊กจริงที่เจอจาก live test (28 กรกฎาคม 2026):** Gemini reject `role: 'function'` (`400 INVALID_ARGUMENT`), แก้เป็น `role: 'user'` แทน (ดู [ROADMAP_AI_AGENT.md](./ROADMAP_AI_AGENT.md) หัวข้อ 6 สำหรับ error message เต็ม)
- [x] Chat Playground แก้เป็น `previewToolExecutor` (pluggable) — read-only lookup รันจริง, tool ที่มี side effect จริงยังคง preview-only ไม่ execute จริงเหมือนเดิม
- [x] Usage accounting รวม token จากทุก step ก่อน increment ครั้งเดียว; hit step limit แล้ว flip `conversations.status='human'` จริง
- [x] **Async ack/push**: `processSalesAgentChat` แยกเป็น `preparePlanningState`/`runPlanningStep`/`finalizeAgentResult` ภายใน (พฤติกรรมเดิมไม่เปลี่ยน, Chat Playground ยังเรียกใช้ตัวนี้เหมือนเดิม) บวกฟังก์ชันใหม่ `startSalesAgentPlanning()`/`continueSalesAgentPlanning()` ให้ webhook รันแค่ step แรกก่อน แล้วถ้าต้องเรียก tool ต่อ ส่ง ack ผ่าน `sendLineReply` ทันที จากนั้นรัน step ที่เหลือแบบ fire-and-forget เบื้องหลัง (`.then().catch()` ไม่ await) แล้ว push คำตอบจริงด้วย `sendLinePush` — ใช้ pattern เดียวกับ `verifySlipAndNotify` ที่มีอยู่แล้ว ไม่ได้คิดกลไกใหม่ ทั้ง sync/async path ใช้ helper กลาง `deliverAgentResult()` ตัวเดียว
- [x] `npx tsc --noEmit` + `npm run build` ผ่านสะอาดทั้ง 2 รอบ (หลัง multi-step loop และหลัง async ack/push)
- [ ] **ยังไม่ได้ verify ครบ**: ทดสอบ Chat Playground จริงแล้วบางส่วน (เจอ+แก้บั๊ก Gemini role ด้านบน) แต่ยังไม่เจอเคส 2-tool chaining ที่มีความหมายจริง และ**ยังไม่ได้ทดสอบผ่าน LINE จริงเลย** (ack message + push) — ควรทดสอบก่อนไว้ใจใน production เต็มที่

## Completed Features [AI Agent Upgrade — 2/5: Model Router]

- [x] แก้ dead code: GPT-5.6 Luna เป็น fallback จริงเมื่อ Claude ไม่มี key (เดิมไม่เคยถูกเรียกใช้เลย)
- [x] ขยาย negotiation keyword list (+7 คำ/วลี)
- [x] เปลี่ยนจาก binary complexity เป็น score-based (`computeComplexityScore()` — pure function, testable แยกจาก DB)
- [x] ผูก VIP status จาก Customer Memory Graph เข้ากับ routing (`isVipProfile()`, `VIP_SPEND_THRESHOLD_THB = 5000`)
- [x] Log routing decision ละเอียดขึ้น (score + VIP status ใน console log)
- รายละเอียดเต็มดูที่ [ROADMAP_AI_AGENT.md](./ROADMAP_AI_AGENT.md) หัวข้อ 4

## Completed Features [AI Agent Upgrade — 1/5: Customer Memory Graph]

แผนรวม 5 หัวข้อดูที่ [ROADMAP_AI_AGENT.md](./ROADMAP_AI_AGENT.md) — หัวข้อที่ 1 เสร็จแล้ว:

- [x] ตาราง `customer_profiles` (unique: shop_id+user_id) — tags/notes แบบ append-only แทน text field ที่ overwrite ทุกครั้งใน `conversations`
- [x] RPC functions: `upsert_customer_profile`, `append_customer_note`, `add_customer_tag_unique`, `update_customer_preference`, `record_customer_order` (atomic, SECURITY DEFINER เหมือน `increment_usage` จาก Phase 2)
- [x] Auto-inject context เข้า system prompt ทุกข้อความ ไม่ต้องเรียก tool (`getCustomerProfileContext` ใน `src/lib/customerMemory.ts`)
- [x] Webhook: upsert profile ทุกข้อความที่เข้ามา, `update_customer_note`/`add_customer_tag` เขียนคู่ขนานทั้งของเดิมและโปรไฟล์ใหม่, `take_order` อัปเดตยอดซื้อสะสมอัตโนมัติ
- [x] Chat Playground: `update_customer_note`/`add_customer_tag` รันจริง (ไม่ใช่แค่ preview) เพื่อพิสูจน์ความจำข้าม session ระหว่างทดสอบ

## Completed Features [Bug Fixes - 28 กรกฎาคม 2026 หลัง Phase 2]

พบและแก้ระหว่างทดสอบ Chat Playground หลัง Phase 2 (ไม่เกี่ยวกับ billing โดยตรง แต่กระทบการทำงานจริงของบอท):

- [x] Gemini function-calling schema ผิด 2 จุด ทำให้ Gemini ปฏิเสธ tools ทั้งหมด (400 INVALID_ARGUMENT) — บอทตอบข้อความทักทายซ้ำๆ แทนที่จะตอบจริง:
  1. tools ที่ไม่มี argument (get_shop_info, get_active_promotions ฯลฯ) ส่ง `properties: {}` ว่างเปล่า ซึ่ง Gemini ไม่ยอมรับ
  2. โค้ดแปลง `type` เป็นตัวพิมพ์ใหญ่ (`OBJECT`/`STRING`) ซึ่ง Gemini เวอร์ชันปัจจุบันไม่ยอมรับเช่นกัน (ต้องเป็น lowercase เหมือน Claude/OpenAI)
- [x] คำถามสินค้าทั่วไป (ไม่มีคำต่อรองราคา) ไม่เคยได้รับเครื่องมือ search_products/check_stock/get_active_promotions เลย เพราะ intent routing ให้เฉพาะคำถามที่มีคีย์เวิร์ดต่อรองราคาเท่านั้น
- [x] search_products บน webhook จริงอ่าน `args.query` แต่ schema ของ tool ประกาศพารามิเตอร์ชื่อ `keyword` — คำค้นหาของลูกค้าถูกเพิกเฉยเงียบๆ มาโดยตลอด
- [x] Chat Playground ไม่เคยมี "ความจำ" ระหว่างข้อความ เพราะไม่ได้บันทึกลง chat_messages เหมือน LINE webhook จริง — แก้โดยส่งประวัติแชทจาก client ตรงเข้า AI engine แทน
- [x] **พบ schema drift สำคัญ:** ฐานข้อมูล Supabase จริงไม่ตรงกับ `supabase/migrations/20260701000000_initial_schema.sql` ในเรโป — ดูหัวข้อ "Known Issues" ด้านล่าง

## Completed Features [Phase 2 DONE]

- [x] PHASE 2: Stripe Subscription (Checkout Session, Billing Portal, webhook lifecycle)
- [x] PHASE 2: Omise/Opn Payments PromptPay one-time charge + webhook (re-verified via API, ไม่เชื่อ signature)
- [x] PHASE 2: usage_logs + billing_payments tables + increment_usage() atomic RPC
- [x] PHASE 2: Quota Gate ใน salesAgentEngine.ts (block AI ก่อนเรียก Provider เมื่อหมดโควต้า ประหยัดค่าใช้จ่าย)
- [x] PHASE 2: Token usage capture จริงจาก Gemini/Claude/OpenAI responses
- [x] PHASE 2: Billing Dashboard /dashboard/billing (แผนปัจจุบัน, usage bar, ปุ่ม upgrade 2 ช่องทาง, ประวัติชำระเงิน)
- [x] PHASE 2: Admin Plans เพิ่ม stripe_price_id
- [x] PHASE 2: Chat Playground แสดงโควต้าจริง + ปุ่มจำลองข้อความเมื่อโควต้าหมด (ทดสอบก่อนใช้งานจริง)
- [x] PHASE 2 (bug fix): Proxy/Middleware auth ไม่บล็อก webhook อีกต่อไป (LINE + Stripe + Omise เข้าถึง handler ได้จริง)
- [x] PHASE 2: ย้าย middleware.ts -> proxy.ts ตาม Next.js 16 convention ใหม่

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

## Completed Features [Products Dashboard]

(เดิมบันทึกไว้เฉพาะใน DEVELOPMENT_STATUS.md ที่ถูกรวมเข้ามาในไฟล์นี้แล้ว — ตรวจสอบโค้ดจริงยืนยันว่ามีจริงทุกข้อ)

- [x] Custom Categories: สร้างหมวดหมู่สินค้าใหม่ได้เองแบบไดนามิก
- [x] Local Image Upload พร้อม Live Preview Thumbnail (FileReader)
- [x] AI Copywriter (`generateAiProductDescription`): ให้ AI ช่วยแต่งคำอธิบายสินค้า สงวนสิทธิ์เฉพาะแพ็กเกจ Pro/Agency/BYOK
- [x] Bulk CSV Import & Template Download: ดาวน์โหลดไฟล์ตัวอย่าง CSV และนำเข้าสินค้าจำนวนมากได้

---

## Known Issues — Database Schema Drift

**สำคัญ:** ฐานข้อมูล Supabase จริง (production) มีโครงสร้างต่างจากไฟล์ `supabase/migrations/20260701000000_initial_schema.sql` ในเรโปนี้อย่างมีนัยสำคัญ — พบระหว่างดีบัก Chat Playground เมื่อ 28 กรกฎาคม 2026 ด้วยการ query `information_schema.columns` ตรงจริง (ดู `supabase/tools/check_schema.sql`):

| จุดที่ต่างจากไฟล์ในเรโป | ผลกระทบ |
|---|---|
| `shops` ไม่มีคอลัมน์ `user_id` และ `owner_id` | **แก้แล้ว 17 ต.ค. 2026 (PR #8):** `shopHelper.ts` หาร้านผ่าน `users.workspace_id` อย่างเดียว ไม่ fallback ไปร้านแรกในตารางอีก (เดิมอาจส่งร้านของคนอื่นให้บัญชีที่ยังไม่ผูกร้าน); บัญชีที่ไม่มีร้านถูกพาไป `/onboarding` ซึ่งสร้างร้านด้วย service client |
| `products` ไม่มีคอลัมน์ `status` เลย | ทุก query ที่ทำ `.eq('status','active')` บน products error เงียบๆ — แก้ไปแล้วในโค้ด (ลบ filter ออก) แต่ไฟล์ schema เดิมยังเข้าใจผิดว่ามีคอลัมน์นี้ |
| `products.stock` เป็น `TEXT` ไม่ใช่ตัวเลข (ดีฟอลต์ `'มี'`) | Dashboard เขียนเป็นเลขที่แปลงเป็น string (`"30"`, `"0"`) ผ่าน `parseInt`, โค้ด AI/webhook เทียบเป็นตัวเลขได้พอดีเพราะ JS coerce string อัตโนมัติ แต่ฝั่ง Postgres/PostgREST (`.gt('stock', 0)`) เป็นการเทียบ string แบบ lexicographic ซึ่งบังเอิญถูกต้องกับข้อมูลปัจจุบัน แต่เปราะบางในกรณี edge case |

**ข้อควรระวัง:** ห้ามเขียน SQL migration ใหม่โดยอ้างอิงจาก `supabase/migrations/20260701000000_initial_schema.sql` เพียงอย่างเดียวโดยไม่ตรวจสอบ schema จริงก่อน — ให้รัน `supabase/tools/check_schema.sql` ใน Supabase SQL Editor เพื่อดูโครงสร้างจริงทุกครั้งก่อนเขียนไฟล์ migration ใหม่

---

## TODO - Phase 2 (Billing) - เหลือก่อนใช้งานจริง

| Priority | Task | Notes |
|---|---|---|
| HIGH | รัน supabase/migrations/20260728020000_phase2_billing.sql บน Supabase จริง | ยังไม่ได้ apply บน production DB |
| HIGH | ใส่ STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / OMISE_SECRET_KEY | ดู .env.example |
| HIGH | ตั้งค่า Stripe Price ID ในหน้า /admin/plans ทุกแผนที่มีค่าใช้จ่าย | จำเป็นก่อนลูกค้าจ่ายผ่าน Stripe ได้ |
| MEDIUM | ทดสอบ end-to-end ด้วย Stripe CLI (`stripe listen` + `stripe trigger`) และ Omise sandbox | ดูแผนทดสอบใน plan ที่บันทึกไว้ |

## TODO - Phase 3 (Growth) - 2-3 สัปดาห์ถัดไป

| Priority | Feature |
|---|---|
| HIGH | Landing Page (/) - marketing site |
| HIGH | Email Notifications (Resend.com) |
| HIGH | อีเมลแจ้งเตือนก่อน Omise plan_expires_at หมดอายุ (ไม่มี auto-renew) |
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
SUPABASE_SERVICE_ROLE_KEY=         # upload Supabase Storage + billing webhooks (bypass RLS)
GEMINI_API_KEY=                    # Primary AI
CLAUDE_API_KEY=                    # High-Persuasion (ต่อรองราคา)
OPENAI_API_KEY=                    # Fallback
EASYSLIP_API_KEY=                  # Slip Verification [Phase 1] — ไม่มีคีย์ = สลิปทุกใบส่งให้แอดมินตรวจ
GEMINI_MODEL=gemini-3.8-flash      # ใช้กับร้านที่ไม่ได้ตั้ง ai_model (ห้ามใช้ gemini-2.0-flash — ถูกปิดแล้ว)
OPENAI_MODEL=                      # optional — ว่าง = gpt-5.6-luna แล้ว gpt-4o-mini (failover)
CRON_SECRET=                       # [17 ต.ค. 2026] ต้องตรงกับ GitHub repo secret CRON_SECRET (ตัวเรียก follow-up)
STRIPE_SECRET_KEY=                 # [Phase 2] Stripe subscription billing
STRIPE_WEBHOOK_SECRET=             # [Phase 2] Stripe webhook signature verification
OMISE_SECRET_KEY=                  # [Phase 2] Omise/Opn Payments PromptPay charges
NEXT_PUBLIC_APP_URL=               # [Phase 2] Stripe Checkout success/cancel + Portal return URL

(ดูตัวอย่างเต็มใน .env.example)

---

## Git History

a4f1fc1  fix(ai-agent): Gemini rejects role 'function' for tool results in multi-turn calls
cc63428  docs: record decision against splitting AI logic to a separate Railway service
65de465  feat(ai-agent): add async ack/push for multi-step Planning Layer replies
95fdf51  feat(ai-agent): add Planning Layer multi-step tool loop (3/5 of AI agent upgrade)
9ec54ea  chore: organize scattered SQL files into supabase/migrations + tools
75c8d91  feat(ai-agent): upgrade Model Router (2/5 of AI agent upgrade)
c99e20b  feat(billing): implement Claude prompt caching + admin Margin Dashboard
e698121  feat(ai-agent): implement Customer Memory Graph (1/5 of AI agent upgrade)
64f1020  fix(playground): give Chat Playground real conversation memory
35591c1  fix(products): remove filters on a status column that doesn't exist in production
cb4ed28  fix(ai): grant product tools to general queries + fix search_products arg mismatch
44973b9  fix(ai): stop uppercasing Gemini function-call parameter types
bd640ae  fix(ai): omit Gemini function-call parameters for no-arg tools
e33bf93  docs: update PROJECT_STATUS.md - Phase 2 complete
0f88be0  feat(phase-2): implement Phase 2 Billing & Monetization
632a7b7  docs: update PROJECT_STATUS.md - Phase 1 complete
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
Phase 2: Billing System    [DONE - รอ live API keys + apply SQL] 28 กรกฎาคม 2026
Phase 3: Growth & UX       [NEXT] สัปดาห์ที่ 5-7
Phase 4: Scale & Polish           สัปดาห์ที่ 8-10
Phase 5: Expansion                หลัง launch
Beta Launch Target: ~2 เดือน
### Store Manager Agent Update (2026-07-29)

- Added `STORE_MANAGER_AGENT.md` as the operating blueprint for a cross-business AI store manager.
- Added production prompt rules so AI behaves as a store manager, not only a booking/sales bot.
- Tightened booking tools to respect service slot intervals from the database, including 120-minute table-booking rounds.
- Booking confirmations now include more complete customer-facing details for auditability.

---

### Omnichannel, Central Inventory & Official Branding Milestones (2026-10-12 - 2026-10-13)

1. **Omnichannel Unified Inbox & Social Commerce (Step 1 - Step 3) [DONE]**
   - **Unified Inbox (`/dashboard/inbox`):**
     - รวมแชททุกช่องทาง (LINE OA, Facebook Messenger, Shopee, TikTok Shop) ในหน้าจอเดียว
     - ระบบ Agent Takeover (`is_ai_paused`): แอดมินสามารถกดแทรกแซงและส่งข้อความตรงเข้า LINE OA / Facebook ได้
     - AI Copilot Draft Assistant: ปุ่มร่างคำตอบ AI ในช่องแชท ช่วยแอดมินตอบอย่างมืออาชีพ
     - Auto-Refresh Polling ข้อความแบบเรียลไทม์
   - **Facebook Messenger Integration:**
     - Webhook endpoint `/api/webhook/facebook/[shop_id]` รองรับ Meta Verify Token และ event `messages`
     - Test route `/api/test/facebook-webhook` สำหรับจำลองการส่งข้อความ
   - **Channels Settings Tab (`/dashboard/settings`):**
     - แท็บเฉพาะสำหรับเชื่อมต่อและจัดการสถานะ LINE, Facebook, Shopee, และ TikTok Shop
   - **Multi-channel Broadcast (`/dashboard/broadcast`):**
     - ระบบส่งข้อความบรอดแคสต์เลือกกลุ่มเป้าหมายตามช่องทาง

2. **Central Multi-Store Inventory & Marketplace Sync (BigSeller Architecture - Step 4) [DONE]**
   - **Master SKU Pooling:** รองรับการซิงค์สต็อกรวมระหว่างหลายหน้าร้านค้าและช่องทาง ป้องกันสินค้าขายเกิน (Overselling)
   - **Marketplace Sync Engine (`/dashboard/products`):**
     - ปุ่มและ Modal "ซิงค์สินค้า Marketplace" รองรับ Shopee & TikTok Shop พร้อม Progress bar และ Log บันทึก
     - ตาราง `marketplace_stock_logs` บันทึกประวัติการเปลี่ยนแปลงสต็อกทุกช่องทาง
   - **Dynamic Categories:** ปรับฟิลเตอร์หมวดหมู่สินค้าให้ดึงเฉพาะหมวดหมู่ที่มีสินค้าจริงในร้านค้า

3. **B2B Quotation Lifecycle & Multi-Format Luxury Export [DONE]**
   - Customer Approval Flow: ระบบลงลายมือชื่อดิจิทัล (Digital Signature) ที่ `/doc/quotation/[id]` พร้อมแจ้งเตือน LINE OA เมื่อลูกค้าอนุมัติ
   - 1-Click Document Conversion: แปลงใบเสนอราคาเป็น Invoice หรือ Sales Order ได้ทันที
   - เอกสารส่งออกระดับมืออาชีพ: PDF, Word (.docx), และ Excel (.xlsx) จัดหน้าหรูหรา รองรับภาษาไทยและ BahtText

4. **Official DealMee Branding & Logo Refresh [DONE]**
   - อัปเดตโลโก้ทางการตัวใหม่ (`/logos/concept-d1.jpg`) สไตล์ D-Chat & Verified Star
   - คุมโทนสีแบรนด์ชัดเจน: `Deal` (Electric Blue) + `Mee` (Cyber Cyan)
   - ปรับใช้ครบทุกหน้า: Super Admin (`/admin`), Merchant Dashboard (`/dashboard`), Website Landing Page (Navbar & Footer), หน้า Login & Register, Onboarding Wizard, Terms & Privacy, และ Browser Favicon

> **หมายเหตุการติดตั้ง:** กรุณารันไฟล์ SQL migrations ทั้ง 4 ไฟล์ในโฟลเดอร์ `supabase/migrations/` (ระบุรายละเอียดใน `TODO.md`) บน Supabase Dashboard SQL Editor เพื่อเปิดใช้งานฟีเจอร์ฐานข้อมูลทั้งหมด

