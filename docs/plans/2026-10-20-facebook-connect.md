# แผน: ปุ่ม "เชื่อมเพจด้วย Facebook" (Messenger สำหรับลูกค้าทุกคน)

ทำ 20 ต.ค. 2569 · สถานะ: งานโค้ดข้อ 1–5 และ 7 ทำใน #73 · ข้อ 6 ทำบางส่วน (ปุ่มเชื่อม/ตัดการเชื่อมอยู่บนสุดของการ์ด Facebook ช่องกรอกแบบเดิมยังอยู่ด้านล่าง) · ข้อ 8 รอ App Review
ขั้นตอนฝั่ง Meta เขียนจาก `docs/FACEBOOK_APP_REVIEW_GUIDE.md` และความรู้ทั่วไป ต้องเช็คกับหน้า Meta for Developers อีกครั้งตอนลงมือ เพราะชื่อสิทธิ์และเงื่อนไขเปลี่ยนบ่อย

## ปัญหาตอนนี้
แต่ละร้านสร้าง Meta App ของตัวเองแล้ววาง Page Access Token (หน้าช่องทางแชท) แอปเหล่านี้อยู่ใน Development Mode
บอทจึงตอบได้เฉพาะแอดมินและผู้ทดสอบของแอป ลูกค้าทั่วไปที่ทักเพจไม่ได้คำตอบ
การเปิด Live Mode ต้องขอ `pages_messaging` แบบ Advanced Access ผ่าน App Review ร้านเล็กทำเองแทบไม่ได้
ตั้งแต่ #72 หน้าตั้งค่าติดป้าย Messenger ว่า "ทดลอง" และคลังความรู้บอกตรง ๆ

## เป้าหมาย
ใช้ Meta App ตัวเดียวของ DealMee ที่ผ่าน App Review แล้ว ร้านกดปุ่ม "เชื่อมเพจด้วย Facebook" ล็อกอิน เลือกเพจ จบ ไม่ต้องสร้างแอป ไม่ต้องคัดลอก token

## ฝั่งเจ้าของ (ทำคู่ขนานได้ตั้งแต่วันนี้ ส่วนที่นานที่สุด)
1. สร้างหรือใช้ Meta Business Portfolio ของ DealMee และยื่น Business Verification (เอกสารทะเบียนพาณิชย์หรือหนังสือรับรองบริษัท ชื่อและที่อยู่ต้องตรงกับเอกสาร)
2. สร้างแอปประเภท Business ชื่อ DealMee ผูกกับ Business Portfolio นั้น
3. ตั้งค่าแอป: ไอคอน, Privacy Policy URL (`https://dealmee.app/privacy`), Terms URL (`https://dealmee.app/terms`), Data Deletion URL (จะได้จากงานโค้ดข้อ 5), หมวด Business and Pages
4. หลังงานโค้ดเสร็จ: อัดวิดีโอสาธิตตามคู่มือ App Review แล้วยื่นขอสิทธิ์

สิทธิ์ที่น่าจะต้องขอ (ยืนยันอีกครั้งตอนยื่น): `pages_messaging`, `pages_show_list`, `pages_manage_metadata` (สมัครรับ webhook ของเพจ), `pages_read_engagement`, และ `business_management` ถ้าเพจอยู่ใน Business Portfolio

