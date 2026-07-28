# Botify AI — Agent Architecture Upgrade (Master Plan)

> ร่างเมื่อ: 28 กรกฎาคม 2026 | ปรับปรุงใหญ่: 28 กรกฎาคม 2026 (เพิ่มบทเรียนจาก 3 โปรเจคเดิม + วางแผนละเอียดครบ 5 หัวข้อ)
> สถานะเอกสาร: **แผนละเอียดครบทั้ง 5 หัวข้อแล้ว — พร้อมให้ AI เซสชันไหนก็ได้หยิบไปทำต่อได้ทันที โดยไม่ต้องมีบริบทจากการสนทนาเดิม**
> ความคืบหน้า: **3/5 เสร็จแล้ว** (Customer Memory Graph, Model Router, Planning Layer — 28 กรกฎาคม 2026) — เหลือ verification จริง (Playground + LINE จริง) ก่อนขึ้น production, และ Sales Workflow Engine, Evaluation Framework
>
> **เอกสารนี้คือ single source of truth สำหรับสถาปัตยกรรม AI Agent ของ Botify SaaS**
> ถ้าเป็น AI ที่เพิ่งเข้ามาทำงานนี้ครั้งแรก อ่านเอกสารนี้ทั้งหมดก่อนเริ่มโค้ดใดๆ แล้วอ่าน `PROJECT_STATUS.md` (สถานะปัจจุบันของทั้งโปรเจค) กับ `ROADMAP.md` (แผนธุรกิจ/ฟีเจอร์ที่ไม่ใช่ AI-core) ประกอบ

---

## 0. เป้าหมายของโปรเจคนี้ (สำคัญที่สุด — อ่านก่อน)

ผู้ใช้ (เจ้าของโปรเจค) กำลังพยายามสร้าง **AI Agent ผู้ช่วยการขายที่ทำงานเหมือนพนักงานขายจริง** ให้เป็น SaaS ที่ใช้งานได้จริงและสร้างรายได้จริง — **นี่คือความพยายามครั้งที่ 4** ของผู้ใช้ (สามครั้งก่อนหน้าถูกทิ้งไปเพราะพัฒนาไปเรื่อยๆ จนความไม่สอดคล้องกันสะสมมากเกินจะแก้ไข ใช้งานจริงไม่ได้ เสียเวลาและงบประมาณไปมาก) เอกสารนี้มีอยู่เพื่อ**ป้องกันไม่ให้เกิดซ้ำเป็นครั้งที่ 5**

**กฎเหล็ก 5 ข้อที่ห้ามฝ่าฝืน** (สรุปจากบทเรียนในหัวข้อ 1 ด้านล่าง):
1. **อย่าเพิ่ม service/ภาษาใหม่เข้าไปในสถาปัตยกรรม** — โปรเจคนี้เป็น Next.js monolith เดียว deploy บน Vercel จงใจให้เรียบง่าย ห้ามเพิ่ม Python microservice, ห้ามแยกเป็น multi-repo, ห้ามใช้ Docker/Redis เว้นแต่จำเป็นจริงๆ และต้องมีเหตุผลชัดเจนที่บันทึกไว้ในเอกสารนี้ก่อน
2. **ฟีเจอร์ที่สร้างต้องใช้ได้กับทุกช่องทางจากจุดเดียว** — ห้ามสร้าง logic ซ้ำต่อช่องทาง (LINE/FB/Web Widget) เหมือนที่เกิดใน `aisalesassistant-main` (tool-calling loop ถูกสร้างแค่ใน web widget ไม่เคยไปถึง LINE ซึ่งเป็นช่องทางหลัก) — ให้ logic หลักอยู่ใน `salesAgentEngine.ts` แห่งเดียว ช่องทางต่างๆ แค่เรียกใช้
3. **ออกแบบ multi-tenant (RLS ตาม shop_id) ตั้งแต่ migration แรกของทุกตารางใหม่ ห้ามลืมแล้วมา retrofit ทีหลัง** — `aisalesassistant-main` ล่มเพราะลืมออกแบบ multi-tenancy ตั้งแต่ต้น แล้วพอจะ retrofit ทีหลังกลับใหญ่เกินจะ merge (ดูหัวข้อ 1.1)
4. **ห้ามเขียน script แก้ไฟล์แบบ regex-patch (เช่น `patch_agent.cjs` ใน aisalesassistant-main)** — ถ้าจะแก้โค้ด ให้แก้ไฟล์ตรงๆ ด้วย Edit tool เท่านั้น
5. **ตรวจสอบ schema ฐานข้อมูลจริงก่อนเขียน SQL migration ใหม่เสมอ** — รัน `supabase/tools/check_schema.sql` ก่อนเขียน SQL ใหม่ทุกครั้ง (พบมาแล้วหลายรอบในเซสชันนี้ว่า schema จริงไม่ตรงกับไฟล์ `supabase/migrations/20260701000000_initial_schema.sql` เดิม)

---

## 1. บทเรียนจาก 3 โปรเจคเดิมที่เคยลองทำมาก่อน

ผู้ใช้มีโปรเจคเดิม 3 ตัวที่เคยลองทำแนวทางนี้มาก่อน อยู่ที่:
- `C:\Users\Jack\Documents\aisalesassistant-main\aisalesassistant-main` (ความพยายามครั้งที่ 1 — เก่าสุด)
- `C:\Users\Jack\Documents\botify-v5-hybrid` (ความพยายามครั้งที่ 2 หรือ 3 — Node+Python+React hybrid)
- `C:\Users\Jack\Documents\chatbot-agent-V6\chatbot-agent-main` (แยกออกมาจาก v5-hybrid แล้วหยุดสร้างฟีเจอร์ไปทำเอกสาร governance)

ตรวจสอบทั้ง 3 โปรเจคอย่างละเอียดแล้วเมื่อ 28 กรกฎาคม 2026 สรุปบทเรียนที่ต้องจำไว้:

### 1.1 `aisalesassistant-main` — สร้างด้วย Lovable.dev (no-code AI builder), ล่มเพราะลืม multi-tenancy
- สร้างด้วย Vite+React+Supabase Edge Functions ผ่าน Lovable.dev เป็นหลัก ไม่มี git repo เลย (ไม่มีการ track version ใดๆ)
- มี AI tool-calling loop ที่ทำงานจริง (`agentTools`: search_products, get_active_promotions, take_order, book_appointment, วนสูงสุด 3 รอบ, มี fallback chain 5 providers) — **แต่สร้างไว้แค่ใน web-embed chat widget ไฟล์เดียว ไม่เคยเอาไปใช้กับ LINE webhook เลย** (LINE webhook เป็นแค่ fetch AI ครั้งเดียวจบ ไม่มี tool loop) — ทั้งที่ LINE คือช่องทางหลักของสินค้านี้ **นี่คือกฎเหล็กข้อ 2**
- **ไม่มี multi-tenancy เลย** — ไม่มีคอลัมน์ `store_id`/`tenant_id` ในตารางหลักใดๆ เป็นระบบ single-store เท่านั้น ทั้งที่เป้าหมายคือ SaaS หลายร้าน
- พบไฟล์ `tmp/files_7.zip` ที่มี migration `20260319000001_rls_multitenant.sql` (เพิ่ม multi-tenancy) **ที่ไม่เคยถูก merge เข้าโปรเจคจริงเลย** — เป็นหลักฐานชัดว่าผู้พัฒนาลองจะ retrofit multi-tenancy ทีหลังแต่มันใหญ่/เสี่ยงเกินจะรวมเข้ากับโค้ดที่มีไฟล์ยาว 3,000-4,500 บรรทัดต่อไฟล์อยู่แล้ว จนต้องเลิกและเริ่มใหม่ **นี่คือกฎเหล็กข้อ 3**
- พบ `patch_agent.cjs` — script ที่ใช้ regex แก้ไฟล์ source โดยตรง แทนที่จะแก้ไฟล์ตรงๆ เป็นสัญญาณของโค้ดที่ใหญ่/ยุ่งเกินจะแก้ด้วยมือได้อย่างปลอดภัยแล้ว **นี่คือกฎเหล็กข้อ 4**
- **สิ่งที่เอามาใช้ได้:** แนวคิด step-loop (`for step < 3`) + provider fallback chain, และโครง `stores`/`get_my_store_id()` RLS pattern จาก migration ที่ไม่เคย merge (เป็นจุดเริ่มต้นที่ดีสำหรับออกแบบ schema ใหม่)

