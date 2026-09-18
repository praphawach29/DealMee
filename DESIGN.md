---
name: DealMee AI Design System
brand: DealMee AI (DealMee.app)
version: "2.0.0"
updated: "2026-09-18"
colors:
  primary: "#2E5BFF"
  primary_hover: "#1F48E0"
  primary_glow: "rgba(46, 91, 255, 0.25)"
  secondary_cyan: "#00CFEC"
  secondary_indigo: "#1A1B4B"
  canvas_light: "#F8FAFC"
  canvas_dark: "#060C1B"
  surface_card: "#FFFFFF"
  surface_card_dark: "#0F172A"
  border_light: "#E2E1EF"
  border_dark: "#1E293B"
  status_success: "#10B981"
  status_warning: "#F59E0B"
  status_error: "#EF4444"
  status_info: "#3B82F6"
typography:
  display: "IBM Plex Sans Thai, sans-serif"
  body: "IBM Plex Sans Thai, sans-serif"
  numerical_mono: "Geist Mono, monospace"
---

# DealMee AI — Permanent Design System & Brand Identity

> **Single Source of Truth:** เอกสารนี้คือมาตรฐานการออกแบบถาวร (Permanent Design Guidelines) สำหรับทุกส่วนของ **DealMee AI (DealMee.app)** ทั้ง Landing Page, Merchant Dashboard, Admin Console และ LINE Flex Message Templates

---

## 1. ปรัชญาการออกแบบและจิตวิทยาแบรนด์ (Design Philosophy & Brand Psychology)

DealMee AI เป็นระบบผู้ช่วยขายอัจฉริยะ (Conversational AI Sales Copilot) ที่ดูแลเรื่อง **การสนทนา, การปิดการขาย, การออกใบเสนอราคา, การคำนวณค่าส่ง และการตรวจสอบสลิปโอนเงินธนาคาร**

ความรู้สึกหลักที่ผู้ใช้ (เจ้าของร้านค้าและลูกค้า) ต้องสัมผัสได้คือ:
1. **ความน่าเชื่อถือและความปลอดภัยสูง (Financial Trust & Enterprise Security)** — เงินและสลิปต้องถูกต้อง 100% จึงใช้ **Electric Blue** เป็นแกนหลัก
2. **ความล้ำสมัยที่ไม่ซับซ้อน (Cutting-Edge AI Simplicity)** — โดดเด่นด้วยแสงเงาและสำเนียง **Cyber Cyan** บนพื้นหลัง **Cosmic Navy**
3. **ความสบายตาสำหรับการทำงานจริง (Zero Eye Fatigue)** — หน้า Dashboard ใช้ **Merchant Canvas (`#F8FAFC`)** พร้อมขอบ hairline บางเฉียบ (`#E2E1EF`) แทนการใช้สีขาวจ้าล้วน
4. **ความกลมกลืนกับ LINE Ecosystem** — สร้างความแตกต่างชัดเจนจาก LINE (สีเขียว) โดย DealMee จะเป็น "สมอง AI อัจฉริยะสีน้ำเงิน-ฟ้า" ที่ช่วยขับเคลื่อน LINE OA ของร้านค้า

---

## 2. จานสีและโทนสีมาตรฐาน (Calibrated Color Palette)

### 2.1 Primary & Brand Identity
| สี | HEX | HSL | Tailwind Variable | การใช้งาน |
| :--- | :--- | :--- | :--- | :--- |
| **Electric Blue** | `#2E5BFF` | `227°, 100%, 59%` | `var(--color-electric-blue)` / `bg-electric-blue` | สีหลักของแบรนด์, Primary CTA Button, Active Menu Pill, Focus Rings |
| **Electric Blue Hover** | `#1F48E0` | `227°, 76%, 50%` | `hover:bg-primary` | สถานะ Hover ของปุ่มหลัก |
| **Cyber Cyan** | `#00CFEC` | `187°, 100%, 46%` | `text-cyan-400` / `from-cyan-400` | ไฮไลต์เทคโนโลยี AI, ป้ายกำกับ AI Agent, Gradient Hero Headline |
| **Deep Indigo / Navy** | `#1A1B4B` | `239°, 48%, 20%` | `var(--color-deep-indigo)` | หัวข้อ Editorial, Secondary Badge, ฐานความลึกของเลย์เอาต์ |

