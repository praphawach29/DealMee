'use server'

import { createClient } from '@/utils/supabase/server'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { convertDocumentToQuotationDraft, ExtractedQuotationData } from '@/lib/ai/documentToQuotation'
import { parseDocumentWithMarkItDown } from '@/lib/documentProcessor'
import { revalidatePath } from 'next/cache'

export interface OfficialLetterDraft {
  doc_number: string
  department: string
  date_str: string
  subject: string
  recipient: string
  reference_to: string
  enclosures: string
  body_facts: string
  body_considerations: string
  body_resolution: string
  signatory_name: string
  signatory_position: string
  contact_info: string
}

async function resolveShop(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { error: 'กรุณาเข้าสู่ระบบอีกครั้ง' as const }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id) return { error: 'ไม่พบข้อมูลร้านค้า' as const }

  return { shop, user }
}

/**
 * Upload a document (Excel/PDF/Word) and parse into a Quotation draft
 */
export async function parseDocumentToQuotationAction(formData: FormData) {
  const supabase = await createClient()
  const resolved = await resolveShop(supabase)
  if ('error' in resolved) return { error: resolved.error }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'กรุณาเลือกไฟล์เอกสาร' }

  try {
    const buffer = await file.arrayBuffer()
    const quotation = await convertDocumentToQuotationDraft(
      buffer,
      file.name,
      resolved.shop.vat_enabled || false
    )

    return {
      success: true,
      filename: file.name,
      quotation,
    }
  } catch (err: any) {
    console.error('[parseDocumentToQuotationAction error]:', err)
    return { error: err.message || 'ไม่สามารถประมวลผลไฟล์เอกสารได้' }
  }
}

/**
 * Save quotation to `documents` table
 */
export async function saveQuotationAction(data: {
  customer_name: string
  customer_phone?: string
  customer_address?: string
  items: Array<{ name: string; qty: number; price: number; unit?: string }>
  subtotal: number
  discount_amount: number
  vat_amount: number
  total_amount: number
  notes?: string
}) {
  const supabase = await createClient()
  const resolved = await resolveShop(supabase)
  if ('error' in resolved) return { error: resolved.error }

  if (!data.items || data.items.length === 0) {
    return { error: 'ต้องมีรายการสินค้าอย่างน้อย 1 รายการ' }
  }

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randNum = Math.floor(1000 + Math.random() * 9000)
  const docNumber = `QT-${dateStr}-${randNum}`

  const { data: doc, error } = await supabase
    .from('documents')
    .insert({
      shop_id: resolved.shop.id,
      doc_number: docNumber,
      doc_type: 'quotation',
      customer_name: data.customer_name || 'ลูกค้าผู้มีอุปการคุณ',
      customer_phone: data.customer_phone || '',
      customer_address: data.customer_address || '',
      items: data.items,
      subtotal: data.subtotal,
      discount_amount: data.discount_amount || 0,
      vat_amount: data.vat_amount || 0,
      total_amount: data.total_amount,
      notes: data.notes || '',
    })
    .select('id, doc_number')
    .single()

  if (error || !doc) {
    return { error: `บันทึกไม่สำเร็จ: ${error?.message}` }
  }

  revalidatePath('/dashboard/documents')
  return {
    success: true,
    docId: doc.id,
    docNumber: doc.doc_number,
    docUrl: `/doc/quotation/${doc.id}`,
  }
}

/**
 * AI Draft an official letter from an uploaded source document
 */
