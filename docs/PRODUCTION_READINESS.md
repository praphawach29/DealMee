# Botify SaaS Web - Production Readiness & Deployment Checklist

> เอกสารเตรียมความพร้อมสำหรับการขึ้นระบบใช้งานจริง (Production Launch) บน Vercel และ Supabase

---

## 1. Environment Variables Checklist

ตั้งค่า Environment Variables ด้านล่างใน Vercel Project Settings (Production Environment):

### Core App & Database (Supabase)
| Variable | Description | Example / Format |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL ของ Supabase Production Project | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Anon Key ของ Supabase | `eyJhbG...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret Service Role Key (Admin Access) | `eyJhbG...` |
| `NEXT_PUBLIC_APP_URL` | Public Domain ของแอปพลิเคชัน | `https://botify.yourdomain.com` |

### AI Providers
| Variable | Description | Requirement |
|---|---|---|
| `GEMINI_API_KEY` | API Key ของ Google AI Studio (Primary AI) | Required (Flash 3.6 Model) |
| `ANTHROPIC_API_KEY` | API Key ของ Anthropic (Claude High-Persuasion) | Required |
| `OPENAI_API_KEY` | API Key ของ OpenAI (Fallback Engine) | Optional |

### Payment Gateways (Live Mode Keys)
| Variable | Description | Requirement |
|---|---|---|
| `STRIPE_SECRET_KEY` | Secret Key ของ Stripe (`sk_live_...`) | Required for Subscriptions |
| `STRIPE_WEBHOOK_SECRET` | Signing Secret สำหรับ Stripe Webhook (`whsec_...`) | Required |
| `STRIPE_PRICE_PRO_MONTHLY` | Price ID ของ Pro Plan ใน Stripe Dashboard | Required |
| `STRIPE_PRICE_AGENCY_MONTHLY` | Price ID ของ Agency Plan ใน Stripe Dashboard | Required |
| `OMISE_PUBLIC_KEY` | Public Key ของ Omise/Opn (`pkey_live_...`) | Required for PromptPay Charge |
| `OMISE_SECRET_KEY` | Secret Key ของ Omise/Opn (`skey_live_...`) | Required |
| `EASYSLIP_API_KEY` | API Key จาก developer.easyslip.com | Required for Slip Verification |

### LINE Integration
| Variable | Description | Requirement |
|---|---|---|
| `LINE_CHANNEL_SECRET` | Channel Secret ของ LINE Messaging API | Required |
| `LINE_CHANNEL_ACCESS_TOKEN` | Channel Access Token (Long-lived) | Required |

---

## 2. Pre-Launch Verification Steps

ก่อนเปิดให้บริการแก่ลูกค้ารายแรก ให้ทำการตรวจสอบตามขั้นตอนดังนี้:

- [ ] **1. Run Database Migrations**:
  รันไฟล์ SQL Migrations ทั้งหมดใน `supabase/migrations/` บน Supabase Production Project
- [ ] **2. Setup Storage Bucket**:
  สร้าง Storage Bucket ชื่อ `qr-codes` (Public Access) ใน Supabase สำหรับเก็บรูป QR PromptPay
- [ ] **3. LINE Webhook Endpoint**:
  ตั้งค่า Webhook URL ใน LINE Developers Console เป็น `https://botify.yourdomain.com/api/webhook/[shop_id]`
- [ ] **4. Stripe Webhook Endpoint**:
  ตั้งค่า Webhook ใน Stripe Dashboard ชี้ไปที่ `https://botify.yourdomain.com/api/billing/webhook/stripe` (Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`)
- [ ] **5. Omise Webhook Verification**:
  ตรวจสอบ API Key ของ Omise และยืนยันการ Re-check ผ่าน API ใน `getCharge()`
- [ ] **6. Build & Type Checking**:
  ยืนยันว่า `npx tsc --noEmit` และ `npm run build` ผ่านโดยไม่มีข้อผิดพลาด