### 1.2 `botify-v5-hybrid` — โปรเจคที่มีฟีเจอร์ครบสุดใน 3 ตัว แต่หนี้ทางเทคนิคหนัก
- สถาปัตยกรรม Node/Express + Python FastAPI (RAG) + React/Vite + Redis + Docker — 159 commits, พัฒนาต่อเนื่องจริงเกือบ 2 เดือน มีฟีเจอร์เกือบครบ: LINE+FB+IG+Shopee+Lazada, RAG จริงด้วย vector embeddings, Voice Agent (Whisper), 17 business persona, Stripe+Omise billing, Redis caching
- **แต่จุดขายหลักที่โฆษณาไว้ ("Python AI Brain" multi-agent) พังจริง** — โค้ด import package ชื่อ `google-antigravity` ที่แทบเป็นไปไม่ได้ที่จะติดตั้งได้จริง (`try/except ImportError` แค่ print warning ไม่ fallback จริง) ระบบที่ทำงานได้จริงคือ logic ธรรมดาฝั่ง Node เท่านั้น — บทเรียน: **อย่าโฆษณา/พึ่งพา dependency ที่ไม่ได้ verify ว่ามีจริงและติดตั้งได้**
- **root directory มี 45 ไฟล์ `fix_*.js`/`check_*.js`/`debug_*.js` วางเกะกะ** — สัญญาณของการแก้ปัญหาหน้างานแบบเร่งด่วนสะสมมานาน แทนที่จะทำเป็น migration/test ที่เป็นระบบ — เอกสารนี้เขียนขึ้นเพื่อป้องกันไม่ให้ `botify-saas-web` เดินตามรอยนี้ (ดูหัวข้อ "สัญญาณเตือน" ด้านล่าง)
- ไม่มี CI/CD, ไม่มี automated test suite จริง (มีแต่ script debug มือ)
- schema.sql มีตารางถูกนิยามซ้ำ 2 รอบ (`promotions`, `chat_logs`, `bookings`) — สัญญาณไฟล์ schema ถูกต่อเติมสะสมโดยไม่จัดระเบียบ
- **สิ่งที่เอามาใช้ได้:** pattern การเซ็น HMAC ของ Shopee/Lazada API, Omise PromptPay QR flow ในบริบท AI tool, Redis-with-in-memory-fallback pattern (เขียนดีมาก แม้ตอนนี้ยังไม่จำเป็นต้องใช้ Redis)

### 1.3 `chatbot-agent-V6` — ติดหล่ม "วางแผนเยอะเกินจนไม่ได้ทำงานจริง"
- ไม่ใช่โปรเจคที่พัฒนาต่อจาก v5-hybrid จริง — เป็น branch ที่แยกออกมา ณ จุดหนึ่งเมื่อ 4 ก.ค. (ก่อน v5-hybrid จะทำ "Pre-V6 Security Sprint" ต่อเองแยกทาง) แล้วไปทำเอกสาร governance/ADR (15 ชิ้น) แทนที่จะสร้างฟีเจอร์ — `FEATURES.md` เหมือน v5-hybrid ทุกตัวอักษร, `README.md` ยังเขียนว่า "V5 Hybrid" อยู่
- มี `evaluation/` directory แต่ **ไม่ใช่ระบบวัดผลจริง** — เป็นแค่ validator เช็ค format ของ test case 30 ชุด (เช็คว่า field ครบ, tool name อ้างอิงถูกต้อง) ไม่มีการรันจริงกับ AI/วัด conversion/CSAT/cost เลย
- Staging deployment: **NO-GO ทุก gate ทั้ง 12 อัน** ไม่เคย deploy จริงแม้แต่ครั้งเดียว ไม่มีใครเซ็นอนุมัติปล่อยของ
- บทเรียน: **การวางแผน/เอกสารมากเกินไปโดยไม่ ship ของจริง ก็เป็นความล้มเหลวเหมือนกัน** เอกสารนี้จึงเน้นให้มีรายละเอียดพอที่จะ "ลงมือทำได้ทันที" ไม่ใช่แค่ framework/governance ลอยๆ

### สัญญาณเตือน: `botify-saas-web` (โปรเจคปัจจุบัน) เริ่มมีอาการคล้าย v5-hybrid แล้ว — ✅ แก้แล้ว (28 กรกฎาคม 2026)
ระหว่างพัฒนา Phase 2 (Billing) พบปัญหา schema drift ระหว่างไฟล์ SQL กับฐานข้อมูลจริงถึง 3 รอบ และแก้ด้วยการสร้างไฟล์ SQL แยกไว้ที่ root (`supabase_check_schema.sql`, `supabase_seed_test_products.sql` ฯลฯ) — **นี่คือรูปแบบเดียวกับ 45 ไฟล์ debug script ของ v5-hybrid** ถ้าปล่อยไว้โดยไม่จัดระบบจะสะสมเป็นปัญหาเดียวกัน

**แก้แล้ว:** ย้าย SQL ทั้งหมดออกจาก root เข้า `supabase/migrations/` (ไฟล์ schema/phase ตามลำดับเวลา) และ `supabase/tools/` (script ตรวจสอบ/seed ที่ไม่ใช่ migration) พร้อมเขียน `supabase/README.md` อธิบายธรรมเนียมการใช้งาน — ดูรายละเอียดที่ `supabase/README.md` โดยตรง ยังไม่ได้เพิ่ม automated test สำหรับ tool dispatcher (ยังเป็นข้อเสนอแนะที่ค้างอยู่ ไม่ใช่ blocker)

### สัญญาณเตือนอีกครั้ง: เกือบแยก deploy ไป Railway ("สมอง AI" แยกจากเว็บ) — ✅ ตัดสินใจแล้วว่าไม่ทำ (28 กรกฎาคม 2026)
ผู้ใช้ deploy โปรเจคนี้ (repo/โค้ดชุดเดียวกัน ไม่ได้แยก root) ขึ้นทั้ง Vercel และ Railway พร้อมกัน โดยตั้งใจจะให้ Railway รับหน้าที่ "สมอง AI" (ประมวลผลแชท) ส่วน Vercel รับหน้าที่เว็บร้านค้า/แอดมิน — ตามคำแนะนำที่เคยได้รับตอนทำ `botify-v5-hybrid` (เหตุผลตอนนั้นคือกลัว Vercel "หลับ" ตอบข้อความลูกค้าไม่ได้) ตรวจสอบโค้ดทั้งโปรเจคแล้วไม่พบการอ้างถึง Railway หรือ `NEXT_PUBLIC_AI_AGENT_SERVICE_URL` (ตัวแปรที่ตั้งไว้ใน Vercel) เลยสักที่ — ระบบทั้งหมดรันอยู่บน Vercel เดียว 100% อยู่แล้วในทางปฏิบัติ Railway เป็นแค่ deployment ที่ไม่มีอะไรเรียกใช้

