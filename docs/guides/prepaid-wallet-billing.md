# คู่มือระบบกระเป๋าเงิน (Prepaid Wallet) — นำไปใช้กับโปรเจคอื่น

> อ้างอิงจาก DealMee (`praphawach29/DealMee`) ที่ใช้งานจริงบน production ตั้งแต่ 20 ต.ค. 2569
> เขียนให้ AI ใน session อื่นอ่านแล้วสร้างระบบเดียวกันได้ โดยไม่ต้องมีบริบทจากบทสนทนาเดิม
> ถ้า session นั้นเข้าถึง repo DealMee ได้ ให้อ่านไฟล์จริงตามตาราง "ไฟล์อ้างอิง" ท้ายเอกสารประกอบ

---

## 1. ระบบทำอะไร (สิ่งที่ต้องได้เหมือนกัน)

1. ลูกค้า (tenant เช่น ร้าน/บริษัท) **เติมเงินเข้ากระเป๋า** ด้วยการโอนพร้อมเพย์ตาม QR แล้วแนบสลิป
2. สลิปที่ **ยอดตรง + เข้าบัญชีเรา + ไม่เคยใช้** → อนุมัติทันที เงินเข้ากระเป๋า ออกเลขใบเสร็จ
   สลิปที่ไม่ผ่าน / ไม่มีเลขอ้างอิง / หัก ณ ที่จ่าย 3% → รอแอดมินอนุมัติที่หน้าแอดมิน
3. ลูกค้า **ซื้อแพ็กเกจรายเดือนและแพ็กเสริม** จากยอดในกระเป๋า (ไม่ต้องโอนทุกครั้ง)
4. เปลี่ยนแพ็กเกจกลางรอบ → **คืนมูลค่าวันที่เหลือ** ของแพ็กเกจเดิมเข้ากระเป๋า
5. แพ็กเกจหมดอายุ → **ต่ออายุอัตโนมัติจากกระเป๋า** (cron) ถ้าเงินไม่พอ → ใช้ต่อได้ 3 วัน (grace) แล้วลดเป็น Free
   แจ้งเตือนล่วงหน้า 3 วันเมื่อเงินไม่พอ แจ้งครั้งเดียวต่อรอบบิล
6. แพ็กเสริม (เช่น ข้อความ AI, ตรวจสลิป) ใช้ **หลังโควต้ารายเดือนหมด** และมีอายุ 90 วัน ใช้ก้อนที่หมดอายุก่อนก่อน
7. **ยอดเงินอัปเดตเรียลไทม์** บนหน้าจอลูกค้า ไม่ต้องรีเฟรช
8. เจ้าของแพลตฟอร์มได้ **แจ้งเตือนทาง LINE** ทุกครั้งที่มีการเติมเงิน (สำเร็จ / รอตรวจ)
9. ทุกการเปลี่ยนยอดมี **สมุดบัญชี (ledger)** พร้อมยอดคงเหลือหลังรายการ ตรวจย้อนหลังได้

---

## 2. หลักการออกแบบ (ห้ามข้าม — ทุกข้อมาจากบั๊กจริง)

