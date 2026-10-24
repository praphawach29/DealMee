# โครงสร้างฐานข้อมูลจริง (production)

ไฟล์ migration ใน `supabase/migrations/` **ไม่ตรงกับฐานข้อมูลจริงทั้งหมด** — มีตารางที่ถูกแก้มือมาก่อน
(เช่น `products` มี `sku`, `price_used` แต่ไม่มี `status`; `shops` มี `promptpay_number` แต่ไม่มี `promptpay_id`)
migration ที่เขียนจากไฟล์อย่างเดียวจึงพังบนของจริงได้ (เดโมหน้าแรก 24 ต.ค. 2569 ต้องรันใหม่ 2 รอบ)

| ไฟล์ | คืออะไร |
|---|---|
| `dump-schema.sql` | คำสั่งดึงโครงสร้าง (อ่านอย่างเดียว ไม่ดึงข้อมูลในตาราง) |
| `production.json` | ผลลัพธ์เต็ม (ตาราง คอลัมน์ constraint index policy สิทธิ์ ฟังก์ชัน trigger) |
| `production.md` | ฉบับอ่านง่าย ตารางละหัวข้อ |

## อัปเดต snapshot
1. รัน `dump-schema.sql` ใน Supabase SQL Editor ของ DealMee
2. Export → Download CSV
3. `node scripts/schema-snapshot.mjs import <ไฟล์.csv>` แล้ว commit

ควรทำใหม่หลังรัน migration ที่เปลี่ยนโครงสร้างทุกครั้ง

## ก่อนส่ง migration ใหม่ให้รัน
```bash
npm run schema:check                      # migration ที่ใหม่กว่า snapshot
node scripts/schema-snapshot.mjs check supabase/migrations/<ไฟล์>.sql
```
ตรวจสองอย่าง:
- migration ที่ branch นี้เพิ่ม/แก้: `insert into ... (คอลัมน์)` และ `update ... set คอลัมน์ =` ใช้เฉพาะคอลัมน์ที่มีจริง
  (หรือคอลัมน์ที่ไฟล์เดียวกันเพิ่มเองด้วย `add column`)
- โค้ดใน `src/`: `.from('ตาราง').select('...')` และ `.eq('คอลัมน์', …)` / `.order(…)` ฯลฯ ใช้เฉพาะตาราง/คอลัมน์ที่มีจริง
  (ตัวนี้คือที่เจอ `orders.payment_status` ซึ่งทำให้ลูกค้าที่จ่ายแล้วโดนทวงเงิน)

ยังไม่ได้ตรวจ: คอลัมน์ใน `.insert({...})`/`.update({...})` ของโค้ด, `.or('...')`, และตัวฟังก์ชันใน SQL