**เหตุผลที่ตัดสินใจไม่แยก (ยืนยันกฎเหล็กข้อ 1):**
1. Vercel serverless ไม่ได้ "หลับ" แล้วตอบไม่ได้ — scale ลง 0 ตอนไม่มีคนใช้แล้ว spin ขึ้นมาใหม่ตอนมี request (cold start เพิ่ม latency ~0.1-2 วิ ไม่ใช่ตอบไม่ได้เลย) ข้อจำกัดจริงคือ **เวลาทำงานสูงสุดต่อ request** (`maxDuration`) ซึ่งแก้ได้ด้วยการตั้งค่าใน route handler โดยไม่ต้องเพิ่ม service
2. LINE webhook เป็น request/response ธรรมดา ไม่ใช่งานที่ต้องมี process ค้างตลอดเวลาแบบ WebSocket/queue worker — ไม่มีเหตุผลทางเทคนิคที่ต้องมี server "ไม่เคยหลับ" แยกต่างหาก
3. ถ้าแยกจริง Vercel ต้องยิง request ต่อไป Railway อีกที **เพิ่ม** latency (network hop เพิ่ม) ตรงข้ามกับที่ต้องการ
4. **สำคัญที่สุด:** งาน Async Ack/Push ของ Planning Layer (หัวข้อ 6) ออกแบบให้ `PlanningState` (มี Supabase client, `ToolExecutor` function reference ฯลฯ) อยู่ใน process เดียวกันตลอดการทำงาน — ถ้าแยก AI ไป Railway จริง ต้องรื้อ design ทั้งหมดใหม่เพราะ object พวกนี้ส่งข้าม HTTP ไม่ได้ (serialize เป็น JSON ได้แต่ function/client ไม่ได้)

**คำแนะนำที่ให้ไปและผู้ใช้เห็นด้วย:** ลบ `NEXT_PUBLIC_AI_AGENT_SERVICE_URL` ออกจาก Vercel env vars (dead config ไม่มีโค้ดใช้), ปิด Railway deployment, ถ้าจะกังวลเรื่อง timeout ให้ตั้ง `maxDuration` ในไฟล์ webhook route แทน — ทั้งหมดนี้เป็นงานฝั่ง infrastructure ที่ผู้ใช้ต้องทำเองผ่าน Vercel/Railway dashboard

---

## 2. ภาพรวมสถาปัตยกรรม: ตอนนี้ vs เป้าหมาย

**ตอนนี้ (single-shot):**
```
ข้อความลูกค้า -> classifyMessageComplexity() [keyword match]
            -> เลือก provider + tool set
            -> เรียก AI 1 ครั้ง (พร้อม system prompt + context แบบ text)
            -> ถ้า AI เลือก tool -> dispatch 1 ครั้งจบ (ไม่มีการส่งผลลัพธ์กลับให้ AI คิดต่อ)
            -> ตอบลูกค้า
```

**เป้าหมาย (stateful multi-step agent):**
```
ข้อความลูกค้า -> Model Router [ปรับปรุงจาก keyword ธรรมดา -> คะแนนความซับซ้อน]
            -> โหลด Customer Memory Graph (โปรไฟล์ลูกค้าข้ามบทสนทนา) ✅ มีแล้ว
            -> Sales Workflow Engine กำหนด stage ปัจจุบันของบทสนทนานี้
            -> Planning Layer วางแผนหลายสเต็ป (เรียกหลาย tool ต่อเนื่องกัน ส่งผลลัพธ์กลับเข้า context)
            -> Dispatch tools ตามแผน (มี step limit คุม cost/latency)
            -> ตอบลูกค้า (ผ่าน LINE reply ทันที + push ถ้าเป็น multi-step) + อัปเดต Customer Memory Graph + บันทึก stage transition
            -> Evaluation Framework log ต้นทุน/ผลลัพธ์ของบทสนทนานี้
```

**กลไกสำคัญที่มีอยู่แล้วและควรใช้ต่อยอด (อย่าคิดใหม่):** เว็บฮุคปัจจุบันมี pattern "ตอบทันทีด้วย replyToken + ทำงานหนักแบบ async เบื้องหลังแล้ว push ผลจริงทีหลัง" อยู่แล้วจริง — ดู `verifySlipAndNotify()` ใน `src/app/api/webhook/[shop_id]/route.ts` (เรียกแบบ `.catch()` ไม่ await ทำงานเบื้องหลัง แล้ว push ผลลัพธ์สุดท้ายด้วย LINE Push API) **Planning Layer ควรใช้กลไกเดียวกันนี้เป๊ะ** ไม่ต้องคิดกลไกใหม่สำหรับปัญหา latency ของ multi-step loop

---

## 3. ลำดับการพัฒนาที่แนะนำ

```
1. Customer Memory Graph   ✅ เสร็จแล้ว (28 กรกฎาคม 2026)
2. Model Router ปรับปรุง   ✅ เสร็จแล้ว (28 กรกฎาคม 2026)
3. Planning Layer          ✅ เสร็จแล้ว (28 กรกฎาคม 2026) — เหลือแค่ verification จริง (ดูหัวข้อ 6)
4. Sales Workflow Engine   ← เริ่มได้เลย (Planning Layer พร้อมแล้ว)
5. Evaluation Framework    ← ทำบางส่วนได้ทันที (conversion rate พื้นฐาน) ส่วนที่เหลือรอ Workflow Engine
```

---

## 4. Model Router — ตรวจสอบของเดิม + แผนปรับปรุง

### สถานะ: ✅ เสร็จแล้ว (28 กรกฎาคม 2026) — ทำครบทั้งขั้นที่ 1 และ 2 ตามแผนเดิม

**สิ่งที่แก้จริง:**
- แก้ dead code GPT-5.6: `classifyMessageComplexity()` ตอนนี้ route HIGH complexity ไป Claude ก่อน (ถ้ามี key) → GPT-5.6 Luna เป็น fallback จริง (ถ้า Claude ไม่มี key) → Gemini เป็นตัวสุดท้าย — ทดสอบผ่าน `npx tsc --noEmit` + `npm run build` แล้วผ่าน 100%
- ขยาย `NEGOTIATION_KEYWORDS` เพิ่ม 7 คำ/วลี ("พอลดได้ไหม", "ราคาพิเศษ", "ซื้อเยอะลดไหม", "งบไม่พอ", "แพงไป", "ลดหน่อย", "ขอราคาพิเศษ")
- เปลี่ยนจาก binary เป็น score-based: ฟังก์ชันใหม่ `computeComplexityScore()` (pure, DB-free, ทดสอบแยกได้) คำนวณคะแนนจาก negotiation keyword (+2/คำ), ความยาวข้อความ >100 ตัวอักษร (+1), มีตัวเลขในข้อความ (+1), negotiation keyword ใน 3 ข้อความล่าสุดของลูกค้า (+1/ข้อความ), VIP (+2) — threshold `HIGH_COMPLEXITY_THRESHOLD = 3` (export ไว้ปรับได้ง่ายทีหลัง)
- ผูกกับ Customer Memory Graph จริง: เพิ่ม `getCustomerProfileSummary()`/`isVipProfile()`/`formatCustomerProfileContext()` ใน `src/lib/customerMemory.ts` (แยกจาก DB fetch เดิมที่เคยทำทั้ง fetch+format ในฟังก์ชันเดียว) เพื่อให้ `processSalesAgentChat` fetch โปรไฟล์ลูกค้าครั้งเดียวแล้วใช้ได้ทั้งสร้าง context text (เหมือนเดิม) และเช็ค VIP สำหรับ routing (`VIP_SPEND_THRESHOLD_THB = 5000`) — ไม่มีการ query ซ้ำซ้อน
- Log routing decision ปรับปรุง: `console.log` ตอนนี้แสดง complexity score และสถานะ VIP ด้วย (`[Botify Brain™] "..." | HIGH (score 5) | CLAUDE | Tools: 27 | VIP customer`) — **ตัดสินใจแล้วว่ายังไม่สร้างตาราง log ถาวรตอนนี้** (ตามแผนเดิมที่เขียนไว้คลุมเครือ) เพราะ Evaluation Framework (หัวข้อ 8) จะออกแบบ schema การเก็บข้อมูลแบบละเอียด (`chat_messages.tokens_used` ฯลฯ) อยู่แล้ว การสร้างตาราง log แยกตอนนี้จะทำให้มี migration ซ้ำซ้อนสองรอบสำหรับจุดประสงค์ใกล้เคียงกัน — เมื่อถึงหัวข้อ Evaluation Framework ให้พิจารณาเพิ่มคอลัมน์ `complexity_score`/`routed_provider` ใน `chat_messages` ไปพร้อมกับ `tokens_used` ในครั้งเดียว