| # | กติกา | ถ้าไม่ทำจะเกิดอะไร |
|---|---|---|
| 1 | ยอดเงินเปลี่ยนได้ทาง **RPC ฝั่งเซิร์ฟเวอร์เท่านั้น** (`wallet_apply`) และทุกครั้งต้องเขียน ledger คู่กัน | ยอดกับประวัติไม่ตรงกัน ตรวจย้อนไม่ได้ |
| 2 | RPC ทุกตัว `SECURITY DEFINER` + `REVOKE ... FROM PUBLIC, anon, authenticated` + `GRANT EXECUTE ... TO service_role` | ลูกค้าที่ login เรียก RPC ผ่าน REST อนุมัติสลิปตัวเอง/เติมเงินให้ตัวเองได้ |
| 3 | `REVOKE FROM PUBLIC` ดึงสิทธิ์ service_role ออกด้วย → **ต้อง GRANT ให้ service_role ในไฟล์ migration เสมอ** (local Supabase grant คืนให้เอง แต่ production ไม่) | เทสผ่านใน local แต่ production ได้ `permission denied` |
| 4 | ตารางใหม่ที่เซิร์ฟเวอร์อ่าน ต้อง `GRANT ... TO service_role` และโค้ดต้องเช็ค `error` | อ่านไม่ได้แล้วเงียบ เหมือน "ไม่มีข้อมูล" |
| 5 | Trigger กันลูกค้าแก้คอลัมน์แพ็กเกจของตัวเอง (`plan`, `plan_expires_at`, …) และ `role`/`workspace_id` | RLS ที่ให้แก้แถวตัวเองได้ = แก้ทุกคอลัมน์ได้ รวมถึงอัปเกรดแพ็กเกจฟรี |
| 6 | ยอดเงิน / ยอดหัก ณ ที่จ่าย **คำนวณที่เซิร์ฟเวอร์** ไม่เชื่อค่าจากเบราว์เซอร์ | ส่งยอดปลอมมาได้ |
| 7 | สลิปหนึ่งใบเติมได้ครั้งเดียว: เช็ค `slip_reference` ซ้ำ + unique index `(payment_id) WHERE kind='topup'` | สลิปเดียวเติมซ้ำได้ / กดอนุมัติซ้ำได้เงินสองเท่า |
| 8 | สลิปไม่มีเลขอ้างอิง → **ห้ามอนุมัติอัตโนมัติ** (เช็คซ้ำไม่ได้) | สลิปเดิมใช้ซ้ำได้ |
| 9 | ตรวจบัญชีผู้รับกับ **ทุกเลขบัญชีของเรา** (พร้อมเพย์ + เลขบัญชีธนาคารที่ผูกพร้อมเพย์) | สลิปจริงถูกปฏิเสธ เพราะสลิปมักแสดงเลขบัญชีธนาคาร ไม่ใช่เบอร์พร้อมเพย์ |
| 10 | ปิดรับเติมเงินถ้าพร้อมเพย์ยังเป็นค่า placeholder | ลูกค้าโอนเงินเข้าเบอร์คนแปลกหน้า |
| 11 | ทุกฟังก์ชันที่เปลี่ยนยอดล็อกแถวกระเป๋าก่อน (`SELECT ... FOR UPDATE`) | กดซื้อพร้อมกันสองแท็บ ยอดติดลบ/ซื้อเกินเงิน |
| 12 | `CHECK (balance >= 0)` ที่ตาราง | กันพลาดชั้นสุดท้าย |
| 13 | ตารางที่หน้าเว็บ subscribe realtime ต้องอยู่ใน publication `supabase_realtime` | subscribe แล้วเงียบ ไม่ error ไม่เตือน |
| 14 | token LINE ของแพลตฟอร์มเก็บในตารางที่ RLS เปิดและ **ไม่มี policy** (service role อย่างเดียว) | token รั่วให้ลูกค้าที่ login อ่านได้ |

---

## 3. ฐานข้อมูล

ไฟล์จริง: `supabase/migrations/20260914000000_checkmee_billing_system.sql` (billing_payments, ใบเสร็จ, platform settings)
และ `supabase/migrations/20261020000000_wallet_billing.sql` (กระเป๋าเงินทั้งหมด) — **คัดลอกไปปรับได้เกือบทั้งไฟล์**

> ในโค้ด DealMee tenant คือ `shops` และผูกผู้ใช้ผ่าน `users.workspace_id` — โปรเจคอื่นเปลี่ยนเป็นตาราง tenant ของตัวเอง
> (เช่น `companies` + `get_my_company_id()`) แล้วแก้ policy ให้ตรง

### ตาราง

