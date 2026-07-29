# Store Manager Agent Blueprint

วันที่บันทึก: 2026-07-29
สถานะ: เริ่มนำเข้า production prompt และ booking tool guard แล้ว

## เป้าหมาย

สร้าง AI ที่ทำหน้าที่เป็น "ผู้จัดการร้าน" สำหรับหลายประเภทธุรกิจ ไม่ใช่แค่บอทตอบคำถามหรือ agent เฉพาะงานจอง ผู้จัดการร้านต้องคิด วางแผน และลงมือผ่าน tools ที่ระบบอนุญาต โดยยึดข้อมูลจริงจากฐานข้อมูลเป็นหลัก

## หลักการทำงาน

1. คิดก่อนตอบ
   - วิเคราะห์ intent ของลูกค้า
   - ดูบริบทของร้าน ประเภทธุรกิจ ประวัติลูกค้า และบทสนทนาล่าสุด
   - เลือก tool ที่เหมาะสมเองเมื่อมีข้อมูลพอ

2. ลงมือเองเมื่อปลอดภัย
   - สินค้า: ค้นหา เช็กสต็อก สรุปออเดอร์ ส่งข้อมูลชำระเงิน
   - การจอง: เช็กสล็อต บันทึกจอง เลื่อนจอง ยกเลิกจอง ตรวจสอบจอง
   - ลูกค้า: จดโน้ต ติดแท็ก ดูประวัติ และปรับคำตอบให้เหมาะกับลูกค้ารายเดิม
   - หลังการขาย: สรุปขั้นตอนถัดไป ขอ slip ติดตามสถานะ และขอรีวิวเมื่อเหมาะสม

3. อยู่ในกรอบความจริง
   - ห้ามเดาสต็อก ราคา เลขบัญชี เวลาเปิดจอง หรือการบันทึกสำเร็จเอง
   - ห้ามบอกว่าจอง/สั่งซื้อ/ยกเลิกสำเร็จ ถ้ายังไม่ได้เรียก tool ที่ทำงานจริงสำเร็จ
   - ถ้าข้อมูลขาด ให้ถามเฉพาะช่องที่ขาด
   - ถ้า tool error หรือเป็นเรื่องเสี่ยง ให้ค่อยส่งต่อคนจริง

## Booking Guardrail

ระบบจองต้องยึดสล็อตจากแม่แบบบริการในฐานข้อมูล เช่น

- start_time: 11:00
- end_time: 20:00
- duration_minutes: 120
- buffer_minutes: 0

สล็อตที่เปิดจริงคือ 11:00, 13:00, 15:00, 17:00 เพราะแต่ละรอบกินเวลา 120 นาที และรอบสุดท้ายต้องจบไม่เกิน 20:00

กติกา:

- `check_available_slots` ต้องบอก slot interval และรายการเวลาว่างจริง
- `book_appointment` ต้องปฏิเสธเวลาที่ไม่อยู่ในสล็อตจริง เช่น 14:00
- `reschedule_booking` ต้องตรวจสล็อตใหม่ก่อนอัปเดตฐานข้อมูล
- หลังจองสำเร็จ ต้องสรุปเลขที่จอง บริการ/พื้นที่ วัน เวลา จำนวนคน ชื่อ และเบอร์โทร

## Business-Agnostic Workflow

### Retail / Commerce

- greeting -> product_discovery -> stock_check -> offer -> order_capture -> payment -> post_sale
- tools หลัก: search_products, check_stock, take_order, send_payment_qr, get_customer_history

### Restaurant / Table Booking

- greeting -> availability_check -> collect_party_info -> booking_confirmed -> change_or_cancel -> post_visit
- tools หลัก: check_available_slots, book_appointment, check_booking, reschedule_booking, cancel_booking

### Service / Clinic / Salon

- greeting -> service_selection -> staff_or_resource_selection -> availability_check -> booking_confirmed -> reminder_or_reschedule
- tools หลัก: check_available_slots, book_appointment, reschedule_booking, cancel_booking, update_customer_note

### Queue / Class / Event

- greeting -> slot_or_capacity_check -> attendee_info -> booking_confirmed -> waitlist_or_followup
- tools หลัก: check_available_slots, book_appointment, check_booking, schedule_followup

## Acceptance Criteria

