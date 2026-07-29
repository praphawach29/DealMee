import { parseCsv } from './extract'

export interface KnowledgeEntry {
  title: string
  content: string
}

/**
 * Ceiling on entries produced by one import. This is a cost control, not a
 * storage limit: `knowledgeContext` puts entries straight into the system
 * prompt of every customer message, so an unbounded import of a long PDF
 * would be re-sent, and re-billed, on every turn forever. Capping the
 * extraction makes the model summarise rather than transcribe.
 */
export const MAX_ENTRIES_PER_IMPORT = 30

/** Trim anything the model wrapped around its JSON, such as a ```json fence. */
function parseJsonLoosely(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = (fenced ? fenced[1] : raw).trim()
  const start = candidate.search(/[[{]/)
  if (start === -1) throw new Error('no JSON found')
  return JSON.parse(candidate.slice(start))
}

function normaliseEntries(value: unknown): KnowledgeEntry[] {
  if (!Array.isArray(value)) return []
  return value
    .map((row: any) => ({
      title: String(row?.title ?? row?.question ?? '').trim(),
      content: String(row?.content ?? row?.answer ?? '').trim(),
    }))
    .filter((entry) => entry.title.length > 0 && entry.content.length > 0)
    .slice(0, MAX_ENTRIES_PER_IMPORT)
}

const HEADER_ALIASES = {
  title: ['question', 'คำถาม', 'title', 'หัวข้อ', 'q'],
  content: ['answer', 'คำตอบ', 'content', 'รายละเอียด', 'a'],
}

/**
 * A spreadsheet that already has question and answer columns needs no model:
 * mapping it directly is exact, instant and free, and avoids an AI pass
 * rewording a shop's own carefully worded policy.
 * Returns null when the file isn't in that shape, so the caller falls back
 * to extraction.
 */
export function csvToEntriesDirect(content: string): KnowledgeEntry[] | null {
  const rows = parseCsv(content)
  if (rows.length < 2) return null

  const header = rows[0].map((cell) => cell.toLowerCase().trim())
  const titleIndex = header.findIndex((cell) => HEADER_ALIASES.title.includes(cell))
  const contentIndex = header.findIndex((cell) => HEADER_ALIASES.content.includes(cell))
  if (titleIndex === -1 || contentIndex === -1) return null

  return rows
    .slice(1)
    .map((row) => ({
      title: (row[titleIndex] || '').trim(),
      content: (row[contentIndex] || '').trim(),
    }))
    .filter((entry) => entry.title && entry.content)
    .slice(0, MAX_ENTRIES_PER_IMPORT)
}

/**
 * Turns raw source text into Q&A entries the sales agent can quote. Uses
 * Gemini directly rather than the agent engine: this is a one-off
 * document-processing call with no tools, conversation or planning involved,
 * and routing it through the planning loop would only add machinery.
 */
export async function toKnowledgeEntries(text: string, shopName: string): Promise<KnowledgeEntry[]> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
  if (!apiKey) throw new Error('ยังไม่ได้ตั้งค่า GEMINI_API_KEY จึงแปลงข้อมูลอัตโนมัติไม่ได้')

  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash'
  const prompt = `คุณคือผู้ช่วยจัดระเบียบข้อมูลของร้าน "${shopName}"

ด้านล่างคือข้อความดิบที่ดึงมาจากเว็บไซต์หรือเอกสารของร้าน
จงสกัดออกมาเป็นชุดคำถาม-คำตอบที่ "ลูกค้าถามจริง" ไม่เกิน ${MAX_ENTRIES_PER_IMPORT} ข้อ

กติกา:
- ใช้เฉพาะข้อมูลที่ปรากฏในข้อความจริงเท่านั้น ห้ามแต่งเพิ่มเด็ดขาด
- ถ้าข้อมูลไม่พอจะตอบคำถามไหนได้ ให้ข้ามข้อนั้นไป ได้น้อยข้อดีกว่าได้ข้อมูลผิด
- title = คำถามที่ลูกค้าน่าจะถาม เช่น "ร้านเปิดกี่โมง" "ส่งของกี่วันถึง"
- content = คำตอบที่กระชับ ครบถ้วน เป็นภาษาเดียวกับต้นฉบับ
- ข้ามเมนูเว็บไซต์ ปุ่ม ข้อความโฆษณาลอยๆ และข้อมูลติดต่อซ้ำซ้อน
- ตอบเป็น JSON array เท่านั้น รูปแบบ [{"title":"...","content":"..."}]

ข้อความดิบ:
"""
${text}
"""`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: 'application/json' },
      }),
    }
  )

  if (!response.ok) {
    const body = await response.text()
    console.error('[Knowledge Import] Gemini error:', body.slice(0, 500))
    throw new Error('แปลงข้อมูลอัตโนมัติไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
  }

  const data = await response.json()
  const raw = (data.candidates?.[0]?.content?.parts || [])
    .map((part: any) => part.text || '')
    .join('')

  if (!raw.trim()) throw new Error('ไม่สามารถสกัดข้อมูลจากเนื้อหานี้ได้')

  let entries: KnowledgeEntry[]
  try {
    entries = normaliseEntries(parseJsonLoosely(raw))
  } catch {
    console.error('[Knowledge Import] Unparseable model output:', raw.slice(0, 500))
    throw new Error('แปลงข้อมูลอัตโนมัติไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
  }

  if (entries.length === 0) {
    throw new Error('ไม่พบข้อมูลที่นำมาทำเป็นคำถาม-คำตอบได้ ลองใช้หน้าเว็บหรือไฟล์ที่มีรายละเอียดร้านมากกว่านี้')
  }

  return entries
}