| ตาราง | หน้าที่ | ลูกค้าอ่านได้ | ใครเขียน |
|---|---|---|---|
| `plans` | แพ็กเกจ: `key, name, price, messages, slips, features` | ทุกคน | service role |
| `billing_payments` | รายการโอน/สลิป: `plan_key='wallet_topup'`, `amount`, `billed_amount`, `withheld_amount`, `transferred_amount`, `status`, `slip_url`, `slip_reference`, `receipt_number`, `verified_by` | ของตัวเอง | service role |
| `platform_billing_settings` | บัญชีรับเงินของเรา (พร้อมเพย์, ธนาคาร, ข้อมูลออกใบเสร็จ) แถวเดียว | ได้ (ใช้แสดง QR) | Super Admin |
| `shop_wallets` | `balance` (CHECK ≥ 0), `auto_renew`, `renewal_notice_for`, `lapse_notice_for` | ของตัวเอง | RPC |
| `wallet_transactions` | ledger: `kind` (`topup/plan/renewal/plan_credit/addon/adjust`), `amount` (+/-), `balance_after`, `payment_id`, `plan_key`, `addon_key`, `created_by` | ของตัวเอง | RPC |
| `addon_packs` | แคตตาล็อกแพ็กเสริม: `kind` (`messages/slips`), `quantity`, `price`, `valid_days` | ทุกคน | service role |
| `shop_addon_credits` | แพ็กเสริมที่ซื้อแล้ว: `remaining`, `expires_at` | ของตัวเอง | RPC |
| `usage_logs` | การใช้ต่อเดือน `(shop_id, period)`: `messages_used`, `slips_used` | ของตัวเอง | RPC |
| `platform_line_alerts` | LINE OA ของแพลตฟอร์ม (token, secret, LINE user ของเจ้าของ) | **ไม่ได้** | service role |
| sequence `receipt_number_seq` + `next_receipt_number()` | เลขใบเสร็จต่อเนื่อง | — | RPC |
| storage bucket `payment-slips` | รูปสลิป path `<tenant_id>/<timestamp>-<file>` | — | เซิร์ฟเวอร์ |

### RPC (ทั้งหมด service role เท่านั้น)

| ฟังก์ชัน | ทำอะไร |
|---|---|
| `wallet_lock(tenant)` | สร้างกระเป๋าถ้ายังไม่มี แล้ว `SELECT ... FOR UPDATE` |
| `wallet_apply(tenant, amount, kind, description, payment_id, plan_key, addon_key, actor)` | ขยับยอด + เขียน ledger พร้อม `balance_after` (ผู้เรียกต้อง lock ก่อน) |
| `verify_manual_payment(payment_id, admin_id)` | อนุมัติสลิป: ถ้าอนุมัติแล้วคืนผลเดิม (idempotent), ออกเลขใบเสร็จ, ถ้า `plan_key='wallet_topup'` → เติมเงินเท่ากับ `billed_amount` (ยอดเต็มแม้หัก 3%) |
| `reject_manual_payment(payment_id, reason, admin_id)` | ปฏิเสธพร้อมเหตุผล |
| `wallet_buy_plan(tenant, plan_key, actor)` | ซื้อ/เปลี่ยนแพ็กเกจ: คืนมูลค่าวันที่เหลือ `ราคาเดิม × min(1, วันที่เหลือ/30)` ปัดลงถึงสตางค์; ซื้อแพ็กเดิมก่อนหมด = ต่อจากวันหมดเดิม; อย่างอื่นเริ่ม 30 วันใหม่; เงินไม่พอคืน `{error:'insufficient_balance', needed}` |
| `wallet_renew_plan(tenant)` | ต่ออายุเมื่อหมด (หรือเหลือ ≤10 นาที) ภายใน grace 3 วัน, ต่อจากวันหมดเดิม (ไม่ให้วันฟรี) คืน `status`: `renewed / insufficient / auto_renew_off / lapsed / not_due / skipped` |
| `wallet_buy_addon(tenant, addon_key, actor)` | ตัดเงิน + สร้าง `shop_addon_credits` อายุ `valid_days` |
| `consume_addon_credit(tenant, kind)` | ใช้ 1 หน่วยจากก้อนที่หมดอายุก่อน คืน true/false |
| `claim_slip_check(tenant, period, limit)` | นับการตรวจสลิป 1 ครั้ง: โควต้าแพ็กเกจก่อน → แพ็กเสริม → `'none'` |

ท้าย migration มี loop `REVOKE ... FROM PUBLIC, anon, authenticated` + `GRANT EXECUTE ... TO service_role` สำหรับทุกฟังก์ชันข้างบน — **ต้องมี**

Realtime: `supabase/migrations/20261021000000_realtime_wallet.sql` เพิ่ม `shop_wallets` และ `billing_payments` เข้า `supabase_realtime` (RLS ยังกรองว่าใครได้แถวไหน)

---

## 4. Flow เติมเงิน (`src/app/api/billing/submit-slip/route.ts`)

