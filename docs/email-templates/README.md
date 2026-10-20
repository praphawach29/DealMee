# เทมเพลตอีเมล Supabase Auth ของ DealMee

ใส่ที่ Supabase Dashboard → Authentication → Emails (โปรเจกต์ DealMee) โดยคัดลอกทั้งไฟล์ไปวางในช่อง Message body

| ไฟล์ | เทมเพลตใน Supabase | Subject |
|---|---|---|
| `1-confirm-signup.html` | Confirm signup | ยืนยันอีเมล DealMee |
| `2-invite.html` | Invite user | คุณได้รับคำเชิญเข้า DealMee |
| `3-magic-link.html` | Magic link | ลิงก์เข้าสู่ระบบ DealMee |
| `4-change-email.html` | Change email address | ยืนยันการเปลี่ยนอีเมล DealMee |
| `5-reset-password.html` | Reset password | รีเซ็ตรหัสผ่าน DealMee |
| `6-reauthentication.html` | Reauthentication | รหัสยืนยันตัวตน DealMee |

## ทำไมลิงก์เป็นแบบ `token_hash`

ลิงก์ตั้งต้นของ Supabase (`{{ .ConfirmationURL }}`) ใช้ PKCE: ตัวยืนยันอยู่ในคุกกี้ของเบราว์เซอร์ที่กดขอ
ถ้าผู้ใช้เปิดลิงก์จากแอป Gmail หรือเครื่องอื่น ลิงก์จะใช้ไม่ได้ (20 ต.ค. 2569: เจ้าของร้านรีเซ็ตรหัสผ่านแล้วไม่มีฟอร์มให้ตั้งรหัส)

ทุกเทมเพลตจึงชี้ไปที่ `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=<ชนิด>&next=<หน้าถัดไป>`
ซึ่ง `src/app/auth/callback/route.ts` ยืนยันฝั่งเซิร์ฟเวอร์ด้วย `verifyOtp` เปิดจากที่ไหนก็ได้

| เทมเพลต | `type` | `next` |
|---|---|---|
| Confirm signup | `email` | `/onboarding` |
| Invite | `invite` | `/reset-password` (ให้ตั้งรหัสผ่าน) |
| Magic link | `magiclink` | `/dashboard` |
| Change email | `email_change` | `/dashboard` |
| Reset password | `recovery` | `/reset-password` |

## ข้อควรระวัง

- `{{ .SiteURL }}` ต้องเป็น `https://app.dealmee.app` (Authentication → URL Configuration → Site URL)
  ทั้งลิงก์และโลโก้ (`/logos/dealmee-logo-horizontal.png`) อ้างจากค่านี้
- `type` ในลิงก์ต้องตรงกับเทมเพลต ถ้าผิด `verifyOtp` จะปฏิเสธ
- Change email: ถ้าเปิด "Secure email change" Supabase ส่งอีเมลนี้ไปทั้งอีเมลเก่าและใหม่ ต้องกดยืนยันทั้งสองฉบับ