export async function draftOfficialLetterAction(formData: FormData) {
  const supabase = await createClient()
  const resolved = await resolveShop(supabase)
  if ('error' in resolved) return { error: resolved.error }

  const file = formData.get('file') as File | null
  const templateType = String(formData.get('template_type') || 'external_letter')
  const userInstructions = String(formData.get('instructions') || '')

  if (!file || file.size === 0) return { error: 'กรุณาเลือกไฟล์เอกสารต้นเรื่อง' }

  try {
    const buffer = await file.arrayBuffer()
    const parsed = await parseDocumentWithMarkItDown(buffer, file.name)
    if (!parsed.success || !parsed.markdown) {
      throw new Error(parsed.error || 'อ่านไฟล์ต้นเรื่องไม่สำเร็จ')
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
    if (!apiKey) throw new Error('ยังไม่ได้ตั้งค่า GEMINI_API_KEY')

    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    const prompt = `คุณคือผู้เชี่ยวชาญด้านงานสารบรรณและการร่างหนังสือราชการตามระเบียบสำนักนายกรัฐมนตรีว่าด้วยงานสารบรรณ
หน้าที่ของคุณคืออ่าน "เอกสารต้นเรื่อง" ที่แนบมา แล้วร่างหนังสือราชการตอบรับ/สั่งการ/อนุญาต ในนามองค์กร "${resolved.shop.company_name || resolved.shop.name || 'หน่วยงาน'}"

คำสั่งเพิ่มเติมจากผู้ใช้งาน: "${userInstructions || 'ร่างหนังสือตอบรับอนุญาตตามระเบียบ'}"
ประเภทเทมเพลต: "${templateType}"

กติกาการร่าง:
1. ใช้ภาษาเขียนราชการที่สุภาพ ถูกต้องตามแบบแผนงานสารบรรณ (อ้างถึง, ตามหนังสือที่อ้างถึง, พิจารณาแล้วเห็นว่า, จึงเรียนมาเพื่อ...)
2. ดึงชื่อหน่วยงาน/บริษัทผู้ส่ง, วันที่ของหนังสือเดิม, วัตถุประสงค์ และสาระสำคัญมาใส่ในช่องที่ถูกต้อง
3. สรุปผลลัพธ์เป็น JSON เท่านั้นในรูปแบบ:
{
  "doc_number": "ที่ กท ๑๑๐๐ / ..........",
  "department": "${resolved.shop.company_name || resolved.shop.name || 'สำนักสิ่งแวดล้อม กรุงเทพมหานคร'}",
  "date_str": "วัน เดือน ปี ปัจจุบันแบบไทย เช่น ๑๓ กันยายน ๒๕๖๙",
  "subject": "ชื่อเรื่องที่กระชับและตรงประเด็น",
  "recipient": "ชื่อตำแหน่งหรือบุคคลผู้รับหนังสือ",
  "reference_to": "หนังสืออ้างถึง (ถ้ามีระบุในต้นเรื่อง)",
  "enclosures": "สิ่งที่ส่งมาด้วย (ถ้ามี)",
  "body_facts": "ย่อหน้าข้อเท็จจริง (ตามหนังสือที่อ้างถึง... ขออนุญาต...)",
  "body_considerations": "ย่อหน้าข้อพิจารณา (ทางหน่วยงานได้พิจารณาแล้วเห็นว่า...)",
  "body_resolution": "ย่อหน้าข้อเสนอหรือคำสั่งการ (จึงเรียนมาเพื่อโปรดทราบและดำเนินการ / อนุญาตให้ดำเนินการได้ภายใต้เงื่อนไข...)",
  "signatory_name": "ชื่อผู้ลงนาม (เช่น ชื่อผู้บริหาร หรือเว้นว่างให้ลงนาม)",
  "signatory_position": "ตำแหน่งผู้ลงนาม",
  "contact_info": "กลุ่มงาน/เบอร์โทรศัพท์ผู้ประสานงานของหน่วยงาน"
}

เนื้อหาเอกสารต้นเรื่อง:
"""
${parsed.markdown.slice(0, 45000)}
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
      throw new Error('เรียก AI เพื่อร่างหนังสือราชการไม่สำเร็จ')
    }

    const resJson = await response.json()
    const rawText = (resJson.candidates?.[0]?.content?.parts || [])
      .map((p: any) => p.text || '')
      .join('')

    const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/)
    const candidate = (fenced ? fenced[1] : rawText).trim()
    const start = candidate.search(/[[{]/)
    const letterDraft: OfficialLetterDraft = JSON.parse(candidate.slice(start))

    return {
      success: true,
      filename: file.name,
      markdownSource: parsed.markdown,
      letterDraft,
    }
  } catch (err: any) {
    console.error('[draftOfficialLetterAction error]:', err)
    return { error: err.message || 'เกิดข้อผิดพลาดในการร่างหนังสือราชการ' }
  }
}

/**
 * Save official letter document
 */
export async function saveOfficialLetterAction(draft: OfficialLetterDraft) {
  const supabase = await createClient()
  const resolved = await resolveShop(supabase)
  if ('error' in resolved) return { error: resolved.error }

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randNum = Math.floor(1000 + Math.random() * 9000)
  const docNumber = draft.doc_number && draft.doc_number.length > 5
    ? draft.doc_number
    : `DOC-${dateStr}-${randNum}`

  const { data: doc, error } = await supabase
    .from('documents')
    .insert({
      shop_id: resolved.shop.id,
      doc_number: docNumber,
      doc_type: 'official_letter',
      customer_name: draft.recipient,
      items: [
        {
          name: draft.subject,
          qty: 1,
          price: 0,
        }
      ],
      notes: JSON.stringify(draft),
    })
    .select('id, doc_number')
    .single()

  if (error || !doc) {
    return { error: `บันทึกไม่สำเร็จ: ${error?.message}` }
  }

  revalidatePath('/dashboard/documents')
  return {
    success: true,
    docId: doc.id,
    docNumber: doc.doc_number,
    docUrl: `/doc/official/${doc.id}`,
  }
}

/**
 * Delete a document by ID
 */
export async function deleteDocumentAction(id: string) {
  const supabase = await createClient()
  const resolved = await resolveShop(supabase)
  if ('error' in resolved) return { error: resolved.error }

  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)
    .eq('shop_id', resolved.shop.id)

  if (error) {
    return { error: `ลบเอกสารไม่สำเร็จ: ${error.message}` }
  }

  revalidatePath('/dashboard/documents')
  return { success: true }
}