**ไฟล์ที่แก้:** `src/lib/ai/salesAgentEngine.ts` (classifier + call site), `src/lib/customerMemory.ts` (เพิ่ม summary/VIP/formatter functions)

**สิ่งที่ตัดสินใจไม่ทำในรอบนี้ (นอกขอบเขต):** ยังไม่ทำ persistent routing-decision table (เหตุผลด้านบน)

### บันทึกอ้างอิง — สถานะเดิมก่อนแก้ (เก็บไว้เป็นประวัติ)
`classifyMessageComplexity()` ใน `src/lib/ai/salesAgentEngine.ts:628` — ใช้ keyword matching ภาษาไทย 3 ลิสต์ (ต่อรองราคา/จอง/ซัพพอร์ต) แบ่งความซับซ้อนแค่ 2 ระดับ (LOW/HIGH) ไม่มี confidence score, route HIGH ไป Claude เท่านั้น (ถ้ามี key) ที่เหลือไป Gemini เสมอ

### จุดอ่อนที่พบ
1. **Keyword list แคบเกินไป** — ประโยคต่อรองที่ไม่ใช้คำในลิสต์ (เช่น "พอลดให้ได้บ้างมั้ยคะ ซื้อ 10 ชิ้น") จะหลุดไปเป็น LOW ทั้งที่ควรได้ Claude
2. **Binary complexity ไม่มี nuance** — บทสนทนาต่อรอง/ปิดการขายที่ซับซ้อนแต่ไม่ใช้คำในลิสต์เป๊ะๆ จะไปที่ Gemini ราคาถูกโดยไม่ได้ตั้งใจ
3. **GPT-5.6 ตายจริง (bug ที่พบระหว่างการวิเคราะห์ margin ก่อนหน้านี้)** — `classifyMessageComplexity()` ไม่เคย return `targetProvider: 'openai'` เลย โค้ด `else if (routing.targetProvider === 'openai' ...)` ใน `processSalesAgentChat` เป็น dead code ถาวร
4. **ไม่ผูกกับ Customer Memory Graph** — ลูกค้า VIP (ยอดซื้อสะสมสูง, มี tag "VIP") ควรได้ Claude แม้ข้อความจะดูง่าย แต่ตอนนี้ไม่ได้เอาข้อมูลนี้มาพิจารณาเลย ทั้งที่ข้อมูลนี้มีอยู่แล้วใน `customer_profiles` (จาก Customer Memory Graph ที่เพิ่งสร้าง)

### แผนปรับปรุง (เรียงตามผลกระทบ/ความเสี่ยง)

**ขั้นที่ 1 — แก้ทันที ความเสี่ยงต่ำสุด:**
- แก้ dead code ของ GPT-5.6: ตัดสินใจแล้วว่า **ให้ GPT-5.6 Luna ทำหน้าที่ fallback เมื่อ Claude ไม่มี key/ไม่ได้ตั้งค่า** (ไม่ใช่ route ตรงจาก classifier) — แก้ `classifyMessageComplexity()` เป็น `targetProvider: claudeKeyExists ? 'claude' : (openAiKeyExists ? 'openai' : 'gemini')` สำหรับ HIGH complexity เท่านั้น (LOW ยังคงไป Gemini เสมอ เพราะถูกสุดและพอสำหรับงานง่าย)
- ขยาย keyword list ให้ครอบคลุมมากขึ้น (เพิ่มคำ/วลีสัมภาษณ์เพิ่มเติม เช่น "พอลดได้ไหม", "ราคาพิเศษ", "ซื้อเยอะลดไหม", "งบไม่พอ", "แพงไป") — ยังคงไม่มีต้นทุน AI เพิ่ม เพราะเป็น string matching ธรรมดา

**ขั้นที่ 2 — เปลี่ยนจาก binary เป็น score-based (ยังไม่ต้องเรียก AI เพิ่ม):**
- เปลี่ยน `classifyMessageComplexity` ให้คำนวณคะแนนความซับซ้อนแทนบูลีน: นับจำนวน negotiation keyword ที่ตรง (+2 ต่อคำ), ความยาวข้อความ (>100 ตัวอักษร +1), มีตัวเลข/ราคาปรากฏในข้อความ (+1), ประวัติแชท 3 ข้อความล่าสุดมี negotiation keyword ด้วยไหม (+1 ต่อข้อความ) — รวมคะแนนแล้วตั้ง threshold (เช่น ≥3 = HIGH)
- ผูกกับ Customer Memory Graph: ถ้า `customer_profiles.tags` มี "VIP" หรือ `total_spend` เกิน threshold ที่ตั้งไว้ (เช่น 5,000 บาท) ให้ +2 คะแนนเสมอ ไม่ว่าข้อความจะพูดอะไร — ใช้ `getCustomerProfileContext`-style query แบบเบาๆ (แค่ tags/total_spend ไม่ต้อง fetch ทั้ง context) มาช่วยตัดสินใจ routing
- **สำคัญ:** ต้อง log ผลการตัดสินใจ routing ทุกครั้งลงตารางที่ Evaluation Framework จะใช้ (ดูหัวข้อ 8) เพื่อในอนาคตจะวิเคราะห์ย้อนหลังได้ว่า routing แบบไหนทำให้ปิดการขายได้ดีกว่า

**Definition of Done:** ไม่มี dead code เหลือใน routing logic, มี unit-testable scoring function (แยกออกจาก `classifyMessageComplexity` เป็นฟังก์ชันคำนวณคะแนนล้วนๆ ทดสอบได้โดยไม่ต้องแตะ DB), routing decision ถูก log ไว้สำหรับ Evaluation Framework

---

## 5. Customer Memory Graph — ตรวจสอบของเดิม + แผนต่อยอด

### สถานะ: ✅ เสร็จแล้ว (28 กรกฎาคม 2026) — ทำงานได้จริง ตรวจสอบแล้ว

