# 🛍️ DealMee AI — AI Sales Agent สำหรับร้านค้าไทยบน LINE OA และ Messenger

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.2.11-black?style=for-the-badge&logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=for-the-badge&logo=tailwindcss" alt="Tailwind CSS v4" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?style=for-the-badge&logo=supabase" alt="Supabase" />
  <img src="https://img.shields.io/badge/AI_Engine-Gemini_3_Flash_%2F_Claude_Sonnet-orange?style=for-the-badge" alt="AI Engine" />
  <img src="https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge" alt="License" />
</p>

---

## 📌 บทนำ (Overview)

**DealMee AI** (เดิมชื่อ Botify AI) คือแพลตฟอร์มบริหารการขายและอีคอมเมิร์ซอัจฉริยะแบบครบวงจร (**Autonomous AI Commerce Platform**) ที่ออกแบบมาเพื่อปฏิวัติวงการร้านค้าออนไลน์และธุรกิจไทย ขับเคลื่อนด้วยโมเดลภาษาขนาดใหญ่ระดับแนวหน้า (**Gemini 3 Flash, Claude Sonnet 4, และ OpenAI GPT**) ผสานพลังของ:
1. **พนักงานขาย AI อัจฉริยะ (Omnichannel AI Sales Copilot)** ประจำการบน LINE OA และ Facebook Messenger ตอบคำถาม เชียร์ขาย ปิดยอด และตรวจสลิป 24/7
2. **ระบบส่องร้านคู่แข่ง** ดึงโปรไฟล์และคลิปล่าสุดของคู่แข่งบน TikTok (Instagram ได้แค่โปรไฟล์) แล้วให้ AI แนะนำคอนเทนต์สำหรับสินค้าของร้าน
3. **AI Live Studio (ซ่อนอยู่ ยังไม่เปิดขาย)** จอ OBS สลับตะกร้า บทพูดไลฟ์ และเสียงอ่านภาษาไทย ยังไม่รับคอมเมนต์จากไลฟ์จริง เปิดเฉพาะร้านที่ตั้ง `features.live_studio = true`

> 📖 **ดูสถานะการพัฒนาฉบับละเอียด:** [PROJECT_STATUS.md](./PROJECT_STATUS.md)  
> 🗺️ **แผนงานพัฒนาในอนาคต:** [ROADMAP.md](./ROADMAP.md)

---

## ✨ ฟีเจอร์หลักของระบบ (Key Features)

### 1. 🎙️ AI Live Studio — ⚠️ ซ่อนอยู่ (PR #60, 20 ต.ค. 2569)
> สถานะจริง: ยังไม่ได้เชื่อม TikTok/Facebook/Shopee Live คอมเมนต์มาจากที่ร้านพิมพ์ในแดชบอร์ดเท่านั้น รายการด้านล่างคือของที่มีโค้ด ไม่ใช่สิ่งที่ลูกค้าใช้ได้ แผนเชื่อม TikTok LIVE (TikTool/Euler Stream) ดู TODO.md

* **OBS 60 FPS Browser Source Overlay:** วิดเจ็ตสำหรับวางในโปรแกรม OBS หรือ TikTok Live Studio แสดงภาพสินค้า ราคาโปรโมชั่น ป้ายไฟ Flash Sale และคอมเมนต์สดจากผู้ชมแบบ Real-time (Sync ผ่าน Supabase Realtime)
* **AI Live Host Teleprompter:** ระบบสร้างบทพูดสดสำหรับสตรีมเมอร์ใน 1 คลิก แบ่งเป็น **ท่อนเปิดใจ 15 วินาทีแรก (Hook)**, **จุดเด่นสินค้า**, และ **ท่อนปิดการขายเร่งด่วน (Urgency Closing)**
* **AI Voice Persona & Rhythm Tuner:** ระบบเสียงพากย์สดภาษาไทย ปรับสไตล์และสปีดการพูดได้อิสระ:
  * 🌸 **แม่ค้าเสียงหวาน (1.15x):** โทนเสียงสดใส ชวนคุย เป็นมิตร
  * ⚡ **แม่ค้าขายด่วน (พลังบวก 1.22x):** กระฉับกระเฉง ปลุกพลังช่วงนาทีทอง
  * 👔 **พ่อค้ามั่นใจ (1.12x):** สุภาพ น่าเชื่อถือ ชัดถ้อยชัดคำ
  * รองรับทั้ง **Web Neural (เสียงธรรมชาติ ฟรี ไม่มีดีเลย์)** และ **Cloud AI (OpenAI TTS / ElevenLabs)**
* **Auto Basket Switcher & CF Parser:** สลับจอสินค้าอัตโนมัติทันทีเมื่อผู้ชมพิมพ์ถาม (เช่น *"ขอดูตะกร้า 2"*) พร้อมตรวจจับข้อความสั่งซื้อ CF (เช่น *"CF 1 2 ชิ้น"*) แล้วออกออเดอร์ให้ทันที