```
ลูกค้า: เลือกยอด (100–100,000) → แสดง QR พร้อมเพย์ฝังยอด (promptpay-qr + qrcode)
      → อัปโหลดสลิป (+ ติ๊ก "หัก ณ ที่จ่าย 3%" ถ้ามี)
เซิร์ฟเวอร์:
  1. ต้อง login, หา tenant ของผู้ใช้, ปิดถ้าพร้อมเพย์ยังเป็น placeholder (503)
  2. คำนวณ withheld = billed × 3%, transferred = billed − withheld (ที่เซิร์ฟเวอร์)
  3. อัปโหลดสลิปเข้า bucket ด้วย service client
  4. ตรวจสลิปผ่าน API (EasySlip / Thunder / SlipOK) ส่งเลขบัญชีเราทุกเลขไปให้เทียบ
     slipRef = transRef || ref1 || อ่าน mini-QR บนสลิปเอง
     ผ่าน = |ยอดสลิป − transferred| ≤ 1 บาท และ ผู้รับตรง
  5. slipRef ซ้ำกับรายการที่ไม่ใช่ rejected → ปฏิเสธ "สลิปนี้เคยใช้แล้ว"
  6. insert billing_payments status='pending', plan_key='wallet_topup'
  7. ผ่าน + มี slipRef + ไม่หัก 3% → rpc verify_manual_payment → เงินเข้า → แจ้ง LINE "💰 เติมเงินสำเร็จ"
     อย่างอื่น → คงไว้ pending ใส่เหตุผลใน customer_notes → แจ้ง LINE "⏳ รอตรวจ" พร้อมลิงก์หน้าแอดมิน
     ถ้าตรวจผ่านแต่ RPC ล้ม → บันทึกเหตุผลไว้ให้แอดมิน ไม่บอกลูกค้าว่าสำเร็จ
```

แจ้ง LINE ส่งใน `after()` (Next.js) เพื่อไม่ให้ลูกค้ารอ

หน้าแอดมิน `/admin/payments`: รายการรอตรวจ ดูรูปสลิป กดอนุมัติ (`verify_manual_payment`) / ปฏิเสธพร้อมเหตุผล — ตรวจสิทธิ์ Super Admin ทุก action

---

## 5. ซื้อแพ็กเกจ / แพ็กเสริม (`src/app/dashboard/billing/actions.ts`)

Server action หา tenant จาก session แล้วเรียก RPC ด้วย service client — **ไม่รับ tenant_id จากเบราว์เซอร์**
เงินไม่พอ → ข้อความ "ต้องเติมอีก ฿X" และเปิดหน้าต่างเติมเงินพร้อมยอดที่ขาด (ปัดขึ้น)
แพ็กเสริมตรวจสลิปขายเฉพาะแพ็กเกจที่จ่ายเงิน (Free ไม่มีตรวจสลิปอัตโนมัติ)

แพ็กเกจที่ใช้งานจริงคำนวณที่ `effectivePlanKey()` (`src/lib/billing/trial.ts`): ทดลองใช้ → หมดเป็น free; เกิน `plan_expires_at + 3 วัน` → free
— **ทุกจุดที่ตัดสินสิทธิ์ต้องใช้ฟังก์ชันนี้** ไม่อ่าน `plan` ตรง ๆ

---

## 6. ต่ออายุอัตโนมัติ (`src/lib/billing/walletRenewal.ts`)

รันจาก cron ที่มีอยู่แล้ว (ป้องกันด้วย `CRON_SECRET`) ทุกไม่กี่นาที เลือก tenant ที่ `subscription_provider='wallet'` และหมดอายุในช่วง [−3 วัน, +3 วัน]

- ยังไม่หมด + เงินไม่พอ (หรือปิดต่ออายุ) → เตือนครั้งเดียว (`renewal_notice_for = plan_expires_at`)
- หมดแล้ว → `wallet_renew_plan`; ต่อได้ → แจ้ง "✅ ต่ออายุแล้ว"; ไม่พอ → แจ้งครั้งเดียวว่าใช้ได้ถึงวันไหนแล้วจะเป็น Free (`lapse_notice_for`)
- ซื้อ/ต่ออายุสำเร็จ → ล้าง notice ทั้งสอง (รอบใหม่เตือนได้อีก)

---

## 7. Realtime (`src/app/dashboard/billing/BillingClient.tsx`)