โครงสร้าง: ตาราง `customer_profiles` (shop_id+user_id unique) เก็บ tags/notes แบบ append-only (jsonb), preferences (jsonb), total_orders/total_spend/last_order_at อัปเดตอัตโนมัติ, auto-inject เข้า system prompt ทุกข้อความผ่าน `getCustomerProfileContext()` ไฟล์หลัก: `supabase/migrations/20260728030000_phase3_customer_memory.sql`, `src/lib/customerMemory.ts`

### จุดที่ควรปรับปรุงให้สมบูรณ์ขึ้น

1. **`notes` jsonb array ไม่มีการจำกัดขนาด** — เพิ่มไปเรื่อยๆ ไม่มีเพดาน ถ้าลูกค้าคุยนานหลายเดือนจะทำให้ row ใหญ่ขึ้นเรื่อยๆ และ `getCustomerProfileContext()` ตอนนี้ตัดแค่ 5 อันล่าสุดตอนแสดงผล (ป้องกัน prompt ยาวเกินไปแล้ว) **แต่ตัวเก็บใน DB ยังไม่ตัด** — ควรเพิ่ม logic ใน `append_customer_note()` (SQL function) ให้ตัด array เหลือ 50 รายการล่าสุดทุกครั้งที่ append (`notes = (notes || jsonb_build_array(...))[greatest(0, jsonb_array_length(notes)-49):]` หรือใช้ subquery แบบง่ายกว่า) เพื่อกัน row โตไม่จำกัด
2. **ไม่มี AI tool เขียน `preferences` โดยตรง** — มีฟังก์ชัน `updateCustomerPreference()` ใน `customerMemory.ts` แล้วแต่ไม่มี tool ให้ AI เรียกใช้ ควรเพิ่ม tool ใหม่ `update_customer_preference(key, value)` ใน `MASTER_TOOLS` (เช่น key="size", value="L" หรือ key="favorite_color", value="แดง") ตาม pattern เดียวกับ `update_customer_note`/`add_customer_tag` ที่มีอยู่แล้ว — แก้ 3 จุด: (a) เพิ่ม tool definition ใน `salesAgentEngine.ts`, (b) เพิ่มใน tool-set ที่เกี่ยวข้อง (SALES_TOOL_NAMES เป็นอย่างน้อย), (c) เพิ่ม dispatcher branch ใน webhook route เรียก `updateCustomerPreference()`
3. **ไม่มี UI ใน dashboard แสดงโปรไฟล์ลูกค้า** — ตอนนี้ AI เห็นข้อมูลนี้แต่เจ้าของร้านไม่เห็นเลย ควรเพิ่มส่วนแสดงผลใน `/dashboard/inbox` (เมื่อเลือกดูบทสนทนาของลูกค้ารายหนึ่ง ให้แสดง tags/notes/preferences/total_spend ข้างๆ ด้วย) เพื่อให้เจ้าของร้านเห็นว่า AI จำอะไรเกี่ยวกับลูกค้าคนนี้ไว้บ้าง (เพิ่มความน่าเชื่อถือของฟีเจอร์ และช่วย debug ได้ง่ายขึ้นด้วย)
4. **ไม่มีการแยกประเภท note ตามความคงทน** — note เช่น "แพ้กุ้ง" (ข้อมูลถาวร) กับ "อยากได้สีแดง" (preference ชั่วคราวที่อาจเปลี่ยนได้) ถูกเก็บปนกันหมด อาจพิจารณาเพิ่ม field `category` ใน note object (`{text, created_at, category: 'permanent'|'preference'|'session'}`) ในอนาคต — **ยังไม่ต้องทำตอนนี้** เป็นแค่แนวทางถ้าพบว่าข้อมูลปนกันจนสร้างปัญหาจริง

**Definition of Done ของงานต่อยอดนี้:** ข้อ 1 (จำกัดขนาด notes) ควรทำก่อนเพราะป้องกันปัญหาระยะยาว, ข้อ 2 (tool ใหม่) และข้อ 3 (UI) ทำเมื่อสะดวก ไม่ block อะไร

---

## 6. Planning Layer — แผนละเอียด

### สถานะ: ✅ เสร็จแล้ว (28 กรกฎาคม 2026) — เหลือ verification จริงก่อนขึ้น production (ดูหัวข้อ "ยังไม่ได้ทำ" ด้านล่าง)

**สิ่งที่ทำเสร็จจริง (Phase A + B ตามแผนเดิม):**
- **Phase A** — สร้าง `src/lib/ai/toolDispatcher.ts` (channel-agnostic, ไม่รู้จัก LINE เลย): `ToolExecutionContext`, `CustomerMessage`, `ToolExecutionResult` (`{resultForAi, immediateMessages[], scheduledMessage?}` — เป็น array ไม่ใช่ optional เดี่ยวเหมือนร่างเดิม เพราะบาง tool เช่น `send_payment_qr` ต้องส่งทั้งรูปและ caption 2 ข้อความ), `ToolExecutor` type, `executeTool()` ย้าย logic ทั้ง 17 กิ่งจาก webhook route มาไว้ที่นี่ (รวม `generateAndUploadQR` ด้วย) — webhook route แก้ให้เรียก `executeTool()` แทน ยืนยันด้วย `npx tsc --noEmit` + `npm run build` ผ่านก่อนเริ่ม Phase B (ตามที่แผนกำหนดให้ checkpoint ตรงนี้)
- **Phase B** — เพิ่ม `PlanningTurn` type (discriminated union `user`/`assistant`/`tool_result`) ใน `salesAgentEngine.ts`, เขียน `buildGeminiContents`/`buildClaudeMessages`/`buildOpenAiMessages` แปลง `PlanningTurn[]` เป็น wire format ของแต่ละ provider (Gemini ต้องการ `functionResponse.id` ตรงกับ `functionCall.id` ของ model เป๊ะ — เป็น requirement ใหม่ของ Gemini 3.6 ที่ verify ผ่าน WebSearch, **ยังไม่ได้ทดสอบจริงกับ live API** ดูหัวข้อ "ยังไม่ได้ทำ" ด้านล่าง), เพิ่ม loop ใน `processSalesAgentChat` (`MAX_PLANNING_STEPS = 3`, เหมือนแผนเดิมทุกอย่าง) พร้อม pluggable `toolExecutor?: ToolExecutor` (ไม่มีในร่างเดิม — เพิ่มเพราะ Chat Playground ต้องพรีวิว tool call ไม่ใช่ execute จริง ดูด้านล่าง)
- **Chat Playground** (`src/app/dashboard/settings/actions.ts`) แก้ให้ inject `previewToolExecutor` (adapt จาก `previewToolCall` เดิม) แทนการ execute จริง — read-only lookups (search_products/check_stock/get_active_promotions) รันจริงกับ DB, update_customer_note/add_customer_tag รันจริง (safe append), ที่เหลือ preview-only (บอก AI ว่า "สำเร็จ" เพื่อให้วางแผนต่อได้ แต่ไม่มี side effect จริง)
- Usage accounting: sum `promptTokens`/`completionTokens`/`totalTokens`/`cacheReadTokens`/`cacheWriteTokens` จากทุก step ก่อน return ครั้งเดียว (ตามแผน)
- Step-limit exhaustion: flip `conversations.status = 'human'` จริง ไม่ใช่แค่บอกลูกค้าเฉยๆ
- ยืนยันด้วย `npx tsc --noEmit` + `npm run build` ผ่านสะอาดทั้งคู่

