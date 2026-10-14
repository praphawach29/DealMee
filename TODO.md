# DealMee AI - Project Handover & TODO List

> **บันทึกล่าสุด:** 14 ตุลาคม 2026 (11:05 น.)  
> **Repository:** `praphawach29/ai-agent-google-SDK` (Branch: `main`)  
> **Last Commit:** `49829a7` - *feat(facebook): add product cards carousel and media sending for Messenger*  
> **Status:** Production Build Passed (`npm run build` ✓, TypeScript 0 errors ✓)

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

### Phase A: Marketplace API Live Connect (เชื่อมต่อ API จริง)
- [ ] **Shopee Open Platform Integration:**
  - สร้าง OAuth Redirect Handler ที่ `/api/auth/shopee/callback` เพื่อรับ `code` และแลก `access_token`
  - นำ `partner_id` และ `partner_key` มารองรับการเชื่อมต่อร้านค้าจริง
  - เชื่อมโยงฟังก์ชันดึงสินค้า (`get_item_list`) และอัปเดตสต็อก (`update_stock`)
- [ ] **TikTok Shop Partner API Integration:**
  - สร้าง OAuth Authorization Flow สำหรับ TikTok Shop Partner
  - รองรับ Webhook รับคำสั่งซื้อใหม่จาก TikTok Shop ที่ `/api/webhook/tiktok/[shop_id]`
- [ ] **Automatic Stock Deduction Hook:**
  - เมื่อมีออเดอร์ปิดการขายสำเร็จ (ไม่ว่าจะจาก LINE, Facebook, Shopee หรือ TikTok):
    - ระบบจะหักสต็อก Master SKU กลางอัตโนมัติ
    - ยิงอัปเดตสต็อกคงเหลือกลับไปยัง Marketplace ทุกช่องทางทันทีเพื่อป้องกันสินค้าหมดแล้วยังขายได้

### Phase B: Facebook Messenger Live Production Testing
- [ ] นำ URL Webhook จริง (`https://dealmee.app/api/webhook/facebook/<shop_id>`) ไปตั้งค่าใน Meta Developers Portal
- [ ] ทดสอบส่งข้อความจาก Facebook Page จริง ตรวจสอบว่า AI ตอบกลับข้อความผ่าน Graph API ได้ถูกต้อง
- [ ] ตรวจสอบว่าข้อความปรากฏใน Inbox แบบเรียลไทม์

### Phase C: Dashboard Enhancements
- [ ] เพิ่มหน้าดูประวัติการเคลื่อนไหวสต็อก (Stock Movement History) แยกต่างหากในเมนูสินค้า
- [ ] เพิ่มระบบแจ้งเตือนเมื่อสินค้าใกล้หมดสต็อก (Low Stock Alert via LINE Notify / Push)

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