### 2.2 Surfaces & Canvas (ความลึกพื้นผิว)
| ชั้นพื้นผิว | โหมดสว่าง (Light) | โหมดมืด (Dark / Hero) | การใช้งาน |
| :--- | :--- | :--- | :--- |
| **Canvas (Level 0)** | `#F8FAFC` (Slate-50) | `#060C1B` (Cosmic Navy) | พื้นหลังหลักของหน้าเว็บและ Dashboard |
| **Card Surface (Level 1)** | `#FFFFFF` (Pure White) | `#0F172A` (Slate-900) | การ์ดข้อมูล, Bento Grid, ตาราง, กล่องฟอร์ม |
| **Elevated Surface (Level 2)** | `#F1F5F9` (Slate-100) | `#1E293B` (Slate-800) | Dropdown, Modal, Hover State, Tooltip |
| **Borders & Dividers** | `#E2E1EF` (Alpha 0.4) | `#1E293B` (Alpha 0.6) | เส้นแบ่งคอลัมน์, เส้นกรอบการ์ดบาง 1px |

### 2.3 Semantic & Transaction Status (สถานะธุรกรรมและการเงิน)
| สถานะ | HEX | Badge Styling (Light Mode) | การใช้งาน |
| :--- | :--- | :--- | :--- |
| **ชำระเงินแล้ว (Paid)** | `#10B981` | `bg-emerald-50 text-emerald-700 border-emerald-200` | สลิปถูกต้อง, ออเดอร์สำเร็จ, AI ตอบสดปกติ |
| **รอชำระเงิน (Pending)** | `#F59E0B` | `bg-amber-50 text-amber-700 border-amber-200` | รอลูกค้าโอน, รอตรวจสอบ, สลิปอยู่ระหว่างตรวจ |
| **จัดส่งแล้ว (Shipped)** | `#3B82F6` | `bg-blue-50 text-blue-700 border-blue-200` | มีเลขพัสดุ Tracking, ส่งสินค้าแล้ว |
| **ยกเลิก / ไม่ผ่าน (Failed)** | `#EF4444` | `bg-rose-50 text-rose-700 border-rose-200` | สลิปปลอม, สลิปซ้ำ, ยกเลิกออเดอร์, Error |

---

## 3. ระบบตัวอักษรและภาษาไทย (Typography Architecture)

### 3.1 ฟอนต์มาตรฐาน
* **ฟอนต์หลัก (Display & Body)**: **`IBM Plex Sans Thai`**
  - ออกแบบมาเพื่อหน้าจอดิจิทัลโดยเฉพาะ
  - รูปทรงกึ่งทางการ ไร้หัว (Loopless hybrid) ทันสมัยแบบ Tech & SaaS
  - แก้ปัญหาวรรณยุกต์ซ้อน (สระอุ สระอู ไม้เอก ไม้โท) ไม่ให้ตกขอบหรือเบียดเส้นบรรทัด
* **ฟอนต์ตัวเลขและข้อมูลทางบัญชี (Monospace & Numerics)**: **`Geist Mono`**
  - ใช้สำหรับ: ตัวเลขราคา (`฿3,260.00`), รหัสออเดอร์ (`ORD-509098`), Tracking No., API Token, วันที่และเวลา

