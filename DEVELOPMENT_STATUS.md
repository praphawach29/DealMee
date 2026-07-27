# 🚀 Botify AI — Development Roadmap & Status Summary

เอกสารสรุปสถานะการพัฒนาล่าสุด และแผนการพัฒนาระยะถัดไปของโปรเจกต์ **Botify AI (`botify-saas-web`)**

---

## 📌 Executive Summary
**Botify AI** คือ SaaS Platform สำหรับพนักงานขายปัญญาประดิษฐ์ (**AI Sales Employee Platform**) ที่เชื่อมต่อกับ LINE OA และระบบโซเชียลมีเดียของร้านค้าไทย ช่วยเชียร์ขาย แนะนำสินค้า ตอบคำถาม ปิดการขาย ตรวจสลิป และบริหารจัดส่งพัสดุอัตโนมัติ 24/7

---

## 🟢 1. สถานะการพัฒนาที่สำเร็จแล้ว (Completed Features)

### 🤖 AI Sales Employee Engine (`gemini-3.6-flash`)
- **Sales Pipeline 4 สเต็ป:** 
  1. *Discovery & Greeting:* ทักทาย ถามความต้องการ แนะนำสินค้า
  2. *Product Showcase & Stock:* แจ้งรายละเอียดสินค้า ราคา และสต๊อกพร้อมส่ง
  3. *Closing & Payment:* สรุปยอดเงินพร้อมข้อมูลโอนเงิน (พร้อมเพย์/ธนาคาร)
  4. *Post-Sales & Slip Check:* ขอบคุณและแนะนำวิธีส่งสลิปโอนเงิน
- **Customer Memory Retention:** ดึงประวัติแชทย้อนหลัง 10 ข้อความมาประมวลผลความต่อเนื่องของบทสนทนา
- **Single Context RAG Pipeline:** รวมคลังความรู้ FAQ (`knowledge_base`) และสินค้าพร้อมส่ง (`products`) ป้อนให้ Gemini ตอบกลับแม่นยำ ไร้การมโน
- **LINE Webhook Integration:** เชื่อมต่อเรียบร้อยใน `/api/webhook/[shop_id]`

### 🛍️ ระบบจัดการสินค้าแบบมืออาชีพ (`/dashboard/products`)
- **Custom Categories:** สร้างและเพิ่มหมวดหมู่สินค้าใหม่ได้เองแบบไดนามิก
- **Local Image Upload:** อัปโหลดไฟล์รูปภาพจากเครื่องพร้อม Live Preview Thumbnail
- **✨ AI Copywriter (Gemini 3.6 Flash):** ให้ AI ช่วยแต่งคำอธิบายสินค้าภาษาไทยให้น่าซื้อ (สงวนสิทธิ์เฉพาะแพ็กเกจ Pro ฿990 ขึ้นไป)
- **📥 Bulk CSV Import & Template Download:** ดาวน์โหลดไฟล์ตัวอย่าง CSV และนำเข้าสินค้าจำนวนมากได้ในคลิกเดียว
- **Solid UI Design:** ปรับแต่งป๊อปอัปเป็นสีทึบ 100% (`bg-slate-900` & `bg-slate-800`) ไฮคอนทราสต์ อ่านง่าย คมชัด

### 👑 Super Admin Portal (`/admin`)
- **Role & Page Isolation:** แยกส่วนการทำงานของ Super Admin ออกจาก Merchant Dashboard 100% (ไม่มีปุ่มกดย้อนกลับปะปน)
- **Shops Management (`/admin/shops`):** แสดงผล responsive 2-column card grid บนมือถือ/แท็บเล็ต และ Data Table บน Desktop พร้อมระบบ Toggle Status, Change Plan, Impersonate Shop
- **SaaS Plans Management (`/admin/plans`):** จัดการ 5 แพ็กเกจ (Free ฿0, Starter ฿390, Pro ฿990 ✨, Agency ฿2,490, BYOK ฿590) พร้อม Modal แก้ไขข้อมูลสีทึบคมชัด บันทึกลงตาราง `public.plans`

### 📱 Responsive Layout & Design System
- ใช้สถาปัตยกรรม Tailwind CSS v4 + Compact Typography
- รองรับทุกขนาดหน้าจอ (Desktop, Tablet 2-column, Mobile 1-column)
- Verify `npm run build` ผ่าน 100% (0 Errors across 22 static and dynamic routes)

---

## 🗺️ 2. แผนการพัฒนาระยะต่อไป (Roadmap & Next Steps)

### 📌 Phase 2: AI Employee Upgrades (Q3 2026)
- [x] **Invisible Multi-Model Router (Botify Brain Engine™):** ทำงานเบื้องหลัง 100% สลับใช้ **Gemini 3.6 Flash** สำหรับแชททั่วไป (85%) และ **Claude 3.5 Sonnet / ChatGPT 5.6** สำหรับเคสต่อรองปิดการขายยาก (15%) รักษากำไร > 85% โดยร้านค้าไม่ต้องตั้งค่าใดๆ
- [ ] **Customer Memory Graph (Entity Profile):** บันทึกรสนิยม ไซส์สินค้า และประวัติสั่งซื้อแบบ Graph DB เพื่อการขายเจาะจงบุคคล (Personal Shopper)
- [ ] **Automated Bank Slip Verification API:** เชื่อมต่อ API ธนาคาร ตรวจสอบสลิปโอนเงินจริงอัตโนมัติ

### 📌 Phase 3: Sales Automation & Analytics (Q4 2026)
- [ ] **ROI & Performance Dashboard:** แสดง Conversion Rate, Cost Per Conversation (CPC), Average Response Time และ CSAT Score
- [ ] **Automated Shipping & Tracking:** เชื่อมต่อ Flash Express / J&T / ไปรษณีย์ไทย สำหรับสร้างเลขพัสดุและแจ้งลูกค้าอัตโนมัติใน LINE OA
- [ ] **Multi-Channel Expansion:** ขยายการรองรับไปยัง Facebook Messenger, Instagram DM และ TikTok Shop

---

## 📂 3. โครงสร้างไฟล์สำคัญของโปรเจกต์ (Key Architecture Files)

| Path | Description |
| :--- | :--- |
| `src/lib/ai/salesAgentEngine.ts` | คอร์เอนจิน AI พนักงานขาย (Gemini 3.6 Flash + Pipeline + Memory) |
| `src/app/api/webhook/[shop_id]/route.ts` | Webhook รับข้อความจาก LINE OA |
| `src/app/dashboard/products/ProductsManager.tsx` | หน้าจัดการสินค้า (Custom Categories, Image Upload, AI Copywriter, CSV Import) |
| `src/app/dashboard/products/actions.ts` | Server Actions จัดการสินค้า & AI Copywriter API |
| `src/app/admin/plans/PlansManagement.tsx` | หน้าจัดการแพ็กเกจ SaaS ในส่วน Super Admin |
| `src/app/admin/shops/ShopsManagement.tsx` | หน้าจัดการร้านค้าสมาชิกสำหรับ Super Admin |
| `src/app/admin/actions.ts` | Server Actions สำหรับ Super Admin & SaaS Plans |
| `supabase_schema_update.sql` | ไฟล์ SQL อัปเดตโครงสร้างฐานข้อมูลและ Seed Data ของ Supabase |

---
*อัปเดตล่าสุดเมื่อ: 27 กรกฎาคม 2026*