- **Async ack/push (28 กรกฎาคม 2026)** — `processSalesAgentChat` แยกภายในออกเป็น 3 เฟส: `preparePlanningState` (setup ทั้งหมด, ไม่เปลี่ยน), `runPlanningStep` (รัน 1 step, mutate `PlanningState`), `finalizeAgentResult` (sum usage แล้วสร้าง `AgentResult`) — `processSalesAgentChat` เดิมยังคงพฤติกรรมเดิมทุกอย่าง (Chat Playground เรียกใช้ตัวนี้ต่อไป ไม่ต้องแก้อะไร) แต่ตอนนี้มี 2 ฟังก์ชันใหม่ให้ webhook route ใช้แทน: `startSalesAgentPlanning()` (รันแค่ step แรก, คืนค่า `{done:true,result}` ถ้า AI ตอบจบใน 1 step หรือ `{done:false,state}` ถ้าต้องเรียก tool ต่อ) และ `continueSalesAgentPlanning(state)` (รันที่เหลือจนจบ) — webhook route ใช้สองฟังก์ชันนี้: ถ้า `done:true` reply ผ่าน `sendLineReply` เหมือนเดิมทุกอย่าง (ไม่กระทบ UX เคสส่วนใหญ่); ถ้า `done:false` ส่ง ack ("กำลังตรวจสอบให้สักครู่นะคะ...") ผ่าน `sendLineReply` ทันที (ใช้ replyToken ตอนยังสดอยู่) แล้วเรียก `continueSalesAgentPlanning(state)` แบบ fire-and-forget (`.then().catch()`ไม่ await) รัน step ที่เหลือเบื้องหลังแล้ว push คำตอบจริงด้วย `sendLinePush` เมื่อเสร็จ — ตรงตาม pattern ของ `verifySlipAndNotify` ที่มีอยู่แล้วเป๊ะ ไม่ได้คิดกลไกใหม่ ทั้ง sync/async path ใช้ helper กลาง `deliverAgentResult()` ตัวเดียว (บันทึก chat_messages/อัปเดต conversation/log tool call/เพิ่ม usage/ส่ง immediateMessages/ตั้ง scheduledMessages) ต่างกันแค่ว่าใช้ reply หรือ push สำหรับข้อความหลัก

**ไฟล์ที่แก้/เพิ่ม:** `src/lib/ai/toolDispatcher.ts` (ใหม่), `src/lib/ai/salesAgentEngine.ts` (types + 3 provider functions + loop แยกเป็น prepare/step/finalize + `startSalesAgentPlanning`/`continueSalesAgentPlanning`), `src/app/api/webhook/[shop_id]/route.ts` (ack/push branching + `deliverAgentResult()` helper), `src/app/dashboard/settings/actions.ts` (`previewToolExecutor`)

**ยังไม่ได้ทำ (ต้องทำก่อนไว้ใจใน production เต็มที่):**
1. **ยังไม่ได้ verify กับ Chat Playground จริง** (คำถามที่ต้องเรียก 2 tool ต่อกัน เช่น "มีรองเท้าไซส์ 42 ไหม ถ้ามีเอาเลย 1 คู่") และ**ยังไม่ได้ทดสอบผ่าน LINE จริง** — โดยเฉพาะ Gemini `functionResponse.id` ที่เป็น requirement ใหม่ ยังไม่เคย verify กับ live API เลย มีแค่ typecheck/build ผ่านเท่านั้น (ทำไม่ได้ในเซสชันนี้เพราะไม่มีเครื่องมือควบคุมเบราว์เซอร์/ส่งข้อความ LINE จริง)
2. **ack message ยังเป็นข้อความคงที่** ("กำลังตรวจสอบให้สักครู่นะคะ รอแป๊บนึงนะคะ 🙏") ไม่ได้ปรับตามบริบท — เพียงพอสำหรับตอนนี้ ปรับปรุงได้ทีหลังถ้าต้องการ

### เป้าหมาย
เปลี่ยนจาก "เรียก AI 1 ครั้ง ได้ tool call เดียวจบ" เป็น "AI วางแผนและเรียก tool ต่อเนื่องกันได้หลายขั้นตอนในข้อความเดียว" (เช่น ลูกค้าถาม "มีเสื้อยืดไซส์ L ไหม ถ้ามีเอา 2 ตัวเลย" → step 1: `search_products`/`check_stock` → step 2 (เห็นว่ามีของ): `take_order`)

### ทำไมต้องใช้กลไก reply+push แบบ async (ห้ามคิดใหม่)
LINE Reply API ใช้ `replyToken` ที่ใช้ได้ครั้งเดียวและมีเวลาจำกัด การวน AI loop หลายรอบ (แต่ละรอบคือ 1 API call ไปยัง Gemini/Claude/OpenAI ที่ใช้เวลาเป็นวินาที) อาจทำให้ตอบช้าเกินไปสำหรับ synchronous reply — เว็บฮุคปัจจุบัน**มี pattern แก้ปัญหานี้อยู่แล้ว** ใน `verifySlipAndNotify()` (ไม่ await, ทำงานเบื้องหลัง, จบแล้ว push ผลลัพธ์) **Planning Layer ต้องใช้ pattern เดียวกันนี้**

### สถาปัตยกรรมที่แนะนำ

**ขั้นตอนที่ 1 — แยก "การ execute tool" ออกจาก "การส่งข้อความหา LINE" (สำคัญที่สุด, ทำก่อนอย่างอื่น)**

ปัญหาปัจจุบัน: ตรรกะการ dispatch tool ทั้ง 17 กิ่งอยู่ใน `src/app/api/webhook/[shop_id]/route.ts` ปนกับการเรียก `sendLinePush`/`sendLineReply` โดยตรง (เช่น `search_products` query DB แล้ว push ข้อความทันทีในบล็อกเดียวกัน) ทำให้เรียกซ้ำใน loop ไม่ได้โดยตรง (จะ push ข้อความซ้ำทุก step)

แก้โดยสร้างไฟล์ใหม่ **`src/lib/ai/toolDispatcher.ts`** ที่มีฟังก์ชัน:
```ts
interface ToolExecutionContext {
  shopId: string
  userId: string
  conversationId: string
  shop: any // shop record
}

interface ToolExecutionResult {
  /** ข้อมูลที่ส่งกลับให้ AI ไปคิดต่อ (ไม่ใช่ข้อความหาลูกค้า) */
  resultForAi: string
  /** ถ้า tool นี้ต้องส่งอะไรให้ลูกค้าทันที (เช่น รูป QR) ให้ผู้เรียกจัดการ push เอง */
  immediateCustomerMessage?: { type: 'text' | 'image'; content: string }
}

export async function executeTool(
  toolName: AgentToolName,
  args: Record<string, any>,
  ctx: ToolExecutionContext
): Promise<ToolExecutionResult>
```
ย้าย logic ทั้ง 17 กิ่งจาก webhook route เข้ามาในฟังก์ชันนี้ (คง logic เดิมทุกอย่าง แค่เปลี่ยนจาก "push ข้อความตรงๆ" เป็น "return ค่าที่บอกว่าจะ push อะไร") จากนั้นแก้ webhook route ให้เรียก `executeTool()` แทนโค้ด if/else เดิม (เหมือนเดิมทุกอย่างสำหรับ non-multi-step case — งานนี้คือ refactor ไม่เปลี่ยนพฤติกรรม)

**ขั้นตอนที่ 2 — เพิ่ม loop ใน `processSalesAgentChat` (salesAgentEngine.ts)**

โครงสร้าง loop (ใช้กับทั้ง 3 provider โดยใช้ pattern เดียวกัน แต่ syntax การส่ง "tool result" กลับต่างกันตาม provider):
- Gemini: ส่ง `functionResponse` part กลับใน `contents` array ถัดไป
- Claude: ส่ง content block type `tool_result` พร้อม `tool_use_id`
- OpenAI: ส่ง message ที่มี `role: 'tool'`, `tool_call_id`

