# ตัวตั้งเวลา (scheduler) ของ DealMee — pg_cron ใน Supabase

งานที่ต้องรันตามเวลาทุกตัวของ DealMee เรียกผ่าน endpoint เดียวคือ `POST /api/cron/follow-up`
(ป้องกันด้วย `CRON_SECRET`) ซึ่งรวมงานเหล่านี้ไว้:

| งาน | ทำอะไร |
|---|---|
| `processDueFollowUpTasks` | ข้อความเตือนชำระเงินหลังส่ง QR · เตือนก่อนนัด · ข้อความตั้งเวลา |
| `expirePendingOrders` | ยกเลิกออเดอร์ค้างชำระตามเวลาที่ร้านตั้ง แล้วคืนสต็อก |
| `sendTrialReminders` | แจ้งเตือนร้านที่ทดลองใช้ใกล้หมด |
| `processWalletRenewals` | ต่ออายุแพ็กเกจจากกระเป๋าเงิน |
| `expirePausedConversations` | คืนแชทให้บอทเมื่อครบ 1 ชั่วโมงที่แอดมินคุยแทน |

**ถ้า scheduler ไม่ทำงาน ทั้งห้าอย่างนี้หยุดเงียบ ๆ โดยไม่มีข้อความแจ้งที่ไหนเลย** — เช็คเป็นอันดับแรกเสมอเมื่อมีรายงานว่า "ระบบไม่ส่งข้อความเตือน" หรือ "แชทไม่กลับมาเป็นบอท"

## ทำไมไม่ใช้ GitHub Actions แล้ว (24 ต.ค. 2569)

repo นี้เป็น private → GitHub Actions ใช้โควตาฟรี 2,000 นาที/เดือน
ตั้งรันทุก 5 นาที = 288 รอบ/วัน × คิดขั้นต่ำรอบละ 1 นาที ≈ **8,640 นาที/เดือน** เกินโควตา 4 เท่า

โควตาหมดแล้ว GitHub ไม่เริ่ม job ให้อีกเลย (ขึ้นว่า *"The job was not started because recent
account payments have failed or your spending limit needs to be increased"*) โดยที่ตัว workflow
ไม่ได้ error ในโค้ดเลย — มองจากในแอปจึงไม่เห็นว่าอะไรพัง

ทางเลือกอื่นที่พิจารณาแล้วไม่เอา: Vercel Cron (แพ็กเกจ Hobby ตั้งได้แค่วันละครั้ง ไม่พอสำหรับเตือนชำระเงิน 15 นาที) ·
บริการ cron ภายนอก (ต้องดูแลอีกบัญชี) · จ่ายค่า Actions ต่อ (~$65–70/เดือน แค่ยิง URL)

ไฟล์ `.github/workflows/follow-up-cron.yml` ยังอยู่ แต่เหลือแค่ปุ่มกดรันเอง (`workflow_dispatch`)
ไว้ใช้ฉุกเฉินเวลา scheduler ในฐานข้อมูลมีปัญหา

## ติดตั้งครั้งแรก

1. apply migration `supabase/migrations/20261030000000_pg_cron_follow_up.sql`
   (`npx supabase db push` หรือวางใน SQL editor) — จะเปิด `pg_cron` + `pg_net`
   สร้างฟังก์ชัน `public.run_follow_up_cron()` และตั้งตารางเวลาทุก 5 นาที
2. ใส่ค่าสองตัวลง Vault **ครั้งเดียว** (ห้ามใส่ลง migration เพราะ migration ขึ้น git):
   ```sql
   select vault.create_secret('https://app.dealmee.app', 'dealmee_app_url');
   select vault.create_secret('<CRON_SECRET ตัวเดียวกับใน Vercel>', 'dealmee_cron_secret');
   ```
   ถ้ายังไม่ใส่ ฟังก์ชันจะขึ้น warning แล้วไม่ยิงอะไรเลย (ไม่ยิงแบบไม่มี token)
3. รอ 5 นาที แล้วเช็คตามหัวข้อถัดไป

เปลี่ยนค่าภายหลัง: `select vault.update_secret(id, 'ค่าใหม่');` (หา `id` จาก `select id, name from vault.secrets;`)

## เช็คว่าทำงานอยู่ไหม

```sql
-- 1. ตารางเวลายังอยู่และเปิดอยู่
select jobname, schedule, active from cron.job where jobname = 'dealmee-follow-up';

-- 2. ยิงไปจริงไหม ล่าสุดเมื่อไหร่ (status ต้องเป็น 'succeeded')
select start_time, status, return_message
from cron.job_run_details
where jobname = 'dealmee-follow-up'
order by start_time desc limit 10;

-- 3. แอปตอบว่าอะไร (status_code ต้องเป็น 200 · เก็บไว้ราว 6 ชั่วโมง)
select created, status_code, content
from net._http_response
order by created desc limit 5;
```

อ่านผลแบบนี้:
- **ไม่มีแถวใน `cron.job_run_details`** → pg_cron ไม่ได้รัน (extension ถูกปิด หรือ job ถูก unschedule)
- **`cron.job_run_details` succeeded แต่ไม่มีแถวใน `net._http_response`** → ยิงไม่ออก (ปกติคือ Vault ว่าง ดู warning ใน Postgres logs)
- **`status_code` = 401** → `dealmee_cron_secret` ไม่ตรงกับ `CRON_SECRET` บน Vercel
- **`status_code` = 503** → Vercel ไม่มี env `CRON_SECRET`
- **`status_code` = 307/308** → `dealmee_app_url` ไม่ใช่ origin จริง (ต้องเป็น `https://app.dealmee.app` ไม่ใช่ `dealmee.app` และไม่ใช่ `http://`)

## หยุด / เปิดใหม่ชั่วคราว

```sql
select cron.unschedule('dealmee-follow-up');                                    -- หยุด
select cron.schedule('dealmee-follow-up', '*/5 * * * *',
  $job$select public.run_follow_up_cron()$job$);                                -- เปิดใหม่
select public.run_follow_up_cron();                                             -- ยิงเดี๋ยวนี้ 1 ครั้ง
```

## ตอนย้ายไปโปรเจกต์ Supabase ใหม่

migration จะตั้งตารางเวลาให้เอง แต่ **Vault ไม่ได้มากับ migration** ต้องรันข้อ 2 ใหม่ทุกครั้ง
ไม่งั้น scheduler จะเงียบทั้งระบบ
