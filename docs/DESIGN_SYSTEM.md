# DealMee AI — Design System & Engineering Style Guide

> **เวอร์ชัน:** 2.0.0 (Updated 2026-09-18)  
> **แบรนด์:** DealMee AI (DealMee.app)  
> **วัตถุประสงค์:** คู่มืออ้างอิงมาตรฐานโทนสี ฟอนต์ และการออกแบบส่วนติดต่อผู้ใช้งาน (UI/UX) อย่างถาวรสำหรับทีมพัฒนาและดีไซเนอร์

---

## 1. การวิเคราะห์ภาพรวมและการกำหนดโทนสี (Brand Identity & Palette Analysis)

### 1.1 เหตุผลทางจิตวิทยาและการเลือกใช้สีถาวร (Why this palette?)
* **Electric Blue (`#2E5BFF`)**:
  - เป็นสีแห่งความน่าเชื่อถือ (Trust), วิศวกรรมระบบความปลอดภัยสูง (Bank-Grade Security), และความแม่นยำระดับ B2B
  - DealMee ต้องจัดการเรื่องเงิน ออเดอร์ ใบเสนอราคา และการตรวจสลิปโอนเงิน การใช้สีน้ำเงินบริสุทธิ์สร้างความรู้สึก "มั่นคง ปลอดภัย ไม่ผิดพลาด"
* **Cyber Cyan (`#00CFEC`)**:
  - เป็นสีที่บ่งบอกถึงเทคโนโลยี AI สมัยใหม่ (Autonomous Intelligence)
  - ช่วยลดความแข็งกระด้างของน้ำเงินแบบระบบราชการหรือธนาคารแบบเดิม ทำให้แบรนด์ดูทันสมัย เป็นมิตร และเข้าถึงง่าย
* **Merchant Canvas (`#F8FAFC`)**:
  - สีพื้นหลังเทาอมฟ้าสว่างนวลตา ช่วยลดความเมื่อยล้าของสายตาพ่อค้าแม่ค้าที่ต้องเปิดจอจัดการออเดอร์และตอบแชทวันละหลายชั่วโมง
* **Cosmic Tech Navy (`#060C1B` / `#0B0E14`)**:
  - ใช้สำหรับส่วน Dark Hero ในหน้า Landing Page และ Admin Dark Theme
  - สร้างมิติความลึกที่สง่างาม ขับเน้นองค์ประกอบ 3D และตัวเลขสถิติให้ดูโดดเด่น

---

## 2. รหัสสีมาตรฐานและตัวแปรในระบบ (Token Specifications)

### 2.1 Core Palette
```css
/* Brand Core */
--color-electric-blue: #2E5BFF;   /* Primary Brand, Main CTA, Active Indicator */
--color-primary-hover: #1F48E0;   /* Button Hover State */
--color-cyber-cyan:    #00CFEC;   /* AI Highlights, Feature Badges, Neon Glows */
--color-deep-indigo:   #1A1B4B;   /* Deep Editorial Headings, Contrast Accents */

/* Backgrounds & Canvas */
--color-merchant-bg:   #F8FAFC;   /* Main Dashboard Background (Slate-50) */
--color-hero-navy:     #060C1B;   /* Landing Page Dark Hero Surface */
--color-surface-white: #FFFFFF;   /* Cards, Bento Grid, Drawers */
--color-surface-dark:  #0F172A;   /* Dark Mode Card Surface (Slate-900) */
--color-whisper-border:#E2E1EF;   /* 1px Hairline Borders (Alpha 0.4) */

/* Functional / Transaction Status */
--color-success-green: #10B981;   /* Paid, Verified Slip, Completed, Live AI */
--color-warning-amber: #F59E0B;   /* Pending Payment, Low Stock, Attention */
--color-error-red:     #EF4444;   /* Fake Slip, Cancelled, API Disconnected */
--color-info-blue:     #3B82F6;   /* Shipped, In Transit, Informational Note */
```

---

## 3. ระบบฟอนต์และการจัดการภาษาไทย (Thai Typography Guidelines)

### 3.1 ฟอนต์ที่ใช้งาน
1. **`IBM Plex Sans Thai`** (Google Fonts):
   - ใช้เป็น **Display Font** (พาดหัว) และ **Body Font** (เนื้อหาทั่วไป)
   - ฟอนต์ประเภท Sans-Serif ไร้หัวที่คมชัดที่สุดสำหรับหน้าจอดิจิทัล
   - ให้กำหนดระยะบรรทัด `line-height: 1.65` เสมอ เพื่อให้วรรณยุกต์ (่ ้ ๊ ๋) และสระบน-ล่าง (ิ ี ึ ื ุ ู) ไม่ชนหรือทับกับบรรทัดถัดไป
