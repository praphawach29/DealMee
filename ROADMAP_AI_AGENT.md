# Botify AI — Agent Architecture Upgrade (Master Plan)

> ร่างเมื่อ: 28 กรกฎาคม 2026
> สถานะเอกสาร: **1/5 เสร็จแล้ว (Customer Memory Graph)** — อีก 4 หัวข้อยังไม่ได้เจาะรายละเอียด จะเติมทีละหัวข้อในเซสชันถัดๆ ไป
> อ้างอิงจาก: บทสนทนาวันที่ 28 กรกฎาคม 2026 ที่ผู้ใช้ตั้งเป้าหมายด้านสถาปัตยกรรม AI agent 5 อย่าง

---

## เป้าหมายรวม

เปลี่ยน `salesAgentEngine.ts` จากที่ตอนนี้เป็น **"เรียก AI ครั้งเดียวจบ พร้อม tool ให้เลือก"** (single-shot function-calling wrapper) ให้กลายเป็นระบบ agent แบบมีสถานะ (stateful), วางแผนได้หลายขั้นตอน, จำลูกค้าได้ข้ามบทสนทนา, รู้ตัวว่าอยู่ขั้นตอนไหนของการขาย และวัดผลคุณภาพได้จริง

ส่วนประกอบทั้ง 5:
1. **Model Router** ตามความซับซ้อนของงาน
2. **Planning Layer** ที่วางแผนก่อนเรียก Tools
3. **Customer Memory Graph** สำหรับจดจำลูกค้าเชิงลึก
4. **Sales Workflow Engine** ที่แบ่ง Agent ตามขั้นตอนการขาย
5. **Evaluation Framework** วัดอัตราปิดการขาย ความพึงพอใจ และต้นทุนต่อบทสนทนา

---

## ภาพรวมสถาปัตยกรรม: ตอนนี้ vs เป้าหมาย

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
ข้อความลูกค้า -> Model Router [ปรับปรุงจาก keyword -> ประเมินความซับซ้อนจริง]
            -> โหลด Customer Memory Graph (โปรไฟล์ลูกค้าข้ามบทสนทนา)
            -> Sales Workflow Engine กำหนด stage ปัจจุบันของบทสนทนานี้
            -> Planning Layer วางแผนหลายสเต็ป (อาจเรียกหลาย tool ต่อเนื่องกัน โดยส่งผลลัพธ์กลับเข้า context)
            -> Dispatch tools ตามแผน (มี step limit คุม cost/latency)
            -> ตอบลูกค้า + อัปเดต Customer Memory Graph + บันทึก stage transition
            -> Evaluation Framework log ต้นทุน/ผลลัพธ์ของบทสนทนานี้
```

---

## ลำดับการพัฒนาที่แนะนำ (และเหตุผล)

```
1. Customer Memory Graph   ✅ เสร็จแล้ว (28 กรกฎาคม 2026)
2. Planning Layer          ← ทำต่อได้เลย (หัวข้อถัดไป)
3. Sales Workflow Engine   ← ต้องมี Planning Layer ก่อน ถึงจะ execute ตาม stage ได้จริง
4. Evaluation Framework    ← ต้องมี Workflow Engine ก่อน ถึงจะวัด conversion ต่อ stage ได้แม่นยำ