```ts
const MAX_PLANNING_STEPS = 3 // ตามที่ aisalesassistant-main เคยใช้และได้ผล (บทเรียนจากโปรเจคเดิม)

let steps = 0
let conversationTurns = [...] // เริ่มจากข้อความลูกค้า
let finalText = ''
let allUsage: AgentUsage[] = []

while (steps < MAX_PLANNING_STEPS) {
  const response = await callProviderApi(conversationTurns, ...)
  allUsage.push(response.usage)

  if (!response.toolCall) {
    finalText = response.text
    break // AI ตอบสุดท้ายแล้ว ไม่เรียก tool ต่อ
  }

  const result = await executeTool(response.toolCall.name, response.toolCall.args, ctx)
  // ถ้ามี immediateCustomerMessage ให้ push ทันที (ไม่ต้องรอ step สุดท้าย) เพื่อความรู้สึกเรียลไทม์
  if (result.immediateCustomerMessage) {
    await pushToCustomer(ctx.userId, result.immediateCustomerMessage) // ผ่าน callback ที่ webhook route ส่งเข้ามา
  }

  conversationTurns.push(assistantTurnWithToolCall, toolResultTurn(result.resultForAi))
  steps++
}

if (steps >= MAX_PLANNING_STEPS && !finalText) {
  finalText = 'ขออภัยค่ะ เรื่องนี้ซับซ้อนเกินกว่าจะตอบได้ในตอนนี้ รอสักครู่แอดมินจะติดต่อกลับนะคะ'
  // ควร trigger request_human_agent โดยอัตโนมัติด้วย ถ้าวนครบ step โดยไม่จบ
}
```

**ขั้นตอนที่ 3 — แก้ webhook route ให้รองรับทั้ง sync (คำตอบเดียวจบ, ส่วนใหญ่ของเคส) และ async (multi-step, ใช้ pattern เดียวกับ verifySlipAndNotify)**
- ถ้า planning loop จบภายใน 1 step (เหมือนพฤติกรรมปัจจุบัน) → ตอบผ่าน `sendLineReply` เหมือนเดิมทันที ไม่มีอะไรเปลี่ยน ไม่กระทบ UX ปัจจุบันเลย
- ถ้า loop ใช้มากกว่า 1 step → ส่ง `sendLineReply` ด้วยข้อความ acknowledgement สั้นๆ ทันที (เช่น "รอสักครู่นะคะ กำลังตรวจสอบให้ค่ะ...") แล้วรัน loop ที่เหลือแบบ non-blocking เหมือน `verifySlipAndNotify` จบแล้ว push คำตอบจริงทีหลัง
- **การตัดสินใจว่าจะ sync หรือ async**: รู้ได้ตั้งแต่ step แรกว่า AI ต้องการเรียก tool ต่อไหม (ถ้า step แรกได้ finalText เลยไม่ต้องรอ) — เขียนโค้ดให้เช็คหลัง step แรกจบ ถ้ายังไม่จบให้ reply แบบ ack ก่อนแล้วค่อยรัน steps ที่เหลือ

