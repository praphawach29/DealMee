# Botify SaaS - Project Status

> **อัปเดตล่าสุด:** 28 กรกฎาคม 2026 เวลา 00:09 น.
> **GitHub:** praphawach29/ai-agent-google-SDK branch main
> **Last Commit:** c262374 - feat: expand AI tool system to 36 tools

---

## ภาพรวมโปรเจค

Botify SaaS คือแพลตฟอร์ม AI Sales Agent สำหรับร้านค้าออนไลน์ที่ใช้ LINE OA

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
| Deployment | Vercel |

---

## Project Structure

src/app/api/webhook/[shop_id]/ - LINE Webhook + 36-Tool Dispatcher
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
src/app/admin/                - Super Admin Panel
src/lib/ai/salesAgentEngine.ts - AI Brain (36 Tools, 3 Providers)
supabase_schema_update.sql    - Full DB Schema + RLS

---

## Database Schema

| Table | Description |
|---|---|
| users | ผู้ใช้งาน linked to auth.users |
| shops | ข้อมูลร้านค้า (bot_name, line_token, promptpay_id, features) |
| conversations | บทสนทนา LINE ต่อลูกค้า (status: ai/human) |
| chat_messages | ข้อความในแต่ละบทสนทนา |
| products | สินค้า (name, price, stock, image_url) |
| orders | ออเดอร์ (payment_status, slip_url) |
| bookings | การจองคิว (booking_date, booking_time, status) |
| services | บริการของร้าน |
| knowledge_base | FAQ / นโยบายร้าน |
| plans | SaaS Pricing Plans |
| leads | ลูกค้าที่สนใจแต่ยังไม่ซื้อ |

Supabase Storage Bucket: qr-codes (เก็บรูป QR PromptPay)

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

### 36 AI Tools

**Payment (6):** send_payment_qr, get_payment_slip_status, send_invoice, calculate_installment, apply_custom_discount, create_quotation
**Order (4):** take_order, check_order_status, track_parcel, calculate_shipping
**Product (7):** search_products, check_stock, get_product_image, get_upsell_products, get_crosssell_products, recommend_product_match, upsell_suggestion
**Booking (5):** check_available_slots, book_appointment, reschedule_booking, check_booking, cancel_booking
**Customer (5):** save_lead, update_customer_note, add_customer_tag, get_customer_history, check_loyalty_points
**Knowledge (1):** search_knowledge_base
**Promotions (1):** get_active_promotions
**Escalation (2):** request_human_agent, transfer_to_agent
**Follow-up (1):** schedule_followup
**NEW (4):** get_shop_info, check_warranty, request_review, get_return_policy

### Provider Tool Format
Gemini  -> functionDeclarations (types UPPERCASE)
Claude  -> tools[].input_schema
OpenAI  -> tools[].function (type: "function")

### Webhook Tool Dispatcher Actions
| Tool | Supabase Side Effect |
|---|---|
| send_payment_qr | Generate QR -> Upload Storage -> LINE Push Image |
| take_order | INSERT orders + LINE Push confirm |
| request_human_agent | UPDATE conversations.status='human' + LINE Push |
| transfer_to_agent | UPDATE conversations.last_message + LINE Push |
| save_lead | UPSERT leads |
| update_customer_note | UPDATE conversations.customer_note |
| add_customer_tag | UPDATE conversations.customer_tag |
| schedule_followup | setTimeout -> LINE Push (max 60 min) |

---

## SaaS Plans

| Plan | ราคา/เดือน | ข้อความ |
|---|---|---|
| ทดลองใช้งาน | ฟรี | 500 |
| เริ่มต้น | 390 บาท | 3,000 |
| มืออาชีพ (แนะนำ) | 990 บาท | 10,000 |
| ธุรกิจองค์กร | 2,490 บาท | 30,000 |
| BYOK (ใช้ API Key ตัวเอง) | 590 บาท | ไม่จำกัด |

---

## Completed Features

- [x] Next.js 16 App Router + TypeScript
- [x] Supabase Auth + RLS ทุก Table
- [x] Onboarding Wizard
- [x] Dashboard UI ครบ (Inbox, Orders, Products, Bookings, Knowledge, Settings)
- [x] LINE Webhook รับ-ส่งข้อความ
- [x] AI Sales Agent Engine (Gemini + Claude + OpenAI Fallback)
- [x] Botify Brain Router - ส่ง Tool Set ตาม intent
- [x] 36 AI Tools (Function Calling ทั้ง 3 Provider)
- [x] PromptPay QR Code - Generate + Supabase Storage + LINE Push Image
- [x] Webhook Tool Dispatcher - Side Effects ครบ
- [x] Admin Takeover (human mode)
- [x] Chat Playground
- [x] SaaS Plans 5 แผน

---

## TODO - สิ่งที่ยังต้องทำ

| Priority | Feature |
|---|---|
| HIGH | Slip Auto-Verification (SlipOK/EasySlip API) |
| HIGH | Tool: search_products -> Query Supabase จริง |
| HIGH | Tool: check_stock -> Query Supabase จริง |
| MEDIUM | Tool: check_order_status -> Query Supabase จริง |
| MEDIUM | Tool: book_appointment -> INSERT bookings จริง |
| MEDIUM | Tool: check_available_slots -> Query bookings จริง |
| MEDIUM | Knowledge Base Vector Search (pgvector) |
| LOW | LINE LIFF Widget |
| LOW | Analytics Dashboard |
| LOW | Omise/Stripe Payment Gateway |
| LOW | Multi-platform (Facebook, WhatsApp) |

---

## Environment Variables (Vercel)

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
CLAUDE_API_KEY=
OPENAI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash (optional)
OPENAI_MODEL=gpt-4o-mini (optional)

---

## Git History

c262374  feat: expand AI tool system to 36 tools (Gemini, Claude, OpenAI)
10e7b74  feat: implement AI Function Calling (Tool Use) for QR payment
5fcf10a  fix: install @types/qrcode
01a6e6a  feat: add PromptPay QR code generation and slip verification flow
ae0534f  fix: update payment and shipping settings to match schema
