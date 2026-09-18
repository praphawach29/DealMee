import { parseDocumentWithMarkItDown } from '@/lib/documentProcessor'

export interface ExtractedQuotationItem {
  name: string
  qty: number
  price: number
  total?: number
  unit?: string
}

export interface ExtractedQuotationData {
  customer_name?: string
  customer_phone?: string
  customer_address?: string
  items: ExtractedQuotationItem[]
  subtotal: number
  vat_amount: number
  discount_amount: number
  total_amount: number
  notes?: string
}

/** Trim anything the model wrapped around its JSON */
function parseJsonLoosely(raw: string): any {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = (fenced ? fenced[1] : raw).trim()
  const start = candidate.search(/[[{]/)
  if (start === -1) throw new Error('no JSON found')
  return JSON.parse(candidate.slice(start))
}

/**
 * Extracts line items, quantities, prices and customer details
 * from document markdown using Gemini with strict structural parsing.
 */
export async function extractQuotationFromMarkdown(
  markdownText: string,
  vatEnabled: boolean = false
): Promise<ExtractedQuotationData> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
  if (!apiKey) throw new Error('ยังไม่ได้ตั้งค่า GEMINI_API_KEY')

  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
  const prompt = `คุณคือผู้เชี่ยวชาญการถอดรหัสเอกสารใบเสนอราคา, รายการวัสดุ (BOQ), หรือรายการสั่งซื้อ
หน้าที่ของคุณคืออ่านข้อมูล Markdown ที่แปลงมาจากเอกสาร และดึงรายการสินค้า ปริมาณ และราคา ออกมาให้ถูกต้องที่สุด

กติกา:
1. หากเป็นตาราง ให้จับคู่ชื่อสินค้า จำนวน และราคาต่อหน่วย ให้ถูกต้องตรงแถว
2. คำนวณยอดเงิน: price = ราคาต่อหน่วย, qty = จำนวน (ถ้าไม่ระบุให้เป็น 1)
3. ดึงชื่อผู้สั่งซื้อ/ลูกค้า และข้อมูลติดต่อ (ถ้ามีระบุในเอกสาร)
4. สรุปเป็น JSON เท่านั้นในรูปแบบ:
{
  "customer_name": "ชื่อลูกค้าหรือบริษัท (ถ้ามี)",
  "customer_phone": "เบอร์โทร (ถ้ามี)",
  "customer_address": "ที่อยู่ (ถ้ามี)",
  "items": [
    {
      "name": "ชื่อสินค้าหรือรายการวัสดุ",
      "qty": 10,
      "price": 150.0,
      "unit": "ถุง / ชิ้น / เมตร (ถ้ามี)"
    }
  ],
  "notes": "เงื่อนไขหรือหมายเหตุสำคัญในเอกสาร (ถ้ามี)"
}

เนื้อหา Markdown จากเอกสาร:
"""
${markdownText.slice(0, 50000)}
"""`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      }),
    }
  )

  if (!response.ok) {
    const errText = await response.text()
    console.error('[extractQuotationFromMarkdown] Gemini error:', errText.slice(0, 500))
    throw new Error('ไม่สามารถวิเคราะห์ข้อมูลใบเสนอราคาจากเอกสารนี้ได้')
  }

  const data = await response.json()
  const rawOutput = (data.candidates?.[0]?.content?.parts || [])
    .map((part: { text?: string }) => part.text || '')
    .join('')

  if (!rawOutput.trim()) {
    throw new Error('ไม่พบข้อมูลรายการสินค้าในเอกสารนี้')
  }

  const parsed = parseJsonLoosely(rawOutput)
  const rawItems = Array.isArray(parsed.items) ? parsed.items : []

  const items: ExtractedQuotationItem[] = rawItems
    .map((item: any) => {
      const price = Math.max(0, Number(item.price || 0))
      const qty = Math.max(1, Number(item.qty || item.quantity || 1))
      return {
        name: String(item.name || item.item || item.description || 'รายการสินค้า').trim(),
        price,
        qty,
        total: price * qty,
        unit: item.unit ? String(item.unit).trim() : undefined,
      }
    })
    .filter((item: ExtractedQuotationItem) => item.name.length > 0)

  let subtotal = 0
  items.forEach((it) => {
    subtotal += (it.price || 0) * (it.qty || 1)
  })

  const discountAmount = Math.max(0, Number(parsed.discount_amount || 0))
  const afterDiscount = Math.max(0, subtotal - discountAmount)
  const vatAmount = vatEnabled ? Math.round(afterDiscount * 0.07 * 100) / 100 : 0
  const totalAmount = afterDiscount + vatAmount

  return {
    customer_name: parsed.customer_name || undefined,
    customer_phone: parsed.customer_phone || undefined,
    customer_address: parsed.customer_address || undefined,
    items,
    subtotal,
    discount_amount: discountAmount,
    vat_amount: vatAmount,
    total_amount: totalAmount,
    notes: parsed.notes || undefined,
  }
}

/**
 * End-to-end converter: Takes an uploaded file (PDF, Excel, Word, etc.),
 * converts it using MarkItDown, and extracts a structured Quotation draft.
 */
export async function convertDocumentToQuotationDraft(
  fileBuffer: ArrayBuffer | Uint8Array | Buffer,
  filename: string,
  vatEnabled: boolean = false
): Promise<ExtractedQuotationData> {
  const result = await parseDocumentWithMarkItDown(fileBuffer, filename)
  if (!result.success || !result.markdown.trim()) {
    throw new Error(result.error || `ไม่สามารถแปลงไฟล์ ${filename} ได้`)
  }

  return await extractQuotationFromMarkdown(result.markdown, vatEnabled)
}