**ขั้นตอนที่ 4 — Usage/quota accounting ต้องรวมทุก step**
- `incrementUsage`/`incrementProviderUsage` ต้องถูกเรียกครั้งเดียวหลัง loop จบทั้งหมด โดยรวม token จากทุก step เข้าด้วยกัน (ไม่ใช่เรียกทุก step แยกกัน เพราะ `incrementUsage`'s `p_messages` หมายถึง "1 ข้อความจากลูกค้า" ไม่ใช่ "1 ครั้งที่เรียก AI") — sum `promptTokens`/`completionTokens`/`totalTokens` จาก `allUsage` array ก่อนเรียก increment

### Open Decision ที่ตัดสินใจไปแล้ว (ไม่ต้องถามซ้ำ)
- **Step limit = 3** — ตามบทเรียนจาก `aisalesassistant-main` ที่ใช้ค่านี้แล้วทำงานได้ผลจริง
- **ไม่ทำ streaming response** — เกินความจำเป็นตอนนี้ ใช้ reply+push ก็พอ

### Definition of Done
- `executeTool()` แยกออกมาเป็นไฟล์เดียว ใช้ได้ทั้งจาก webhook route (sync path เดิม) และจาก planning loop (multi-step path ใหม่)
- ทดสอบใน Chat Playground: ถามคำถามที่ต้องใช้ 2 tool ต่อกัน (เช่น "มีรองเท้าไซส์ 42 ไหม ถ้ามีเอาเลย 1 คู่") แล้วดูว่า AI เรียก `search_products`/`check_stock` ก่อนแล้วค่อย `take_order` ในข้อความเดียว
- ทดสอบจริงผ่าน LINE (ไม่ใช่แค่ Playground เพราะ Playground ไม่ได้ทดสอบ reply+push แบบ async จริง) ว่าได้ ack message ก่อน แล้วได้คำตอบจริง push ตามมา

---

## 7. Sales Workflow Engine — แผนละเอียด (ยังไม่เริ่ม 0%, รอ Planning Layer)

### เป้าหมาย
รู้ว่าบทสนทนานี้อยู่ "stage" ไหนของการขาย (ไม่ใช่แค่ "ประเภทคำถาม" แบบที่ router ปัจจุบันแยก) เพื่อปรับพฤติกรรม AI ให้เหมาะกับแต่ละช่วง

### Schema
เพิ่มคอลัมน์ `conversations.sales_stage TEXT DEFAULT 'greeting'` (ค่า: `greeting`, `showcase`, `closing`, `post_sale`) ผ่าน migration ใหม่ `supabase_phase5_sales_workflow.sql` (`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS sales_stage TEXT DEFAULT 'greeting'`)

### Logic การเปลี่ยน stage (ทำใน webhook route หลัง Planning Layer dispatch tool เสร็จ)
- เรียก `search_products`/`check_stock`/`get_active_promotions` → เปลี่ยนเป็น `showcase` (ถ้ายังอยู่ `greeting`)
- เรียก `send_payment_qr`/`take_order` → เปลี่ยนเป็น `closing`
- หลัง `take_order` สำเร็จ (มี order จริงถูกสร้าง) → เปลี่ยนเป็น `post_sale`
- ไม่มีข้อความใหม่จากลูกค้าเกิน 24 ชม. หลัง `post_sale` → reset กลับเป็น `greeting` เมื่อลูกค้าทักมาใหม่ (เช็คจาก `conversations.last_message_at` ตอนเข้า webhook)

### ผลของ stage ต่อพฤติกรรม AI
- `staticSystemPrompt` (จาก Planning Layer's static/dynamic split ที่ทำไว้แล้วเพื่อ Claude caching) เพิ่มบรรทัดบอก stage ปัจจุบันเข้าไปใน dynamic block (เพราะเปลี่ยนบ่อย ไม่ควรอยู่ใน cached static block): `[สถานะการขายตอนนี้: ${stage}]` พร้อมคำแนะนำเฉพาะ stage เช่น `post_sale` → "แนะนำให้เรียก request_review หรือแนะนำสินค้าที่เข้าชุดกัน (get_crosssell_products)"

### Definition of Done
- ทุก conversation มี `sales_stage` ที่ตรงกับสถานะจริง ตรวจสอบผ่าน `/dashboard/inbox` ให้แสดง stage ปัจจุบันของแต่ละบทสนทนาด้วย (badge สีต่างกันตาม stage)
- Evaluation Framework (หัวข้อถัดไป) ใช้ข้อมูลนี้คำนวณ funnel conversion (กี่ % จาก greeting ไปถึง post_sale)

---

## 8. Evaluation Framework — แผนละเอียด (ยังไม่เริ่ม 0%)

### เป้าหมาย
วัด 3 อย่างตามที่ผู้ใช้ต้องการ: **อัตราปิดการขาย, ความพึงพอใจลูกค้า (CSAT), ต้นทุนต่อบทสนทนา**

### ส่วนที่เริ่มวัดได้ทันที ไม่ต้องรอ Sales Workflow Engine
**อัตราปิดการขายแบบหยาบ** คำนวณได้จากข้อมูลที่มีอยู่แล้ววันนี้: `(จำนวน conversations ที่มี order อย่างน้อย 1 รายการ) / (จำนวน conversations ทั้งหมด)` ต่อร้าน/เดือน — เขียน query เดียวจบจาก `conversations` join `orders` ผ่าน `conversation_id` ไม่ต้องรอ schema ใหม่ใดๆ

### ส่วนที่ต้องรอ Sales Workflow Engine
**Funnel conversion แบบละเอียด** (กี่ % หลุดที่ stage ไหน) ต้องมี `conversations.sales_stage` ก่อนถึงจะ group by stage ได้แม่นยำ

### ต้นทุนต่อบทสนทนา — ต้องสร้างใหม่
`ai_provider_usage` (จาก Margin Dashboard) เก็บสรุปแค่ระดับ shop+เดือน ไม่ละเอียดถึงระดับบทสนทนา ต้องเพิ่มการเก็บ token ต่อ `conversation_id` — วิธีที่ง่ายที่สุด (ไม่ต้องสร้างตารางใหม่): เพิ่มคอลัมน์ `chat_messages.tokens_used INTEGER` (migration `ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS tokens_used INTEGER`) แล้วบันทึก token ของแต่ละ AI reply ตอน insert เข้า `chat_messages` ในเว็บฮุค (มี `agentResult.usage.totalTokens` อยู่แล้วตอนนี้ ณ จุดที่ insert bot reply) จากนั้นคำนวณต้นทุน/บทสนทนาด้วย `estimateCostUsd()` (มีอยู่แล้วใน `src/lib/billing/aiPricing.ts` จาก Margin Dashboard) กับ SUM(tokens_used) ต่อ conversation_id

### CSAT — ต้องสร้างกลไกใหม่ทั้งหมด
- ตารางใหม่ `conversation_feedback` (conversation_id, shop_id, rating INT 1-5 หรือ enum 'good'/'neutral'/'bad', created_at)
- Trigger: เมื่อ `sales_stage` เปลี่ยนเป็น `post_sale` (จาก Sales Workflow Engine) ให้ส่ง LINE quick-reply ถามความพึงพอใจ (ปุ่ม 😊/😐/😞) ผ่าน `sendLinePush` แบบ quick reply message type
- รับคำตอบ: เพิ่ม dispatcher ในเว็บฮุคเช็คว่าข้อความที่เข้ามาเป็นการตอบ quick-reply นี้ไหม (เช็คจาก postback data หรือข้อความตรงกับ emoji ที่ตั้งไว้) แล้ว insert เข้า `conversation_feedback` แทนที่จะส่งเข้า AI ตามปกติ
- **Decision ที่ตัดสินใจแล้ว:** ถามทุกครั้งที่เข้า `post_sale` (ไม่สุ่ม) เพราะ sample size จากร้านค้าขนาดเล็กจะน้อยอยู่แล้ว การสุ่มจะทำให้ข้อมูลยิ่งน้อยเกินไปจนใช้วิเคราะห์ไม่ได้

### Admin Dashboard ใหม่
`/admin/evaluation` (คู่กับ `/admin/margin` ที่มีอยู่แล้ว): แสดง conversion rate ต่อแพ็กเกจ/ร้าน, CSAT เฉลี่ย, cost/conversation เฉลี่ย, แนวโน้มตามเวลา — ใช้ pattern เดียวกับ `src/app/admin/margin/actions.ts`+`MarginManagement.tsx` (server-role client + `verifySuperAdmin()` gate)

### Definition of Done
- Conversion rate พื้นฐานแสดงผลได้ทันทีจากข้อมูลที่มีอยู่วันนี้ (ทำได้ก่อนอย่างอื่นในหัวข้อนี้)
- Cost/conversation คำนวณได้จริงจาก `chat_messages.tokens_used`
- CSAT เก็บได้จริงอย่างน้อย 1 ร้านทดสอบ ผ่าน Chat Playground (ต้องขยาย Playground ให้จำลอง quick-reply ตอบ CSAT ได้ด้วย เหมือนที่ขยายให้ execute update_customer_note/add_customer_tag จริงมาก่อน)

---

## 9. Open Decisions ที่เหลืออยู่ (ต้องถามผู้ใช้ก่อนเริ่มหัวข้อนั้นๆ)

ส่วนใหญ่ตัดสินใจไปแล้วในแผนนี้ (ดูแต่ละหัวข้อ) เหลือแค่:
- **Sales Workflow Engine**: การ reset stage กลับเป็น `greeting` หลัง 24 ชม. เป็นค่าที่แนะนำ (เดา) — ควรถามผู้ใช้ว่าเหมาะกับธุรกิจจริงไหม หรืออยากให้ปรับได้ต่อร้าน (เช่น ร้านขายของใช้ซ้ำอาจอยาก reset เร็วกว่า ร้านขายสินค้าราคาแพงอาจอยากให้จำนานกว่า)
- **Evaluation Framework**: CSAT ใช้ปุ่ม 3 ระดับ (😊/😐/😞) ตามที่แนะนำไว้ หรืออยากได้ 5 ระดับ (1-5 ดาว)?

---

## 10. วิธีใช้เอกสารนี้ต่อ (สำหรับ AI ที่มาทำงานนี้ต่อ ไม่ว่าจะจากค่ายไหน)

1. อ่านหัวข้อ 0 (เป้าหมาย+กฎเหล็ก) และหัวข้อ 1 (บทเรียน) ให้จบก่อนเริ่มโค้ดใดๆ
2. เช็คว่าตอนนี้ทำถึงหัวข้อไหนแล้ว — ดู checklist สถานะในแต่ละหัวข้อ (4-8) และดู `PROJECT_STATUS.md` ประกอบ (มีบันทึกทุกครั้งที่ ship ฟีเจอร์จริง)
3. ทำตามลำดับในหัวข้อ 3 เว้นแต่ผู้ใช้ระบุเจาะจงว่าอยากทำหัวข้อไหนก่อน
4. **ก่อนเขียน SQL migration ใหม่ใดๆ ต้องรัน `supabase/tools/check_schema.sql` ก่อนเสมอ** (กฎเหล็กข้อ 5)
5. ทุกครั้งที่ทำหัวข้อไหนเสร็จ: (a) typecheck+build ให้ผ่าน, (b) อัปเดตสถานะในเอกสารนี้ (เปลี่ยนเครื่องหมาย/เพิ่มวันที่), (c) อัปเดต `PROJECT_STATUS.md` ตามธรรมเนียมเดิม, (d) commit+push
6. ห้ามฝ่าฝืนกฎเหล็ก 5 ข้อในหัวข้อ 0 ไม่ว่ากรณีใด — ถ้าคิดว่าจำเป็นต้องฝ่าฝืนข้อไหน ให้หยุดแล้วถามผู้ใช้ก่อน อย่าตัดสินใจเอง
