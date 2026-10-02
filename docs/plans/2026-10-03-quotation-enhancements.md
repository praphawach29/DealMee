# Quotation System Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade DealMee's quotation system with high-value features inspired by `kingvision-print`: digital authorized signature integration across Web/PDF/Word/Excel, 1-click LINE URL sharing, and interactive customer approval workflow.

**Architecture:** 
1. Store Settings: Extend `shops` settings with `company_signature_url` allowing merchants to upload or specify their official signature PNG.
2. Multi-Format Output: Propagate the signature image automatically into Web view (`/doc/quotation/[id]`), Word (`.docx`), and Excel (`.xlsx`).
3. Customer Engagement: Add 1-click LINE share button (`line.me/R/msg/text/?...`) and an interactive "ยอมรับใบเสนอราคา / ยืนยันสั่งซื้อ" button on the public quotation page.

**Tech Stack:** Next.js 16 (App Router), Supabase PostgreSQL, Tailwind CSS, TypeScript, `docx` library, `exceljs`.

---

### Task 1: Add Company Signature Field to Shop Settings

**Files:**
- Modify: `src/app/dashboard/settings/CompanySettingsForm.tsx`
- Modify: `src/app/dashboard/settings/actions.ts`

**Step 1: Update `CompanySettingsForm.tsx`**
- Add `company_signature_url?: string | null` to `ShopData` interface.
- Add an input block with image preview:
  - Preview card for current signature (max-height 64px, dashed border).
  - Input for `company_signature_url` (URL or image path).
  - Clear / remove signature button.

**Step 2: Update `actions.ts` (`updateCompanySettings`)**
- Read `formData.get('company_signature_url')` as string and sanitize.
- Update `company_signature_url` in `supabase.from('shops').update(...)`.

**Step 3: Test and Commit**
- Run build to verify type safety: `npm run build`
- Commit:
  ```bash
  git add src/app/dashboard/settings/CompanySettingsForm.tsx src/app/dashboard/settings/actions.ts
  git commit -m "feat(settings): add company signature configuration for quotations"
  ```

---

### Task 2: Display Official Signature on Public Quotation Web View

**Files:**
- Modify: `src/app/doc/quotation/[id]/route.ts`

**Step 1: Fetch signature in route handler**
- Fetch `shop.company_signature_url || shop.signature_url` in `GET`.
- Prepare `companySignatureUrl`.

**Step 2: Render signature in Seller Signature Box**
- Replace the static placeholder `[ ลงลายมือชื่อ / ประทับตรา ]` with:
  ```html
  ${companySignatureUrl ? `
    <div class="h-12 flex items-center justify-center">
      <img src="${companySignatureUrl}" alt="ลายเซ็นผู้มีอำนาจ" class="max-h-12 max-w-[180px] object-contain" />
    </div>
  ` : `
    <div class="h-10 flex items-center justify-center">
      <span class="text-slate-300 text-[10px] italic">[ ลงลายมือชื่อ / ประทับตรา ]</span>
    </div>
  `}
  ```

**Step 3: Test and Commit**
- Verify responsive view and print mode styling.
- Commit:
  ```bash
  git add src/app/doc/quotation/[id]/route.ts
  git commit -m "feat(quotation): display authorized signature on web and print view"
  ```

---

### Task 3: Embed Signature in Word (.docx) and Excel (.xlsx) Generators

**Files:**
- Modify: `src/app/api/doc/[id]/download/route.ts`
- Modify: `src/lib/office/officeDocumentService.ts`

**Step 1: Fetch signature buffer in download API**
- In `src/app/api/doc/[id]/download/route.ts`:
  - If `shop.company_signature_url`, fetch image buffer as `signatureBuffer`.
  - Pass `signature_buffer: signatureBuffer` into `shopProfile`.

**Step 2: Embed signature in Word (`generateQuotationDocxWithJs`)**
- In Seller signature table cell:
  - If `shop.signature_buffer`, add `new ImageRun({ data: shop.signature_buffer, transformation: { width: 120, height: 45 } })` above the company name.

**Step 3: Embed signature in Excel (`generateQuotationXlsxWithJs`)**
- If `shop.signature_buffer`, add image via `workbook.addImage` at `sigRow1` left column.

**Step 4: Test and Commit**
- Run build and test generator: `npm run build`
- Commit:
  ```bash
  git add src/app/api/doc/[id]/download/route.ts src/lib/office/officeDocumentService.ts
  git commit -m "feat(office): embed authorized signature in Word and Excel downloads"
  ```

---

### Task 4: Add 1-Click LINE Share Button & Copy Link

**Files:**
- Modify: `src/app/doc/quotation/[id]/route.ts`

**Step 1: Format pre-filled LINE message**
- Construct Thai text with emoji summaries:
  ```ts
  const lineShareText = encodeURIComponent(
    `📄 ใบเสนอราคา ${docNo}\n` +
    `🏢 ${companyName}\n` +
    `👤 ลูกค้า: ${doc.customer_name}\n` +
    `💰 ยอดสุทธิทั้งสิ้น: ฿${total.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท\n` +
    `⏳ กำหนดยืนราคา: 30 วัน\n\n` +
    `🔗 เปิดดูเอกสาร A4 / บันทึก PDF / Word / Excel ได้ที่นี่:\n${currentUrl}`
  )
  const lineShareUrl = `https://line.me/R/msg/text/?${lineShareText}`
  ```

**Step 2: Add Action Buttons to Quotation Header Bar**
- Add:
  - `แชร์ LINE`: `<a href="${lineShareUrl}" target="_blank" class="bg-[#06C755] text-white ...">LINE</a>`
  - `คัดลอกลิงก์`: `<button onclick="copyDocLink()" class="...">คัดลอกลิงก์</button>` with clipboard JS API.

**Step 3: Test and Commit**
- Test click in browser.
- Commit:
  ```bash
  git add src/app/doc/quotation/[id]/route.ts
  git commit -m "feat(quotation): add 1-click LINE share and copy link actions"
  ```

---

### Task 5: Customer Interactive Action ("ยืนยันสั่งซื้อ / ตอบรับใบเสนอราคา")

**Files:**
- Modify: `src/app/doc/quotation/[id]/route.ts`
- Create: `src/app/api/doc/[id]/accept/route.ts`

**Step 1: Create Accept API Endpoint**
- `POST /api/doc/[id]/accept`:
  - Updates `documents.status` to `'accepted'`.
  - Records `accepted_at: new Date().toISOString()`.
  - Optionally pushes notification to merchant LINE OA or admin logs.

**Step 2: Add Approval Button on Customer Card**
- If status is `draft` or `sent`:
  - Show a banner or button: `✅ ยืนยันสั่งซื้อตามใบเสนอราคานี้`.
  - On click, prompt confirmation modal, call `/api/doc/[id]/accept`, and update badge to `อนุมัติแล้ว (Accepted)`.

**Step 3: Test and Commit**
- Run build: `npm run build`
- Commit:
  ```bash
  git add src/app/doc/quotation/[id]/route.ts src/app/api/doc/[id]/accept/route.ts
  git commit -m "feat(quotation): add interactive customer acceptance workflow"
  ```