---

### 2. 🔍 ส่องร้านคู่แข่ง (Competitor Intelligence)
* **ดึงข้อมูลจริงผ่าน RapidAPI:** TikTok ได้โปรไฟล์ ผู้ติดตาม และ 5 คลิปล่าสุดพร้อมยอดวิว/ไลก์/คอมเมนต์/แชร์; Instagram ได้แค่โปรไฟล์; Facebook/Shopee ยังไม่รองรับ (สแกนแล้วแจ้งว่าไม่รองรับ ไม่เสียโควตา)
* **บทวิเคราะห์และไอเดียคอนเทนต์จาก Gemini:** เขียนจากคลิปจริงของคู่แข่งกับสินค้าของร้าน ไม่แต่งราคาคู่แข่งหรือคำสัญญาแทนร้าน
* **สคริปต์คลิปสำหรับร้านเรา:** ถอดคลิปของคู่แข่งเป็นสคริปต์ 30 วินาทีสำหรับสินค้าของร้าน
* **ส่งเข้าคลังความรู้เป็นร่าง:** ร้านต้องอนุมัติก่อนบอทใช้
* ยังไม่มี: ราคาขายของคู่แข่ง และการแจ้งเตือนเมื่อคู่แข่งลดราคา

---

### 3. 🤖 Omnichannel AI Sales Copilot (แชทบอทปิดการขาย 24 ชั่วโมง)
* **Multi-Platform Integration:** รองรับทั้ง **LINE Official Account (Messaging API)** และ **Facebook Messenger (Meta Graph API Webhook)** เชื่อมต่อข้อมูลสต็อกและคำสั่งซื้อเข้าด้วยกัน
* **RAG Knowledge Base:** นำเข้าไฟล์เอกสาร แคตตาล็อกสินค้า นโยบายร้าน เพื่อให้ AI ตอบคำถามได้อย่างถูกต้องแม่นยำ ไม่ตอบมั่ว
* **Sales State Machine:** บอทมีจิตวิทยาการขาย รู้จังหวะแนะนำสินค้าเพิ่มเติม (Upsell), นำเสนอโปรโมชั่น, คำนวณค่าส่ง, และส่งรูปภาพสินค้าในแชท

---

### 4. 💳 Smart Billing & Automated Slip Verification
* **Instant Bank Slip Verification:** ตรวจสอบสลิปโอนเงินไทยแบบอัตโนมัติผ่าน **EasySlip / SlipOK API** ตรวจเช็กชื่อบัญชี ยอดเงิน วันเวลา และระบบป้องกันการใช้สลิปซ้ำ (Duplicate Prevention)
* **Dynamic PromptPay QR Code:** เจนเนอเรต QR Code พร้อมยอดเงินแบบอัตโนมัติผ่าน `promptpay-qr` ลูกค้าสแกนจ่ายได้สะดวกรวดเร็ว
* **Subscription Management:** ระบบจัดการแพ็กเกจรายเดือนสำหรับร้านค้าผ่าน **Stripe Billing** และการชำระเงินในประเทศ

---

### 5. ⏰ Proactive Follow-up Engine & B2B Documents
* **Automated Recovery Cron:** ระบบติดตามทวงยอดสลิปอัตโนมัติ (เช่น แจ้งเตือนหลังส่ง QR ไปแล้ว 15 นาที) และแจ้งเตือนรอบซื้อซ้ำ ทำงานอัตโนมัติผ่าน GitHub Actions
* **B2B Quotation Engine:** ออกใบเสนอราคา ใบเสร็จ ใบแจ้งหนี้ เป็นไฟล์ PDF, Word (.docx) และ Excel (.xlsx) พร้อมลายเซ็นอิเล็กทรอนิกส์

---

## 🛠️ Tech Stack & Architecture

| เลเยอร์ (Layer) | เทคโนโลยีที่เลือกใช้ (Technology) |
|---|---|
| **Frontend Framework** | **Next.js 16.2.11** (App Router, Server Actions, Turbopack) |
| **Language & Typing** | **TypeScript 5** (Strict Mode, 0 Errors) |
| **Styling & UI Components** | **Tailwind CSS v4**, Lucide React, Base UI, tw-animate-css |
| **Database & Auth** | **Supabase** (PostgreSQL 15, Row Level Security, Realtime, Supabase Auth) |
| **AI LLM Core** | **Gemini 3 Flash** (เร็วและคุ้มค่าสุด) / **Claude Sonnet 4** / **OpenAI GPT-4o** |
| **Audio & Speech (TTS)** | **Web Speech API (Microsoft Premwadee Natural)** + **OpenAI TTS** + **ElevenLabs** |
| **Messaging Webhooks** | **LINE Messaging API** + **Facebook Messenger Webhook (Meta Graph API)** |
| **Slip & Payments** | **EasySlip API**, **SlipOK**, **PromptPay QR**, **Stripe SDK** |
| **Social Data Scraping** | **RapidAPI (TikTok & Social Media APIs)** |
| **Scheduled Tasks** | **Supabase pg_cron + pg_net** → `/api/cron/follow-up` ([setup](docs/guides/scheduler-pg-cron.md)) |
| **Hosting & CI/CD** | **Vercel Edge Platform** |

