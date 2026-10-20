# DealMee AI - Project Handover & TODO List

> **บันทึกล่าสุด:** 20 ตุลาคม 2026 (ดูหัวข้อ "อัปเดต 20 ตุลาคม 2026" ด้านล่าง)  
> **Repository:** `praphawach29/ai-agent-google-SDK` (Branch: `main`)  
> **Last Commit:** `85a9c17` - *docs: DealMee auth email templates with token_hash links (#49)*  
> **Status:** Production Build Passed (`npm run build` ✓)

---

## 🆕 อัปเดต 20 ตุลาคม 2026 — กระเป๋าเงิน, Super Admin, รีเซ็ตรหัสผ่าน (PR #29–#49)

**Billing / กระเป๋าเงิน (PR #30–#43)**
- กระเป๋าเงินแบบเติมเงินผ่านพร้อมเพย์ ราคาใหม่ และแพ็กเสริม (#30) หน้า landing แสดงแพ็กเกจกระเป๋าเงิน/โควต้าตรวจสลิป/แพ็กเสริม (#31)
- ยืนยันการซื้อแบบมีดีไซน์ และแสดงรายการเติมเงินที่รออนุมัติชัดขึ้น (#35)
- รับสลิปที่โอนเข้าบัญชีธนาคารที่ผูกกับพร้อมเพย์ของเรา (#36)
- ยอดกระเป๋าเงินอัปเดตแบบเรียลไทม์ + การ์ดอนุมัติ (#38)
- แจ้งเจ้าของแพลตฟอร์มทาง LINE เมื่อมีการเติมเงิน (#42) ผ่าน LINE OA แยกของเจ้าของ (#43)
- ใบเสร็จเปิดได้อีกครั้ง — เลิก select `shops.email` ที่ production ไม่มี (#44)

**แอดมิน / เครื่องมือ (PR #32–#41, #45)**
- ลบ component landing ที่ไม่ใช้ (#32), เมนูตั้งค่าบัญชีรับเงินแยก (#33), แสดงรายการชำระเงินอีกครั้ง (#37)
- สวิตช์เครื่องมือแสดงและควบคุมสิ่งที่บอททำได้จริง (#39), ข้อความติดตาม/ยกเลิกออเดอร์ค้างจ่ายบนหน้าเครื่องมือ (#40), เวลาทำการของบอท (#41)
- หน้าตั้งค่าบอทแสดงผู้ให้บริการ AI แทนชื่อโมเดล และตัดข้อความอ้างที่ยืนยันไม่ได้ (#45)

**ความปลอดภัย / การเข้าสู่ระบบ (PR #34, #46–#49)**
- ลบปุ่ม "ตั้งตัวเองเป็น Super Admin" (#34) และกำหนดให้ **praphawach@gmail.com เป็น Super Admin คนเดียว** (`src/lib/auth/superAdmin.ts`, #46) — รัน SQL แล้ว ทดสอบแล้ว บัญชีอื่นเข้า `/admin` ไม่ได้
- รีเซ็ตรหัสผ่านไม่มีฟอร์มให้ตั้งรหัส: ลิงก์แบบ PKCE ใช้ได้เฉพาะเบราว์เซอร์ที่กดขอ (เปิดจากแอป Gmail = ใช้ไม่ได้)
  - #47 proxy ส่ง `code`/`token_hash` ที่ตกที่ `/` หรือ `/login` ไป `/auth/callback`; ลิงก์ที่ใช้ไม่ได้ไป `/reset-password?error=link` ซึ่งบอกเหตุผลและให้ขอลิงก์ใหม่
  - #48 หลังตั้งรหัสใหม่ ร้านค้าไป `/dashboard` (เดิมไป `/admin` ที่ถูกล็อกตั้งแต่ #46)
  - #49 เทมเพลตอีเมล Supabase Auth 6 แบบใน `docs/email-templates/` ใช้ลิงก์ `token_hash` — **ตั้งใน Supabase Dashboard แล้ว** ทดสอบรีเซ็ตรหัสผ่านแล้ว ✅ (โลโก้ขึ้น เข้าหน้าตั้งรหัสได้ เข้าแดชบอร์ดได้)
- Supabase Auth URL Configuration ตรวจแล้ว: Site URL `https://app.dealmee.app`, Redirect URLs มี `app.dealmee.app/**` และ `dealmee.app/**`

**ยังไม่ได้ทดสอบ:** ลิงก์ในอีเมล Confirm signup (ตอนนี้สมัครแล้วเข้าระบบทันที ไม่ได้ส่งอีเมลยืนยัน), Invite, Magic link, Change email — ถ้าเปิดใช้ ให้ลองกดลิงก์จริงก่อน

## อัปเดต 19 ตุลาคม 2026 (รอบ 2) — ต้นทุน AI ต่อข้อความ (PR #27–#28, แผน 1.8)

- Gemini explicit context cache (PR #27) + ชุดเครื่องมือคงที่ให้ใช้ cache ร่วมกัน (PR #28): input ~85–88% คิดราคา 0.1× — ต้นทุนเหลือ ~0.13–0.15 บาท/ข้อความ (จาก ~1.5–2 บาทก่อน PR #23)
- ทวงจ่ายใน LINE ทดสอบแล้ว ✅
- **รอเจ้าของระบบ:** ตัดสินใจราคา/โควต้าแพ็กเกจก่อน 1 ม.ค. 2027 (ราคา Gemini ×2) — ตัวเลขและตารางเทียบอยู่ในไฟล์แผน หัวข้อ "ทบทวนต้นทุน AI"

## อัปเดต 19 ตุลาคม 2026 — โควต้า, ต้นทุน AI, Messenger, ความปลอดภัย (PR #20–#25)

- **โควต้าข้อความเพิ่งเริ่มทำงานจริง:** ตาราง `usage_logs` บน production ผิดรูปแบบ ไม่เคยนับข้อความ (Free/หมดทดลองใช้ได้ไม่จำกัด) — แก้ด้วย migration (PR #22) และรันแล้ว
- **ต้นทุน AI ลดลง 3–6 เท่า, ตอบเร็วขึ้น:** Gemini thinking `low` + ตัด context (PR #23) — ถ้าคุณภาพลดลง ตั้ง `GEMINI_THINKING_LEVEL=medium` ใน Vercel
- Messenger/IG: ได้ใบเสนอราคาเป็นปุ่มลิงก์ (PR #21) และข้อความติดตามตามกฎ 24 ชม. (PR #24)
- ความปลอดภัย: ไม่สร้างเลขอ้างอิงสลิปเอง (PR #20), ตรวจลายเซ็น webhook TikTok/Shopee (PR #25)
- รอเจ้าของระบบ: key ผู้ให้บริการตรวจสลิปเจ้าที่สอง, เพิ่มแพ็กเกจ CheckMee เป็นสินค้า, ทดสอบทวงจ่ายใน Messenger — ดูตารางในไฟล์แผน

## อัปเดต 18 ตุลาคม 2026 (รอบ 2) — webhook ตอบเร็ว & ตรวจสลิป (PR #16–#18)

- webhook ทุกช่องทางตอบ 200 ทันทีแล้วให้ AI/ตรวจสลิปทำงานต่อใน `after()`; loading ใน LINE และ typing bubble ใน Messenger ค้างจนตอบเสร็จ (PR #16)
- อ่าน mini-QR บนสลิปเองก่อนเรียก API ที่เสียเงิน: ตัดรูปที่ไม่ใช่สลิปและสลิปซ้ำออกก่อน (PR #17)
- ผู้ให้บริการตรวจสลิปสำรองเมื่อเจ้าหลักล่ม/โควต้าหมด (PR #18) — **ต้องตั้ง key เจ้าที่สองใน Vercel** ถึงจะทำงาน
- ทดสอบบน production แล้ว: ส่งสลิปจริงใน LINE มี loading และอ่านยอดได้ — รายละเอียดและสิ่งที่ยังไม่ได้ทดสอบดูในไฟล์แผน
- เหลือ: ~~ตรวจลายเซ็น webhook TikTok/Shopee~~ (PR #25), 1.8 ทบทวนต้นทุน AI (หลัง 20 ต.ค.)

## อัปเดต 18 ตุลาคม 2026 — ช่วงทดลอง & ปิดงานแผนส่วนที่ 1 (PR #13–#15)

- ช่วงทดลอง 14 วัน (ฟีเจอร์ Pro, 300 ข้อความ) → หมดแล้วเป็น Free 100 ข้อความ/เดือน ล็อกการขายอัตโนมัติ (PR #14, `src/lib/billing/trial.ts`)
- ออเดอร์ค้างจ่ายยกเลิกอัตโนมัติ 24 ชม. + คืนสต็อก (PR #13)
- ออเดอร์หลายสินค้า, ตาราง `payment_slips`, ตรวจสลิปบน Facebook/Instagram, เก็บกวาดเครื่องมือที่ไม่มีโค้ด (PR #15) — สถานะแต่ละข้อดูในไฟล์แผน
- เหลือ: 1.8 ทบทวนต้นทุน AI (หลัง 20 ต.ค.); 2.5 ลบบัญชีที่ไม่ได้ใช้ — ✅ ลบแล้ว 18 ต.ค.

## อัปเดต 17 ตุลาคม 2026 — Bot Sales Hardening (PR #1–#9)

- รายการสิ่งที่แก้ทั้งหมด: [PROJECT_STATUS.md › Bot Sales Hardening](./PROJECT_STATUS.md)
- **แผนงานถัดไป (เรียงลำดับแล้ว):** [docs/plans/2026-10-17-bot-sales-and-onboarding-next-steps.md](./docs/plans/2026-10-17-bot-sales-and-onboarding-next-steps.md)
- ตั้งค่าที่ต้องคงไว้: `CRON_SECRET` ใน Vercel = GitHub secret `CRON_SECRET`, GitHub secret `APP_URL=https://app.dealmee.app`, `GEMINI_MODEL=gemini-3.8-flash`
- รอเจ้าของระบบตัดสินใจ: ราคาแพ็กเกจหลังเห็นต้นทุน AI จริง (ข้ออื่นตัดสินใจและทำแล้ว 18 ต.ค.)

---

## 📌 สรุปงานและฟีเจอร์ที่พัฒนาสำเร็จในรอบนี้ (What's Done)

### 0. Facebook Messenger Live Full Commerce & App Review (อัปเดตล่าสุด)
- **Live Messenger Testing Confirmed:**
  - ผ่านการทดสอบ Webhook Handshake และตอบกลับข้อความจาก Facebook Page จริงเรียบร้อย
  - ซิงค์เข้าหน้าประวัติแชทและ Unified Inbox ทันที
- **Product Carousel & Rich Cards บน Facebook Messenger:**
  - พัฒนา `sendFacebookProductCarousel` ด้วย Generic Template Carousel ส่งการ์ดสินค้าพร้อมรูปภาพ, ราคา, สถานะสต็อก, และปุ่ม **"🛒 สั่งซื้อสินค้านี้"**
  - รองรับ Postback Payload (`event.postback?.payload`) ทำให้คลิกสั่งซื้อแล้วบอท AI พาเข้ากระบวนการสรุปยอดได้ทันที
  - เพิ่ม `sendFacebookImage` รองรับการส่งภาพ QR Code PromptPay, รูปสลิป และรูปภาพสินค้าเข้าแชท
- **Human Takeover 1-Hour Auto-Resume Bug Fix:**
  - แก้ไขจุดที่เมื่อแอดมินกด Takeover ครบ 1 ชม. แล้วระบบต้องรีเซ็ตทั้ง `status: 'ai'` และ `ai_mode: 'auto'` เพื่อให้บอทกลับมาตอบอัตโนมัติได้อย่างสมบูรณ์แบบ
- **Meta App Review Comprehensive Guide:**
  - จัดทำเอกสารคู่มือฉบับสมบูรณ์สำหรับขออนุมัติกับ Meta ที่ [`docs/FACEBOOK_APP_REVIEW_GUIDE.md`](file:///c:/Users/Jack/Documents/DealmeeChatbot/docs/FACEBOOK_APP_REVIEW_GUIDE.md) พร้อมสคริปต์ภาษาอังกฤษสำหรับ Copy & Paste

### 1. Omnichannel & Multi-Channel Chat System (Step 1 - Step 3)
- **Unified Inbox (`/dashboard/inbox`):**
  - รวมแชทจากทุกช่องทางไว้ที่เดียว พร้อมแถบฟิลเตอร์แยกช่องทาง: **ทั้งหมด, LINE OA, Facebook, Shopee, TikTok Shop**
  - แสดงป้ายกำกับช่องทาง (Platform Badges) ชัดเจนในรายการแชท
  - ระบบ **Takeover / สลับคนตอบแอดมิน (`is_ai_paused`)**: แอดมินสามารถกดหยุด AI ชั่วคราว และพิมพ์ข้อความตอบกลับจากหน้า Dashboard ส่งตรงไปยังลูกค้าบน LINE OA และ Facebook ทันที
  - ระบบ **Auto-Refresh Polling**: โหลดข้อความใหม่แบบเรียลไทม์อัตโนมัติ
- **AI Copilot Draft Assistant:**
  - เพิ่มปุ่ม **"Draft AI Response (ร่างคำตอบด้วย AI)"** ในหน้า Inbox ช่วยแอดมินร่างคำตอบอัตโนมัติตามบริบทบทสนทนา สามารถแก้ไขข้อความก่อนกดส่งได้
- **Facebook Messenger Integration:**
  - สร้าง Webhook Endpoint: `/api/webhook/facebook/[shop_id]`
  - รองรับการ Verify Token (Webhook Handshake) และรับ Event `messages` จาก Facebook Graph API
  - หน้าทดสอบจำลอง: `/api/test/facebook-webhook` สำหรับ Dev/Testing
- **Channels Settings Tab (`/dashboard/settings` -> ช่องทางเชื่อมต่อ Channels):**
  - หน้าตั้งค่าเฉพาะสำหรับเชื่อมต่อ 4 ช่องทาง (LINE OA, Facebook, Shopee, TikTok Shop)
  - ลิงก์ตรงสู่ Developers Console ของแต่ละแพลตฟอร์ม พร้อมป้ายสถานะ (เชื่อมต่อแล้ว / รอเชื่อมต่อ / ยกเลิก)
- **Multi-Channel Broadcast (`/dashboard/broadcast`):**
  - รองรับการตั้งค่าบรอดแคสต์ส่งข้อความหรือโปรโมชั่นไปยังลูกค้าตามช่องทางที่เลือก

---

### 2. Central Inventory Pooling & Marketplace Sync (BigSeller Architecture - Step 4)
- **Central Master SKU Inventory Architecture:**
  - รองรับการผูกสินค้าหลายร้านค้า/หลายช่องทางเข้ากับ **Master SKU กลาง** เดียวกัน (`master_sku`)
  - อัลกอริทึมกระจายสต็อกและป้องกันการขายเกิน (Overselling Protection)
- **Marketplace Sync Engine (`/dashboard/products`):**
  - เพิ่มปุ่มและ Modal สำหรับกด **"ซิงค์สินค้า Marketplace"** (Shopee / TikTok Shop)
  - แสดงความคืบหน้าการซิงค์แบบเรียลไทม์ (Progress bar, จำนวนสินค้าที่อัปเดต, บันทึกการเปลี่ยนแปลง)
  - ตารางบันทึกประวัติการขยับสต็อกข้ามช่องทาง (`marketplace_stock_logs`) สำหรับตรวจสอบย้อนหลัง
- **Dynamic Category Filter:**
  - ปรับหมวดหมู่สินค้าในหน้าร้านค้าให้แสดงเฉพาะหมวดหมู่ที่มีสินค้าอยู่จริงโดยอัตโนมัติ (Dynamic Deduplication)

---

### 3. Quotation & Document Lifecycle Engine (ใบเสนอราคา & เอกสาร B2B)
- **Customer Approval & Digital Signature Flow:**
  - ลูกค้าสามารถกดอนุมัติใบเสนอราคาออนไลน์ พร้อมลงลายมือชื่อดิจิทัล (Digital Signature Canvas) ที่ `/doc/quotation/[id]`
  - แจ้งเตือนเข้า LINE OA ร้านค้าทันทีเมื่อลูกค้ากดอนุมัติ
- **1-Click Document Conversion:**
  - แปลงสถานะจากใบเสนอราคา (Quotation) เป็นใบแจ้งหนี้ (Invoice) หรือใบสั่งขาย (Sales Order) ได้ในคลิกเดียว
- **Luxury Multi-format Export:**
  - ดาวน์โหลดเอกสารได้ทั้ง **PDF, Microsoft Word (.docx), และ Microsoft Excel (.xlsx)**
  - จัดรูปแบบระดับองค์กร: แปลงตัวเลขเป็นข้อความบาทไทย (`bahttext`), หัวตารางรวมช่อง, การ์ดแสดง QR PromptPay และช่องเซ็นชื่ออนุมัติ

---

### 4. Official DealMee Branding & Logo Refresh (อัปเดตโลโก้แบรนด์ใหม่)
- เปลี่ยนมาใช้ไฟล์โลโก้ DealMee ทางการ (`/logos/concept-d1.jpg`) สัญลักษณ์ตัว D-Chat สดใส พร้อมดาวการันตี
- ใช้ชุดสีแบรนด์: **Deal** (Electric Blue `#2E5BFF`) + **Mee** (Cyber Cyan `#00CFEC`)
- นำไปปรับใช้ครบทุกหน้าของระบบ:
  1. **หน้าแอดมิน (Super Admin - `/admin`)**: Desktop Sidebar และ Mobile Drawer
  2. **หน้าร้านค้า (Merchant Dashboard - `/dashboard`)**: Desktop Sidebar, Mobile Drawer, Header
  3. **หน้าแรกเว็บไซต์ (Landing Page)**: Navbar ด้านบน และ Footer ด้านล่าง
  4. **หน้าเข้าสู่ระบบ (Login / Register - `/login`)**: ทั้ง Desktop Showcase Banner และ Mobile Header
  5. **หน้าตั้งค่าร้านค้า (Onboarding - `/onboarding`)**
  6. **หน้าเงื่อนไขและนโยบาย (`/terms`, `/privacy`)**
  7. **Favicon / Browser Tab Icon (`/app/layout.tsx`)**

---

## 🗄️ สิ่งที่ต้องทำบน Supabase (Database Migrations to Run)

เมื่อเปิดเครื่องกลับมาทำงาน ให้เปิด [Supabase Dashboard](https://supabase.com/dashboard) เข้าไปที่ **SQL Editor** แล้วรันไฟล์ต่อไปนี้ตามลำดับ (หากยังไม่ได้รัน):

```sql
-- 1. Omnichannel Base Schema (ตารางช่องทาง, แชท, ข้อความ)
supabase/migrations/20261012220000_omnichannel_schema_step1.sql

-- 2. Facebook Messenger Integration
supabase/migrations/20261012230000_facebook_messenger_step2.sql

-- 3. Multi-channel Broadcast & AI Copilot Drafting
supabase/migrations/20261013020000_omnichannel_step3.sql

-- 4. Central Multi-Store Inventory & Marketplace Master SKU
supabase/migrations/20261013030000_marketplace_central_inventory.sql
```

---

## 📋 แผนงานถัดไปเมื่อกลับมาทำต่อ (Action Items / TO-DO Checklist)
> **เกณฑ์การผ่าน (DoD):** ทุกหัวข้อต้องทำการทดลองและทดสอบจริง (End-to-End Testing) จนแน่ใจว่าทำงานได้สมบูรณ์ 100%

### เสาหลักที่ 1: ตรวจสอบ Omnichannel AI Agent สู่ความสมบูรณ์แบบ 100% (LINE + FB + IG + Marketplace Chat)
- [ ] **LINE OA & Facebook Messenger 100% Polish:**
  - [x] LINE OA และ Facebook Messenger ผ่านการทดสอบจริงแล้ว > 85-90% (ตอบแชท, ส่งการ์ด Carousel, รับออเดอร์, ส่ง QR)
  - [ ] Stress-test จำลองการถามตอบ 20 บทสนทนาพร้อมกัน เช็คความแม่นยำของคำตอบและไม่สะดุด
  - [ ] ตรวจสอบความถูกต้องของการตัดสต็อกแบบเรียลไทม์ และระบบ Auto-Resume หลังหมดเวลาพัก 1 ชม.
- [ ] **Instagram Direct Messenger Integration (IG):**
  - [ ] เชื่อมต่อ Instagram Graph API (Messenger Platform for IG) ร่วมกับโครงสร้างของ Facebook Webhook
  - [ ] ทดสอบการตอบแชทและส่งการ์ดสินค้าบน Instagram Direct
- [ ] **Marketplace Chat Ingestion (Shopee & TikTok Shop):**
  - [ ] ดึงประวัติการคุยจาก Shopee Open Platform และ TikTok Shop เข้ามาที่ Unified Inbox (`/dashboard/inbox`)
  - [ ] แอดมินสามารถเปิดดูและให้ AI Copilot ช่วยร่างคำตอบส่งกลับไปยัง Shopee/TikTok ได้ในที่เดียว

### เสาหลักที่ 2: ระบบส่องร้านคู่แข่ง (Competitor Intelligence & Market Insights)
- [ ] **API Ingestion จาก `cporter202/social-media-scraping-apis`:**
  - [ ] เชื่อมโยงโมดูล Scraping API สำหรับส่องข้อมูลจาก TikTok, Instagram, Facebook
- [ ] **Competitor Pricing & Promotion Tracker:**
  - [ ] หน้าแดชบอร์ด `/dashboard/competitors` ให้ร้านค้าใส่ลิงก์ร้านคู่แข่งที่ต้องการเฝ้ามอง
  - [ ] ระบบตรวจจับการปรับราคา และแจ้งเตือนเมื่อคู่แข่งลดราคาหรือจัด Flash Sale
- [ ] **Viral Content & Strategy Generator:**
  - [ ] ดึงโพสต์และคลิปที่ยอดวิว/ยอดไลก์สูงสุดของคู่แข่ง
  - [ ] ให้ AI สรุปกลยุทธ์และร่างไอเดียคอนเทนต์ + แคปชั่นขายของที่น่าดึงดูดกว่าส่งให้ร้านค้า

### เสาหลักที่ 3: ระบบ DealMee AI Live Studio (24/7 Virtual Commerce Streamer)
- [ ] **Real-time Live Comment Listener:**
  - [ ] เชื่อมต่อ WebSocket ดักฟังคอมเมนต์สดจาก TikTok Live, Facebook Live, Shopee Live
- [ ] **OBS Studio Live Overlay Widget (`/live/overlay/[shop_id]`):**
  - [ ] สร้างหน้าจอกราฟิกการ์ดสินค้าเคลื่อนไหว (Animated Product Overlay) ดึงข้อมูลจากคลังสินค้า DealMee
  - [ ] เมื่อมีคอมเมนต์ถามถึงสินค้าตะกร้าไหน หน้าจอจะสลับภาพตะกร้าขึ้นมาเด่นทันที
- [ ] **Thai Neural Voice (TTS) & Lip-Sync:**
  - [ ] สังเคราะห์เสียงพูดภาษาไทยสมจริงตอบคำถามลูกค้ากลางไลฟ์แบบเรียลไทม์ (< 2 วินาที)
  - [ ] เชื่อมต่อภาพอวตารคนเสมือนจริง (Digital Human) ขยับปากพูดตอบสด
- [ ] **Auto-Pin & Instant Checkout:**
  - [ ] สั่ง Pin ตะกร้าสินค้าบน TikTok/Shopee
  - [ ] ทักแชท Messenger ส่งลิงก์ชำระเงินเมื่อคนดูพิมพ์ "CF" ใน Facebook Live

---

## 🚀 คำสั่งสำหรับเริ่มโปรเจกต์เมื่อเปิดเครื่องใหม่

```bash
# 1. ติดตั้งหรือเช็ค dependencies
npm install

# 2. รันโหมด Development (ทดสอบระบบที่ localhost:3000)
npm run dev

# 3. ตรวจสอบความถูกต้องของ Type
npx tsc --noEmit

# 4. ทดสอบคอมไพล์ Production Build
npm run build
```

---
*เอกสารนี้ถูกบันทึกอัตโนมัติเพื่อให้สามารถกลับมาพัฒนาต่อได้อย่างไร้รอยต่อ*
