# คู่มือการขออนุมัติ Meta App Review (Facebook Messenger Chatbot)
**DealMee Omnichannel AI Commerce Platform**

เอกสารฉบับนี้รวบรวมขั้นตอน แนวทางปฏิบัติ และสคริปต์ภาษาอังกฤษที่จำเป็นสำหรับการส่ง **App Review** กับทาง Meta (Facebook) เพื่อเปิดใช้งานแชทบอทบนเพจจริงแบบ **Live Mode (สาธารณะ)** ให้ลูกค้าทุกคนทักเข้ามาแล้ว AI ตอบได้ตลอด 24 ชั่วโมง

---

## 📌 สารบัญ (Table of Contents)
1. [ความเข้าใจพื้นฐาน: Dev Mode vs Live Mode](#1-ความเข้าใจพื้นฐาน-dev-mode-vs-live-mode)
2. [Step 1: ตั้งค่าข้อมูลพื้นฐานของแอป (ทำได้ทันที ไม่ต้องใช้เอกสาร)](#2-step-1-ตั้งค่าข้อมูลพื้นฐานของแอป)
3. [Step 2: สิทธิ์ที่ต้องขออนุมัติ (Permissions & Features)](#3-step-2-สิทธิ์ที่ต้องขออนุมัติ-permissions--features)
4. [Step 3: เตรียมคลิปวิดีโอสาธิต (Screencast Walkthrough)](#4-step-3-เตรียมคลิปวิดีโอสาธิต-screencast-walkthrough)
5. [Step 4: สคริปต์ตอบคำถามสำหรับส่งตรวจ (Copy & Paste)](#5-step-4-สคริปต์ตอบคำถามสำหรับส่งตรวจ-copy--paste)
6. [Step 5: การยืนยันตัวตนธุรกิจ (Business Verification)](#6-step-5-การยืนยันตัวตนธุรกิจ-business-verification)
7. [💡 ทางลัด: การเปิดให้คนอื่นทดสอบทันทีโดยไม่ต้องรอตรวจ (Roles & Testers)](#7--ทางลัด-การเปิดให้คนอื่นทดสอบทันทีโดยไม่ต้องรอตรวจ)

---

## 1. ความเข้าใจพื้นฐาน: Dev Mode vs Live Mode

* **Development Mode (สถานะเริ่มต้น):**
  * บอทสามารถคุยได้เฉพาะกับคนที่อยู่ในทีมแอป เช่น แอดมินเพจ (Page Admin), แอดมินแอป (App Admin), Developers และ **Testers (ผู้ทดสอบ)** ที่เราเพิ่มรายชื่อไว้
  * เหมาะสำหรับการพัฒนาและทดสอบระบบภายใน
* **Live Mode (เปิดใช้งานสาธารณะ):**
  * **ลูกค้าทุกคนบน Facebook** สามารถทักเพจเข้ามาแล้วบอท AI จะตอบกลับทันที
  * ต้องขออนุมัติสิทธิ์ **`pages_messaging`** ในระดับ **Advanced Access** ผ่านการทำ App Review

---

## 2. Step 1: ตั้งค่าข้อมูลพื้นฐานของแอป
> *ส่วนนี้สามารถทำได้ทันที ไม่จำเป็นต้องมีทะเบียนพาณิชย์หรือเอกสารใดๆ*

1. เข้าไปที่ [Meta for Developers](https://developers.facebook.com/apps/) ➡️ เลือกแอปของคุณ
2. ที่เมนูด้านซ้าย เลือก **App settings (การตั้งค่าแอป)** ➡️ **Basic (พื้นฐาน)**:
   * **Display Name:** ใส่ชื่อแอปของคุณ (เช่น `DealMee Assistant` หรือชื่อร้านค้า)
   * **App Icon (ไอคอนแอป):** อัปโหลดรูปสี่เหลี่ยมจัตุรัส ขนาด `1024 x 1024 px` (ไฟล์ `.png` พื้นหลังทึบ ห้ามมีขอบโปร่งใส)
   * **Category (หมวดหมู่):** เลือก **Business and Pages** หรือ **Messenger**
   * **Privacy Policy URL (นโยบายความเป็นส่วนตัว):** 
     ```text
     https://<โดเมนของคุณ>/privacy
     ```
     *(ตัวอย่าง: https://dealmee.com/privacy — ระบบ DealMee มีหน้านี้เตรียมไว้ให้แล้ว)*
   * **Terms of Service URL (ข้อกำหนดการใช้งาน):**
     ```text
     https://<โดเมนของคุณ>/terms
     ```
   * **User Data Deletion (คำขอลบข้อมูล):** ใส่ URL เดียวกับ Privacy Policy หรือหน้าติดต่อแอดมิน
3. กดปุ่ม **Save changes (บันทึกการเปลี่ยนแปลง)** ที่ด้านล่าง

---

## 3. Step 2: สิทธิ์ที่ต้องขออนุมัติ (Permissions & Features)

1. ที่เมนูด้านซ้าย เลือก **App Review** ➡️ **Permissions and Features**
2. ค้นหาคำว่า: **`pages_messaging`**
3. กดปุ่ม **Request Advanced Access (ขอการเข้าถึงขั้นสูง)**
   * สิทธิ์นี้คือหัวใจหลักที่อนุญาตให้บอท:
     * รับข้อความเข้าจากลูกค้า
     * ส่งข้อความตอบกลับอัตโนมัติ
     * ส่งการ์ดสินค้า (Product Carousel) พร้อมรูปภาพและราคา
     * ส่งรูปภาพ QR PromptPay สำหรับชำระเงิน

---

## 4. Step 3: เตรียมคลิปวิดีโอสาธิต (Screencast Walkthrough)

Meta **บังคับให้อัปโหลดวิดีโอความยาว 2 - 3 นาที** เพื่อพิสูจน์ว่าแอปทำงานได้จริงและปลอดภัยต่อผู้ใช้งาน โดยแนะนำให้บันทึกหน้าจอตามลำดับดังนี้:

| นาทีที่ | สิ่งที่ต้องโชว์ในวิดีโอ | คำอธิบาย |
| :--- | :--- | :--- |
| **0:00 - 0:30** | หน้าแดชบอร์ด DealMee | โชว์หน้าระบบร้านค้า, คลังสินค้า [Products](/dashboard/products) ที่มีเสื้อผ้า/สินค้าพร้อมรูปภาพ และหน้าตั้งค่าบอท |
| **0:30 - 1:15** | หน้า Facebook Messenger | เปิดแชทกับเพจจริง แล้วพิมพ์ทักทาย เช่น *"สวัสดีครับ"* ➡️ ให้เห็นบอท AI แนะนำตัวทันที |
| **1:15 - 1:50** | โชว์การ์ดสินค้า (Carousel) | พิมพ์สอบถามสินค้า เช่น *"ขอดูเสื้อผ้าหน่อยครับ"* ➡️ ให้เห็นบอทส่งการ์ดสินค้าแบบสไลด์ มีรูปภาพ ราคา ป้ายสต็อกครบถ้วน |
| **1:50 - 2:20** | กดสั่งซื้อและปิดการขาย | กดปุ่ม **"🛒 สั่งซื้อสินค้านี้"** ➡️ บอท AI รับคำสั่งซื้อและสรุปยอดให้ |
| **2:20 - 2:45** | หน้ากล่องข้อความรวม (Unified Inbox) | สลับกลับมาที่หน้าเว็บแดชบอร์ด DealMee [Inbox](/dashboard/inbox) ➡️ โชว์ว่าแชทจาก Messenger ซิงค์เข้ามาที่ระบบหลังบ้านจริง |

*(คำแนะนำ: บันทึกเป็นไฟล์ `.mp4` ความละเอียด 1080p เสียงหรือคำบรรยายเป็นภาษาอังกฤษหรือมีคำอธิบายบนหน้าจอชัดเจน)*

---

## 5. Step 4: สคริปต์ตอบคำถามสำหรับส่งตรวจ (Copy & Paste)

เมื่อกดส่งตรวจในหน้า App Review ระบบจะมีแบบฟอร์มให้กรอก สามารถคัดลอกข้อความภาษาอังกฤษด้านล่างนี้ไปวางได้ทันทีครับ:

### คำถามที่ 1: How is your app using pages_messaging?
*(อธิบายการใช้งานสิทธิ์ pages_messaging)*
```text
Our application (DealMee) is an AI-powered conversational commerce and CRM assistant designed for Facebook Pages. 

We use the `pages_messaging` permission to:
1. Automatically answer customer inquiries 24/7 regarding products, stock availability, and shop information.
2. Deliver rich interactive product carousels (Generic Templates) containing product photos, prices, inventory status, and instant order buttons.
3. Facilitate seamless order placement and payment coordination (such as generating PromptPay payment QR codes).
4. Synchronize customer conversations with the merchant's unified web dashboard so human staff can monitor and take over conversations when necessary.
```

### คำถามที่ 2: Step-by-step instructions for the reviewer to test
*(ขั้นตอนให้เจ้าหน้าที่ของ Meta ทดสอบ)*
```text
Please follow these steps to test our application:

1. Visit our test Facebook Page: [ใส่ลิงก์เพจของคุณ เช่น https://www.facebook.com/your-page-url]
2. Click the "Send Message" button to initiate a chat via Messenger.
3. Send: "สวัสดีครับ" (The AI chatbot will greet the user and offer shop assistance).
4. Send: "ขอดูเสื้อผ้าหน่อยครับ" or "ขอดูสินค้าหน่อย" (The bot will query our product inventory and send an interactive carousel displaying product photos, pricing, stock badges, and an order button).
5. Click the button: "🛒 สั่งซื้อสินค้านี้" on any product card (The bot will process the postback event, summarize the order details, and guide the customer through the checkout flow).
```

---

## 6. Step 5: การยืนยันตัวตนธุรกิจ (Business Verification)

Meta กำหนดให้มีการยืนยันตัวตนก่อนเปิดใช้งาน Live Mode เต็มรูปแบบ โดยมี **3 ทางเลือก** ตามความสะดวกของร้านค้า:

### ทางเลือกที่ 1: ยืนยันตัวตนแบบบุคคลธรรมดา (Individual Verification)
* หากยังไม่ได้จดทะเบียนพาณิชย์ ในหน้า Meta Business Suite มักจะมีตัวเลือกให้ยืนยันตัวตนของ Developer/เจ้าของธุรกิจด้วย **บัตรประจำตัวประชาชน (National ID Card)** หรือ **หนังสือเดินทาง (Passport)**
* สะดวกที่สุดสำหรับนักพัฒนาหรือผู้เริ่มต้น

### ทางเลือกที่ 2: จดทะเบียนพาณิชย์บุคคลธรรมดา (แนะนำมาก สะดวกรวดเร็ว)
* สำหรับร้านค้าออนไลน์ สามารถไปจด **ทะเบียนพาณิชย์ (ร้านค้าบุคคลธรรมดา / พาณิชย์อิเล็กทรอนิกส์)** ได้ที่:
  * ในกทม.: ฝ่ายปกครอง สำนักงานเขตทุกเขต
  * ต่างจังหวัด: สำนักงานเทศบาล หรือ อบต. ที่ตั้งร้าน
* **ระยะเวลา:** ทำเสร็จภายใน 30 - 60 นาที ได้รับเอกสารทันที
* **ค่าธรรมเนียม:** เพียง **50 บาท**
* นำเอกสารใบทะเบียนพาณิชย์มายื่นใน Meta Business Suite ตรวจผ่านง่ายและมีความน่าเชื่อถือสูงมาก

### ทางเลือกที่ 3: นิติบุคคล (บริษัทจำกัด / ห้างหุ้นส่วนจำกัด)
* ใช้ **หนังสือรับรองนิติบุคคล (คัดไม่เกิน 3 เดือน)** และ **ภ.พ.20**
* มีบิลค่าน้ำ ค่าไฟ หรือ Statement ธนาคารในชื่อบริษัทประกอบ

---

## 7. 💡 ทางลัด: การเปิดให้คนอื่นทดสอบทันทีโดยไม่ต้องรอตรวจ

ระหว่างที่กำลังพัฒนาหรือยังไม่ได้ส่งตรวจ คุณสามารถเปิดให้เพื่อน ทีมงาน หรือลูกค้ากลุ่มทดสอบคุยกับบอทบนเพจได้ทันที:

1. ไปที่ [Meta for Developers](https://developers.facebook.com/apps/) ➡️ เลือกแอป
2. เมนูซ้ายมือ เลือก **App roles (บทบาทของแอป)** ➡️ **Roles (บทบาท)**
3. เลื่อนลงมาที่หัวข้อ **Testers (ผู้ทดสอบ)** กดปุ่ม **Add Testers (เพิ่มผู้ทดสอบ)**
4. ใส่ชื่อบัญชี Facebook หรือ Facebook Profile ID ของผู้ที่จะทดสอบ
5. ให้บุคคลนั้นเปิดเบราว์เซอร์แล้วเข้าไปที่:
   ```text
   https://www.facebook.com/developers/requests
   ```
   แล้วกด **Accept (ยอมรับ)**
6. **ผลลัพธ์:** บุคคลนั้นจะสามารถทักแชทคุยกับบอทบนเพจของคุณได้เหมือนระบบ Live 100% ทันที โดยไม่ต้องรอการอนุมัติจาก Meta เลยครับ!