---

## 🚀 การติดตั้งและเริ่มต้นใช้งาน (Getting Started)

### 1. โคลนโปรเจกต์และติดตั้ง Dependencies
```bash
git clone https://github.com/praphawach29/DealMee.git
cd DealMee
npm install
```

### 2. ตั้งค่าตัวแปรสภาพแวดล้อม (`.env.local`)
คัดลอกไฟล์ตัวอย่างและกรอกคีย์ที่จำเป็น:
```bash
cp .env.example .env.local
```

ตัวอย่างการตั้งค่าหลักใน `.env.local`:
```env
# ── Server & URL ───────────────────────────────────────────
PORT=3000
APP_URL=http://localhost:3000
CRON_SECRET=dealmee_cron_your_random_secret_token

# ── Supabase (Database & Auth) ────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_KEY=your-supabase-service-role-key

# ── AI Providers ──────────────────────────────────────────
CLAUDE_KEY=sk-ant-api03-xxxx
OPENAI_KEY=sk-proj-xxxx
# GEMINI_KEY=xxxx

# ── Slip Verification (EasySlip / SlipOK) ────────────────
SLIP_PROVIDER=easyslip
EASYSLIP_API_KEY=your-easyslip-api-key

# ── Social Scraping ───────────────────────────────────────
RAPIDAPI_KEY=your-rapidapi-key

# ── Optional: Ultra-Realistic Voice Cloning ───────────────
ELEVENLABS_API_KEY=your-elevenlabs-api-key
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```

### 3. รันเซิร์ฟเวอร์สำหรับพัฒนา (Development Server)
```bash
npm run dev
```
เปิดเบราว์เซอร์ไปที่:
* **หน้า Dashboard & Live Studio:** [http://localhost:3000/dashboard/live-studio](http://localhost:3000/dashboard/live-studio)
* **หน้าส่องร้านคู่แข่ง:** [http://localhost:3000/dashboard/competitors](http://localhost:3000/dashboard/competitors)
* **หน้า OBS Overlay พรีวิว:** [http://localhost:3000/live/overlay/your-shop-id](http://localhost:3000/live/overlay/your-shop-id)

### 4. ตรวจสอบโค้ดและทดสอบ Build
```bash
npx tsc --noEmit
npm run build
```

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```text
DealmeeChatbot/
├── .github/workflows/          # GitHub Actions Cron (Follow-up scheduler)
├── public/                     # Static Assets & Sample AI Voice MP3s
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── cron/           # Proactive Follow-up Automation API
│   │   │   ├── live/           # Live Studio APIs (pitch, tts, switch)
│   │   │   ├── competitors/    # Competitor Scraping & AI Script Generator
│   │   │   ├── webhook/        # LINE & Facebook Messenger Webhook Handlers
│   │   │   └── verify-slip/    # EasySlip & SlipOK verification endpoints
│   │   ├── dashboard/
│   │   │   ├── live-studio/    # DealMee AI Live Studio & Voice Tuner UI
│   │   │   ├── competitors/    # AI Competitor Spy Dashboard
│   │   │   ├── settings/       # Bot Persona, Prompts & Social Tokens
│   │   │   ├── inbox/          # Omnichannel Live Chat Inbox
│   │   │   └── orders/         # Orders & Payment Tracking
│   │   └── live/overlay/       # OBS Browser Source 60 FPS Real-time Screen
│   ├── components/             # Reusable UI & Layout Components
│   └── lib/                    # Supabase Admin, AI Providers & Business Logic
├── supabase/migrations/        # Database Migrations (Omnichannel, Live Studio, Follow-ups)
├── next.config.ts              # Next.js 16 & Turbopack Configuration
└── package.json
```

---

## 🔒 Security & Best Practices
* **Zero-Leak Webhooks:** ปกป้อง Webhook ทุกเส้นทางด้วย Webhook Signature Verification ทั้งฝั่ง LINE, Meta (Facebook) และ EasySlip
* **Row Level Security (RLS):** ข้อมูลทุกตารางใน Supabase ถูกจำกัดสิทธิ์ระดับร้านค้า (`shop_id`) ป้องกันการเข้าถึงข้ามบัญชีอย่างสมบูรณ์
* **Encrypted Secrets:** เก็บรักษา Token และคีย์ส่วนตัวผ่าน Environment Variables และฐานข้อมูลที่เข้ารหัส

---

## 📄 License
ลิขสิทธิ์เฉพาะของทีมพัฒนา DealMee AI (Proprietary Software). สงวนลิขสิทธิ์ทั้งหมด.