2. **`Geist Mono`** (Google Fonts):
   - ใช้เป็น **Numerical & Code Font**
   - แสดงตัวเลขราคา (`฿370.00`), รหัสออเดอร์ (`ORD-509098`), Tracking No., วันที่และเวลา
   - ข้อดี: ความกว้างของตัวเลขทุกตัวเท่ากันเสมอ (Tabular Figures) ทำให้ตารางราคาและรายงานยอดขายตรงแถวสวยงาม

### 3.2 ตัวอย่างคลาส Typography ใน Tailwind CSS
```html
<!-- หัวข้อหลัก Landing Page -->
<h1 className="font-sans font-bold text-3xl sm:text-5xl text-white tracking-tight leading-[1.25]">
  พนักงานขาย AI ที่ไม่เคยหยุดพัก ตลอด 24 ชม.
</h1>

<!-- หัวข้อ Dashboard -->
<h2 className="font-sans font-bold text-xl sm:text-2xl text-on-surface leading-tight">
  คำสั่งซื้อทั้งหมด
</h2>

<!-- ตัวเลขสถิติ / ยอดเงิน -->
<span className="font-mono font-bold text-2xl sm:text-3xl text-slate-900 tracking-tight">
  ฿3,260.00
</span>

<!-- เนื้อหาคำอธิบายภาษาไทย -->
<p className="font-sans text-sm sm:text-base text-slate-600 leading-relaxed">
  เชื่อมต่อ LINE OA ของคุณ ให้ระบบ DealMee ช่วยปิดการขายและตรวจสลิปอัตโนมัติ
</p>
```

---

## 4. มาตรฐานคอมโพเนนต์และการโต้ตอบ (UI Component Architecture)

### 4.1 ปุ่มคำสั่ง (Action Buttons)
* **Primary CTA (ปุ่มหลัก)**:
  - สีพื้น: `bg-electric-blue` (`#2E5BFF`)
  - ข้อความ: `text-white font-semibold`
  - ขอบมน: `rounded-xl` (12px)
  - เงา: `shadow-md shadow-electric-blue/20`
  - การโต้ตอบ: `hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150`
* **Outline / Secondary (ปุ่มรอง)**:
  - ขอบ: `border border-outline-variant bg-surface hover:bg-surface-container`
  - ข้อความ: `text-on-surface font-semibold`

### 4.2 ป้ายสถานะออเดอร์ (Order Status Badges)
ตารางรูปแบบ Badge ที่ใช้ในหน้า [OrdersManager.tsx](file:///c:/Users/Jack/Documents/botify-saas-web/src/app/dashboard/orders/OrdersManager.tsx):
```tsx
// ชำระเงินแล้ว (Paid)
<span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
  ชำระเงินแล้ว
</span>

// รอชำระเงิน (Pending)
<span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
  รอชำระเงิน
</span>

// จัดส่งแล้ว (Shipped)
<span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
  จัดส่งแล้ว
</span>

// ยกเลิกแล้ว (Cancelled)
<span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
  ยกเลิกแล้ว
</span>
```

### 4.3 การ์ดและกล่องข้อมูล (Cards & Bento Grid)
* รัศมีความโค้ง: `rounded-2xl` (16px)
* กรอบเส้นบาง: `border border-outline-variant/40`
* พื้นหลัง: `bg-surface` (ขาวบริสุทธิ์ `#FFFFFF`)
* ความลึกเงา: `shadow-sm hover:shadow-md transition-shadow`

---

## 5. ความสอดคล้องกับ LINE Flex Messages (Chat UX Synchronization)

เมื่อบอท DealMee ส่งการ์ดใบเสนอราคา (Quotation) หรือข้อความสรุปออเดอร์เข้า LINE แชทของลูกค้า ให้ใช้โทนสีที่สอดคล้องกับแบรนด์:
- **Header Card**: สีน้ำเงินกรมท่า `#060C1B` หรือ Electric Blue `#2E5BFF`
- **ยอดเงินรวมสุทธิ**: สีน้ำเงิน `#2E5BFF` ตัวหนา ขนาดใหญ่
- **ปุ่มเปิดดูใบเสนอราคา / แนบสลิป**: ปุ่มสไตล์ Primary สี `#2E5BFF`
- **ป้ายอนุมัติชำระเงิน**: สีเขียว Emerald `#10B981`