```ts
const channel = supabase
  .channel(`billing:${tenantId}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_wallets', filter: `shop_id=eq.${tenantId}` }, refresh)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'billing_payments', filter: `shop_id=eq.${tenantId}` }, refresh)
  .subscribe()
const timer = setInterval(refresh, 30_000)                 // กันพลาดถ้า socket หลุด
document.addEventListener('visibilitychange', refresh)    // กลับมาที่แท็บแล้วรีเฟรช
// refresh = router.refresh() เมื่อแท็บมองเห็นอยู่ (หรือ invalidate react-query)
```

หน้าแอดมิน `/admin/payments` ของ DealMee ยังไม่มี realtime (แอดมินรู้จากแจ้งเตือน LINE แล้วเปิดหน้า) — ถ้าจะเพิ่ม ทำแบบเดียวกันกับ `billing_payments` ไม่ใส่ filter แต่ต้องมี policy ให้ Super Admin อ่านได้ทุกแถว

---

## 8. แจ้งเตือน LINE ถึงเจ้าของแพลตฟอร์ม

- `supabase/migrations/20261023000000_platform_line_alerts.sql` — ตารางแถวเดียว RLS เปิด ไม่มี policy, `REVOKE` จาก anon/authenticated
- `src/lib/billing/platformLineAlerts.ts` — บันทึก token/secret (เช็ค token กับ `GET /v2/bot/info`), สร้างรหัสผูก `DM-XXXXXXXX` อายุ 1 ชม., ตรวจลายเซ็น HMAC-SHA256 แบบ `timingSafeEqual`, push
- `src/app/api/webhook/platform-alerts/route.ts` — webhook ของ OA: ตรวจลายเซ็น แล้วถ้าข้อความเป็น `/admin-link <รหัส>` ที่ยังไม่หมดอายุ → บันทึก LINE user ของเจ้าของ ล้างรหัส
- หน้าแอดมิน: ใส่ token/secret, แสดงรหัส + QR เพิ่มเพื่อน, ปุ่มส่งข้อความทดสอบ, ปุ่มยกเลิกการผูก
- `notifyPlatformOwner(text)` คืน false เงียบ ๆ ถ้ายังไม่ตั้งค่า — **ห้ามทำให้การเติมเงินล้มเพราะแจ้งเตือนล้ม**

---

## 9. ลำดับการนำไปใช้ในโปรเจคใหม่

1. อ่านโครงสร้าง tenant / ผู้ใช้ / ระบบบิลเดิมของโปรเจคนั้น (มีตารางแพ็กเกจ? มี usage? มี cron?)
2. Migration: tenant columns (`plan_key`, `plan_expires_at`, `subscription_provider`, …) + trigger กันแก้ → `billing_payments` + ใบเสร็จ + `platform_billing_settings` + bucket → กระเป๋า/ledger/แพ็กเสริม/RPC → revoke/grant → realtime publication
3. lib: settings, สร้าง QR, ตรวจสลิป (+ อ่าน mini-QR), `effectivePlanKey`
4. API เติมเงิน (ข้อ 4) → server actions ซื้อแพ็กเกจ/แพ็กเสริม (ข้อ 5)
5. UI ลูกค้า: ยอดคงเหลือ, ปุ่มเติมเงิน (QR + อัปโหลด), รายการรอตรวจ, ประวัติ ledger, ซื้อแพ็กเกจ/แพ็กเสริม, สวิตช์ต่ออายุอัตโนมัติ, realtime
6. UI แอดมิน: ตั้งค่าบัญชีรับเงิน, รายการสลิปรอตรวจ อนุมัติ/ปฏิเสธ, ตั้งค่า LINE แจ้งเตือน
7. Cron ต่ออายุ + เตือน (ข้อ 6) และตัดโควต้า: ข้อความ/สลิปใช้โควต้าแพ็กเกจก่อน แล้วค่อย `consume_addon_credit`
8. ทดสอบตามข้อ 10 แล้วค่อยเปิดให้ลูกค้าใช้

---

## 10. เช็คลิสต์ทดสอบ (ทำบน production ด้วยเงินจริงจำนวนน้อย)

- [ ] เติมเงิน 100 บาท สลิปถูกต้อง → เงินเข้าทันที ได้เลขใบเสร็จ ยอดเปลี่ยนบนจอโดยไม่รีเฟรช LINE เจ้าของได้แจ้งเตือน
- [ ] ส่งสลิปเดิมซ้ำ → ถูกปฏิเสธ "เคยใช้แล้ว"
- [ ] สลิปยอดไม่ตรง → รอตรวจ แอดมินเห็น อนุมัติแล้วเงินเข้า (หน้าลูกค้าเปลี่ยนเอง)
- [ ] กดอนุมัติซ้ำ → ไม่เติมซ้ำ (`already_verified`)
- [ ] ซื้อแพ็กเกจเงินไม่พอ → บอกยอดที่ขาด; เงินพอ → ยอดลด แพ็กเกจเปลี่ยน วันหมดอายุ +30
- [ ] เปลี่ยนแพ็กเกจกลางรอบ → มีรายการ `plan_credit` คืนเงิน
- [ ] ผู้ใช้ที่ login เรียก `rpc('wallet_apply', ...)` / `rpc('verify_manual_payment', ...)` จากเบราว์เซอร์ → 42501
- [ ] ผู้ใช้ที่ login `update` คอลัมน์ `plan_key` ของ tenant ตัวเอง → 42501
- [ ] ผู้ใช้ที่ login `select` จาก `platform_line_alerts` → ไม่ได้แถว
- [ ] ตั้ง `plan_expires_at` ให้หมด แล้วรัน cron → ต่ออายุ/แจ้งเตือนถูก และไม่แจ้งซ้ำรอบถัดไป
- [ ] Security Advisor ของ Supabase ไม่มีคำเตือนเรื่อง RLS ของตารางใหม่

---

## 11. ไฟล์อ้างอิงใน DealMee

| ไฟล์ | เนื้อหา |
|---|---|
| `supabase/migrations/20260914000000_checkmee_billing_system.sql` | billing_payments, platform_billing_settings, ใบเสร็จ, submit/verify/reject, bucket |
| `supabase/migrations/20261020000000_wallet_billing.sql` | กระเป๋า, ledger, แพ็กเสริม, RPC, trigger กันแก้, revoke/grant |
| `supabase/migrations/20261021000000_realtime_wallet.sql` | realtime publication |
| `supabase/migrations/20261023000000_platform_line_alerts.sql` | ตาราง LINE แจ้งเตือนแพลตฟอร์ม |
| `src/lib/billing/manualBilling.ts` | settings, QR, ตรวจสลิป, ค่าคงที่ min/max |
| `src/app/api/billing/submit-slip/route.ts` | API เติมเงิน |
| `src/app/dashboard/billing/actions.ts` | ซื้อแพ็กเกจ/แพ็กเสริม, `setWalletAutoRenew` |
| `src/app/dashboard/billing/BillingClient.tsx`, `TopUpModal.tsx` | UI ลูกค้า + realtime |
| `src/app/admin/payments/` | UI แอดมินอนุมัติ |
| `src/lib/billing/walletRenewal.ts`, `trial.ts`, `planLimits.ts` | ต่ออายุ, แพ็กเกจที่ใช้งานจริง, โควต้า |
| `src/lib/billing/platformLineAlerts.ts`, `platformAlerts.ts`, `src/app/api/webhook/platform-alerts/route.ts` | แจ้งเตือน LINE |

---

## 12. ข้อความสำหรับวางใน session ใหม่

```
อ่าน docs/guides/prepaid-wallet-billing.md จาก repo praphawach29/DealMee (DealMee)
แล้วสร้างระบบกระเป๋าเงินแบบเดียวกันในโปรเจคนี้ ให้ได้ครบทุกข้อในหัวข้อ 1 และทำตามกติกาในหัวข้อ 2 ทุกข้อ
ใช้ไฟล์ในหัวข้อ 11 เป็นต้นแบบ (add_repo เพื่ออ่านได้) ปรับชื่อตาราง tenant ให้ตรงกับโปรเจคนี้
เริ่มจากสำรวจโครงสร้าง tenant/บิลเดิมของโปรเจคนี้ แล้วสรุปแผนให้ผมยืนยันก่อนเขียน migration
แบ่งเป็นหลาย PR: (1) migration + RPC (2) เติมเงิน + แอดมินอนุมัติ (3) ซื้อแพ็กเกจ/แพ็กเสริม + ต่ออายุ (4) realtime + แจ้งเตือน LINE
ทดสอบตามเช็คลิสต์หัวข้อ 10
```