### 3.2 สัดส่วนขนาดและระยะห่าง (Type Scale & Spacing)
```css
/* กฎระยะบรรทัดภาษาไทยที่ถูกต้อง (ป้องกันสระทับกัน) */
body {
  line-height: 1.65;
  word-break: break-word;
  overflow-wrap: break-word;
}

/* ขนาดหัวข้อ */
h1 { font-size: 2.25rem; sm: 3rem; font-weight: 700; line-height: 1.25; letter-spacing: -0.02em; }
h2 { font-size: 1.5rem; sm: 1.875rem; font-weight: 700; line-height: 1.35; letter-spacing: -0.01em; }
h3 { font-size: 1.125rem; sm: 1.25rem; font-weight: 600; line-height: 1.4; }
body { font-size: 0.875rem; sm: 1rem; font-weight: 400; line-height: 1.65; }
caption { font-size: 0.75rem; font-weight: 500; color: #64748B; }
```

---

## 4. มาตรฐานคอมโพเนนต์ (Component Standards)

### 4.1 ปุ่ม (Buttons)
* **Primary Button**:
  ```html
  <button className="bg-electric-blue hover:bg-primary text-white font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-electric-blue/20 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer">
  ```
* **Secondary / Outline Button**:
  ```html
  <button className="border border-outline-variant bg-surface hover:bg-surface-container text-on-surface font-semibold px-4 py-2.5 rounded-xl transition-all">
  ```
* **Destructive Button**:
  ```html
  <button className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-semibold px-4 py-2 rounded-xl transition-all">
  ```

### 4.2 การ์ดและ Bento Grid (Cards)
* ขอบมน: `rounded-2xl` (16px)
* กรอบเส้นบาง: `border border-outline-variant/40`
* เงาเบาละมุน: `shadow-sm hover:shadow-md transition-shadow duration-200`
* Padding: มือถือ `p-4`, เดสก์ท็อป `p-6`

### 4.3 แถบเมนูด้านข้าง (Sidebar Navigation)
* พื้นหลังสีขาวบริสุทธิ์ (`#FFFFFF`) แยกจากหน้าจอด้วยเส้นบาง 1px
* เมนูที่เลือก (Active State): ใช้รูปทรง Pill สีน้ำเงิน `bg-electric-blue text-white font-bold shadow-sm shadow-electric-blue/25`
* เมนูปกติ (Inactive State): ตัวหนังสือสีเทา `text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface`

---

## 5. กฎเหล็กและข้อห้าม (Do's & Don'ts)

| สิ่งที่ต้องทำ (Do) | สิ่งที่ห้ามทำเด็ดขาด (Don't) |
| :--- | :--- |
| ✅ ใช้ **Electric Blue (`#2E5BFF`)** เป็นสีหลักทุกครั้งที่ต้องการให้คลิกหรือบันทึก | ❌ ห้ามใช้สีม่วงนีออนสะท้อนแสงจัดๆ หรือสาดแสง Glow มั่วซั่วสไตล์ AI สำเร็จรูป |
| ✅ ใช้ **Geist Mono** สำหรับรหัสออเดอร์ ยอดเงิน และเวลา เพื่อความตรงแนวของหลักตัวเลข | ❌ ห้ามใช้ฟอนต์ Serif (มีเชิง) ในหน้า Dashboard หรือเอกสารทางบัญชี |
| ✅ ใช้สีเขียว **Emerald (`#10B981`)** สำหรับสถานะผ่าน/สำเร็จ | ❌ ห้ามใช้สีเขียวสดของ LINE (`#06C755`) เป็นสีหลักทั้งหน้าจอ เพื่อป้องกันความสับสน |
| ✅ ให้ความสำคัญกับ Padding และ Line-height ภาษาไทยเสมอ (`leading-relaxed`) | ❌ ห้ามใช้ข้อความภาษาไทยที่มีระยะบรรทัดแน่นเกินไป (`leading-none`) จนสระทับกัน |
| ✅ ทุกปุ่มและจุดคลิกต้องมี Hover Feedback และตัวบ่งชี้การโหลด (`animate-spin`) | ❌ ห้ามทำปุ่มที่กดแล้วนิ่งเงียบไม่มีสถานะ Loading หรือข้อความตอบรับ |