Model Router: ทำแยกได้ทุกเมื่อ (ของเดิมมีอยู่แล้ว ~70% ความเสี่ยงต่ำ ไม่ block อะไร)
```

**เหตุผลที่ไม่ทำ Planning Layer ก่อน Memory Graph:** ถ้า planner วางแผนโดยไม่มีข้อมูลลูกค้าเชิงลึก (ไซส์ที่เคยซื้อ, ของที่เคยดู) แผนที่ได้จะยังตื้นเหมือนเดิม ทำ Memory Graph ก่อนจะทำให้ Planning Layer มีของให้ใช้งานจริงตั้งแต่วันแรก

---

## ส่วนประกอบทั้ง 5 (สถานะปัจจุบัน + ขอบเขตคร่าวๆ)

> รายละเอียดเจาะลึก (schema, code, API contract) ยังไม่เขียนในเอกสารนี้ — จะเพิ่มเป็น section แยกทีละหัวข้อทีหลัง โดยจะ mark `[ ] รายละเอียด: ยังไม่เขียน` -> `[x] รายละเอียด: เขียนแล้ว (วันที่...)` เมื่อเจาะแต่ละอันเสร็จ

### 1. Model Router ตามความซับซ้อน
- **สถานะ:** มีอยู่แล้ว ~70% — `classifyMessageComplexity()` ใน `src/lib/ai/salesAgentEngine.ts`
- **ที่มีแล้ว:** ตรวจ keyword ต่อรองราคา/จอง/ซัพพอร์ต แล้ว route ไป provider + tool set ที่ต่างกัน
- **ที่ขาด:** เป็น keyword matching ธรรมดา ไม่ใช่การประเมินความซับซ้อนจริงจาก AI/heuristic ที่ซับซ้อนกว่า
- **Dependency:** ไม่มี — ทำแยกได้เลยเมื่อไหร่ก็ได้
- [ ] รายละเอียด: ยังไม่เขียน

### 2. Planning Layer ก่อนเรียก Tools
- **สถานะ:** 0% — ตอนนี้เป็น single-shot ไม่มี loop ส่งผลลัพธ์ tool กลับให้ AI คิดต่อ (ไม่มี FunctionResponse round-trip เลย)
- **Dependency:** Customer Memory Graph เสร็จแล้ว ✅ — ทำต่อได้เลย (นี่คือหัวข้อถัดไปตามลำดับที่แนะนำ)
- **ประเด็นสำคัญที่ต้องคิดตอนเจาะรายละเอียด:** จำกัดจำนวนสเต็ปต่อข้อความ (คุม cost + latency), LINE webhook ต้องตอบใน ~3 วินาที (Reply API timeout), จะนับ quota/usage อย่างไรเมื่อ 1 ข้อความอาจเรียก AI หลายครั้ง
- [ ] รายละเอียด: ยังไม่เขียน

### 3. Customer Memory Graph
- **สถานะ: ✅ เสร็จแล้ว (28 กรกฎาคม 2026)**
- **สิ่งที่สร้าง:** ตาราง `customer_profiles` (shop_id+user_id, unique) เก็บ tags/notes แบบ append-only (jsonb array แทนที่ text field เดิมที่ overwrite ทุกครั้ง), preferences (jsonb key/value), total_orders/total_spend/last_order_at ที่อัปเดตอัตโนมัติเมื่อ take_order สำเร็จ, first_seen_at/last_seen_at ที่อัปเดตทุกข้อความ
- **ไฟล์:** `supabase_phase3_customer_memory.sql` (schema+RPC), `src/lib/customerMemory.ts` (helpers), context auto-injected ใน `salesAgentEngine.ts` (section "5. Customer Profile" ต่อจาก Payment Info) — ไม่ต้องเรียก tool ใดๆ AI จะเห็นข้อมูลลูกค้ารายนี้อัตโนมัติทุกข้อความ
- **Webhook:** `upsertCustomerProfile()` เรียกทุกข้อความที่เข้ามา, `update_customer_note`/`add_customer_tag` เขียนคู่ขนานทั้ง `conversations` (field เดิม เก็บไว้เผื่ออนาคต) และ `customer_profiles` (ที่ใช้จริง), `take_order` เรียก `recordCustomerOrder()` อัตโนมัติ
- **Chat Playground:** `update_customer_note`/`add_customer_tag` รันจริง (ไม่ใช่แค่ preview) เพื่อพิสูจน์ว่าความจำข้าม session ได้จริงระหว่างทดสอบ
- **การตัดสินใจที่ทำไปแล้ว:** ใช้ entity table (Postgres ธรรมดา) ไม่ใช่ graph database จริง — use case ไม่ต้องการ graph traversal (ไม่มี query แบบ "ลูกค้าที่ซื้อ X มักซื้อ Y ด้วย") structured table ตอบโจทย์ครบและไม่ต้องเพิ่ม infra ใหม่
- **ยังไม่ทำ (นอกขอบเขตของรอบนี้):** ยังไม่มี AI tool สำหรับเขียน `preferences` โดยตรง (มีแค่ฟังก์ชัน `updateCustomerPreference` รอเชื่อมต่อ), ยังไม่มี UI ใน `/dashboard` แสดงโปรไฟล์ลูกค้า
- [x] รายละเอียด: เขียนแล้ว (28 กรกฎาคม 2026)

### 4. Sales Workflow Engine (แบ่ง Agent ตามขั้นตอนการขาย)
- **สถานะ:** ~25% — system prompt อธิบาย "4-step Sales Pipeline" (Greeting→Showcase→Closing→Post-Sales) ให้ AI ตัวเดียวอ่านเป็น guideline แต่ไม่มีการ track จริงว่าบทสนทนานี้อยู่ stage ไหน (การ route ที่มีอยู่ตอนนี้แยกตาม**ประเภทคำถาม** ไม่ใช่ตาม**stage ของ funnel**)
- **Dependency:** Planning Layer + Customer Memory Graph
- [ ] รายละเอียด: ยังไม่เขียน

### 5. Evaluation Framework
- **สถานะ:** 0% — มีแผนคร่าวๆ อยู่ใน `ROADMAP.md` Phase 3.4 แล้ว (Conversion Rate, CPC, CSAT) แต่ยังไม่ได้สร้างจริง
- **ข้อมูลที่มีอยู่แล้วและใช้ต่อได้:** `usage_logs` (token ต่อร้าน/เดือน — ยังไม่ละเอียดถึงระดับต่อบทสนทนา), `orders`+`conversations` (คำนวณ conversion rate ได้)
- **ที่ต้องสร้างใหม่ทั้งหมด:** กลไกเก็บ CSAT (เช่น ถามให้คะแนนผ่าน LINE quick reply หลัง stage Post-Sales), cost tracking ระดับต่อบทสนทนา (ไม่ใช่แค่ต่อเดือน)
- **Dependency:** Sales Workflow Engine (ต้องรู้ stage ก่อนถึงจะวัด conversion ต่อ stage ได้แม่นยำ)
- [ ] รายละเอียด: ยังไม่เขียน

---

## Open Decisions (ต้องตอบก่อนเจาะรายละเอียดแต่ละหัวข้อ)

- [ ] Customer Memory: graph DB จริง หรือ entity table ธรรมดา?
- [ ] Planning Layer: จำกัดกี่ steps ต่อ 1 ข้อความลูกค้า?
- [ ] Evaluation: CSAT ถามทุกครั้งหรือสุ่มถาม? ถามผ่านช่องทางไหน (LINE quick reply / อื่นๆ)?

---

## วิธีใช้เอกสารนี้ต่อ

เซสชันถัดไป (แม้ context ของเซสชันก่อนหน้าจะหมดไปแล้ว) สามารถหยิบหัวข้อไหนก็ได้ใน "ส่วนประกอบทั้ง 5" ข้างบนมาเจาะรายละเอียดต่อได้เลย โดย:
1. อ้างอิง "ลำดับการพัฒนาที่แนะนำ" เพื่อเลือกว่าจะเริ่มหัวข้อไหน
2. เจาะรายละเอียด (schema, โค้ดที่ต้องแก้, API contract) เพิ่มเป็นเนื้อหาในหัวข้อนั้นโดยตรงในเอกสารนี้
3. เปลี่ยน `[ ] รายละเอียด: ยังไม่เขียน` เป็น `[x] รายละเอียด: เขียนแล้ว (วันที่...)` เมื่อเจาะเสร็จ
4. เมื่อ implement จริงแล้ว ให้ย้ายสถานะไปบันทึกใน `PROJECT_STATUS.md` ตามธรรมเนียมเดิมของโปรเจกต์