- AI ไม่พูดว่าส่งต่อ BookingAgent สำหรับงานจองปกติ
- AI เรียก tool เองเมื่อข้อมูลครบ
- AI สรุปผลจาก tool result ไม่ใช่แต่งเอง
- เวลาจองต้องตรงกับ slot interval จากฐานข้อมูล
- ถ้าลูกค้าเลือกเวลานอกสล็อต ต้องเสนอรอบใกล้เคียงจากรายการที่เปิดจริง
- ข้อความยืนยันจองต้องมีข้อมูลสำคัญครบพอให้เจ้าของร้านตรวจสมุดจองย้อนหลังได้

## กติกากลางที่ใช้กับทุกประเภทธุรกิจ (29 กรกฎาคม 2026)

กติกา 4 ข้อนี้เดิมทำไว้เฉพาะฝั่งจองโต๊ะ แล้วไล่ตรวจพบว่าฝั่งขายสินค้าขาดครบทุกข้อ จึงยกขึ้นมาเป็นกติกากลาง — **ทุก workflow ที่เพิ่มใหม่ในอนาคตต้องผ่านทั้ง 4 ข้อ**

1. **ต้องมีเลขอ้างอิงจากเครื่องมือก่อนบอกว่าสำเร็จ** — จองต้องมีเลขที่จอง (`BK-xxxxxx`), สั่งซื้อต้องมีเลขที่ออเดอร์ (`ORD-xxxxxx`) ถ้าไม่มีเลขแปลว่ายังไม่ได้บันทึกจริง ห้ามบอกลูกค้าว่าเรียบร้อย
2. **ต้องผูกสถานะจริงจากฐานข้อมูลเข้า prompt** — บอก AI ตรงๆ ว่าตอนนี้ลูกค้ารายนี้มีการจอง/ออเดอร์อะไรบันทึกไว้จริงบ้าง ถ้ายังไม่มีให้บอกว่า "ยังไม่มี" การอ้างว่าสำเร็จจะได้ขัดกับบริบทตัวเอง แทนที่จะปล่อยให้แต่งได้อิสระ
3. **แยกคำถามออกจากคำสั่ง** — "ยกเลิกยังไง" คือถามขั้นตอน ไม่ใช่สั่งให้ยกเลิก ใช้กับทุกเครื่องมือที่เปลี่ยนแปลงข้อมูล (cancel/reschedule/take_order)
4. **ทุก query ต้องกรองว่าเป็นของลูกค้าคนที่คุยอยู่** — ดูกฎเหล็กข้อ 6 ใน `ROADMAP_AI_AGENT.md`

### ผลการไล่ตรวจต่อประเภทธุรกิจ

| ประเภท | ใช้เครื่องมือชุดไหน | สถานะ |
|---|---|---|
| Restaurant / Table Booking | booking tools | ✅ แก้แล้วรอบแรก |
| Service / Clinic / Salon | booking tools ชุดเดียวกัน (มีพารามิเตอร์ `resource` สำหรับช่าง/ห้อง) | ✅ ได้อานิสงส์อัตโนมัติ |
| Queue / Class / Event | booking tools ชุดเดียวกัน (มี `guest_count` + `capacity_per_slot`) | ✅ ได้อานิสงส์อัตโนมัติ |
| Retail / Commerce | `take_order` / `check_order_status` แยกต่างหาก | ✅ แก้แล้ว 29 ก.ค. (commit `95e1482`) |

**บั๊กที่เจอตอนไล่ตรวจฝั่งขาย:** `take_order` ไม่เคยใส่ `order_no` เลย ค่า default ในฐานข้อมูลคือ `'ORD-000'` แปลว่า**ทุกออเดอร์ที่บอทรับมาใช้เลขเดียวกันหมด** เจ้าของร้านแยกไม่ออกในหน้า dashboard ลูกค้าไม่มีเลขไปอ้างอิง และ `check_order_status` ที่ค้นด้วย `order_no` ก็ทำงานไม่ได้เลยตั้งแต่แรก

## สถานะงานรอบนี้

- เพิ่ม Store Manager Operating Mode ใน system prompt
- เพิ่มกฎห้ามเสนอเวลานอกสล็อตใน prompt
- เพิ่ม slot interval ลงผลลัพธ์ `check_available_slots`
- เพิ่ม guard ใน `book_appointment` ไม่ให้บันทึกเวลานอกสล็อตจริง
- เพิ่ม guard ใน `reschedule_booking` ไม่ให้เลื่อนเป็นเวลานอกสล็อตจริง
- เพิ่มชื่อและเบอร์โทรในข้อความยืนยันจองจริง