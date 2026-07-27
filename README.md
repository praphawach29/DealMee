# 🤖 Botify AI — AI Sales Employee SaaS Platform

**Botify AI** คือ SaaS Platform สำหรับพนักงานขายปัญญาประดิษฐ์ (**AI Sales Employee Platform**) ขับเคลื่อนด้วย **Gemini 3.6 Flash** เชื่อมต่อกับ LINE OA และระบบโซเชียลมีเดียของร้านค้าไทย ช่วยเชียร์ขาย แนะนำสินค้า ตอบคำถาม ปิดการขาย ตรวจสลิป และบริหารจัดส่งพัสดุอัตโนมัติ 24/7

> 📖 **รายละเอียดสถานะและแผนการพัฒนาเพิ่มเติม:** สามารถอ่านดูฉบับเต็มได้ที่ไฟล์ [DEVELOPMENT_STATUS.md](file:///c:/Users/Jack/Documents/botify-saas-web/DEVELOPMENT_STATUS.md)

---

## 🛠️ Tech Stack & Architecture

- **Framework:** Next.js 16 (App Router & Server Actions)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS v4 + Compact Typography Design System
- **Database & Auth:** Supabase PostgreSQL & Supabase SSR Auth
- **AI Core:** Gemini 3.6 Flash REST API + RAG + Sales Agent State Machine
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

3. **เปิดใช้งาน Development Server:**
   ```bash
   npm run dev
   ```
   เปิดเบราว์เซอร์ไปที่ [http://localhost:3000](http://localhost:3000)

4. **ตรวจสอบและ Build ผลลัพธ์:**
   ```bash
   npm run build
   ```
