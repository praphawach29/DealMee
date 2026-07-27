# 🤖 Botify AI — AI Sales Employee SaaS Platform

**Botify AI** คือ SaaS Platform สำหรับพนักงานขายปัญญาประดิษฐ์ (**AI Sales Employee Platform**) ขับเคลื่อนด้วย **Gemini 3.6 Flash** (พร้อม Claude Sonnet 5 / GPT-5.6 เป็น high-persuasion/fallback provider) เชื่อมต่อกับ LINE OA และระบบโซเชียลมีเดียของร้านค้าไทย ช่วยเชียร์ขาย แนะนำสินค้า ตอบคำถาม ปิดการขาย ตรวจสลิป และบริหารจัดส่งพัสดุอัตโนมัติ 24/7

> 📖 **สถานะปัจจุบันของโปรเจกต์:** [PROJECT_STATUS.md](./PROJECT_STATUS.md)
> 🗺️ **แผนการพัฒนาถัดไป:** [ROADMAP.md](./ROADMAP.md)

---

## 🛠️ Tech Stack & Architecture

- **Framework:** Next.js 16 (App Router & Server Actions)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS v4 + Compact Typography Design System
- **Database & Auth:** Supabase PostgreSQL & Supabase SSR Auth
- **AI Core:** Gemini 3.6 Flash (primary) → Claude Sonnet 5 (high-persuasion) → GPT-5.6 Luna (fallback) + RAG + Sales Agent State Machine
- **Billing:** Stripe (recurring subscription) + Omise/Opn Payments (PromptPay)
- **Integration:** LINE Messaging API Webhook

---

## 🚀 Getting Started

1. **ติดตั้ง Dependencies:**
   ```bash
   npm install
   ```

2. **ตั้งค่า Environment Variables (`.env.local`):**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   GEMINI_API_KEY=your-gemini-api-key
   ```
   ดูรายการตัวแปรทั้งหมด (AI providers อื่นๆ, Billing, Slip Verification) ได้ที่ [.env.example](./.env.example)

3. **เปิดใช้งาน Development Server:**
   ```bash
   npm run dev
   ```
   เปิดเบราว์เซอร์ไปที่ [http://localhost:3000](http://localhost:3000)

4. **ตรวจสอบและ Build ผลลัพธ์:**
   ```bash
   npm run build
   ```