## งานโค้ด (แยก PR)
1. **ตั้งค่าแอปกลาง**: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_WEBHOOK_VERIFY_TOKEN` ในหน้า Super Admin (platformSecrets) ไม่ต้องใส่ใน Vercel
2. **OAuth**: ปุ่มในหน้าช่องทางแชท → Facebook Login (state ผูกกับร้าน กัน CSRF) → callback แลก code เป็น user token แบบ long-lived → ดึงรายการเพจ (`/me/accounts`) ให้ร้านเลือก → เก็บ page token แบบเข้ารหัส (แบบเดียวกับ `shop_ai_keys`) และ page id
3. **สมัครรับข้อความของเพจ**: `POST /{page-id}/subscribed_apps` (messages, messaging_postbacks) ตอนเชื่อม และยกเลิกตอนร้านกดตัดการเชื่อม
4. **Webhook กลางอันเดียว**: `/api/webhook/facebook` รับทุกเพจ ตรวจลายเซ็นด้วย App Secret กลาง แล้วหาร้านจาก page id (`entry[].id`) ใช้ตัวประมวลผลเดิมของ `/api/webhook/facebook/[shop_id]` ต่อ · route เดิมแบบต่อร้านยังเปิดไว้ให้ร้านที่ตั้งแบบเก่า
5. **Data deletion / deauthorize callback** ที่ Meta บังคับ: ลบ token และตัดการเชื่อมเพจของร้านนั้น
6. **หน้าตั้งค่า**: เปลี่ยนการ์ด Facebook เป็นปุ่มเชื่อม + แสดงเพจที่เชื่อมอยู่ + ปุ่มตัดการเชื่อม · ย้ายช่องวาง token แบบเดิมไปไว้ในส่วน "ขั้นสูง"
7. **ตรวจเพจซ้ำ** ใช้ `facebookPageUsedByOtherShop` จาก #71 ตอนเลือกเพจ
8. เอาป้าย "ทดลอง" ออก อัปเดตคลังความรู้ หน้าคู่มือ และหน้า landing

## ที่ทำแล้วใน #73
- ตั้งค่าใน Super Admin → ตั้งค่าระบบ กลุ่ม Facebook: App ID, App Secret, Login for Business Configuration ID (ถ้ามี), Webhook Verify Token · ปุ่มเชื่อมจะโผล่ในหน้าร้านเมื่อมี App ID และ App Secret
- `/api/facebook/connect` → Facebook Login → `/api/facebook/callback` (เก็บ user token แบบ long-lived ในคุกกี้เข้ารหัส 15 นาที) → ร้านเลือกเพจในการ์ด → สมัครรับข้อความ (`subscribed_apps`) แล้วบันทึก page token
- Webhook กลาง `/api/webhook/facebook` (ตรวจลายเซ็นด้วย App Secret ทุกครั้ง หาร้านจาก page id) ใช้ตัวประมวลผลเดียวกับ route เดิม (`src/lib/facebook/processMessengerEntries.ts`)
- Data Deletion callback `/api/facebook/data-deletion` (Deauthorize ใช้ URL เดียวกันต่อท้าย `?deauthorize=1`) และหน้าสถานะ `/facebook/data-deletion`
- page token ยังเก็บใน `shops.facebook_page_token` แบบเดิม (ยังไม่เข้ารหัส เหมือน LINE token) เพราะหลายจุดอ่านคอลัมน์นี้อยู่ ควรแยกเป็นงานเข้ารหัส token ทั้งหมดพร้อมกัน

URL ที่ต้องใส่ในแอป Meta (ใช้โดเมนที่ร้านใช้เข้าหลังบ้าน ถ้าใช้หลายโดเมนให้ใส่ครบ):
- Valid OAuth Redirect URIs: `https://www.dealmee.app/api/facebook/callback` (และ `https://app.dealmee.app/api/facebook/callback`)
- Webhooks → Page → Callback URL: `https://www.dealmee.app/api/webhook/facebook` + Verify Token ที่ตั้งในหน้า Super Admin · เลือก messages, messaging_postbacks
- Data Deletion Request URL: `https://www.dealmee.app/api/facebook/data-deletion`
- Deauthorize Callback URL: `https://www.dealmee.app/api/facebook/data-deletion?deauthorize=1`

## ลำดับ
ยื่น Business Verification ก่อน → งานโค้ดข้อ 1–7 ทดสอบกับเพจของตัวเองใน Development Mode → อัดวิดีโอ ยื่น App Review → ผ่านแล้วเปิด Live Mode → ข้อ 8

## ความเสี่ยง
- Meta อาจขอเอกสารเพิ่มหรือปฏิเสธรอบแรก ต้องแก้แล้วยื่นใหม่ เวลารอไม่แน่นอน
- Instagram DM ใช้แอปเดียวกันได้ แต่ต้องขอสิทธิ์ instagram_* เพิ่ม แนะนำแยกเป็นรอบถัดไป
