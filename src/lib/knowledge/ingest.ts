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
    .map((row: Record<string, unknown>) => ({
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
 * Parses markdown files directly using headings (##, ###) and sections.
 * Fast, 100% faithful to the source text, preserves tables, and needs no AI model.
 */
export function markdownToEntriesDirect(content: string): KnowledgeEntry[] | null {
  if (!content || content.trim().length === 0) return null

  const lines = content.split(/\r?\n/)
  const entries: KnowledgeEntry[] = []
  let currentTitle = ''
  let currentBody: string[] = []

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,4}\s+(.+)$/)
    if (headingMatch) {
      if (currentTitle && currentBody.join('\n').trim().length >= 10) {
        entries.push({
          title: currentTitle.trim(),
          content: currentBody.join('\n').trim(),
        })
      }
      currentTitle = headingMatch[1].trim()
      currentBody = []
    } else {
      currentBody.push(line)
    }
  }

  if (currentTitle && currentBody.join('\n').trim().length >= 10) {
    entries.push({
      title: currentTitle.trim(),
      content: currentBody.join('\n').trim(),
    })
  }

  if (entries.length > 0) {
    return entries.slice(0, MAX_ENTRIES_PER_IMPORT)
  }

  return null
}

function fallbackTextChunking(text: string): KnowledgeEntry[] {
  const chunks = text
    .split(/\n{2,}/)
    .map((c) => c.trim())
    .filter((c) => c.length >= 15)

  const entries: KnowledgeEntry[] = []
  for (let i = 0; i < Math.min(chunks.length, MAX_ENTRIES_PER_IMPORT); i++) {
    const lines = chunks[i].split('\n').filter(Boolean)
    const rawTitle = lines[0].replace(/^[#*\-•\d.]+\s*/, '').trim()
    const title = rawTitle.length > 5 ? rawTitle.slice(0, 80) : `ข้อมูลส่วนที่ ${i + 1}`
    entries.push({
      title,
      content: chunks[i],
    })
  }
  return entries
}

/**
 * Turns raw source text into Q&A entries the sales agent can quote.
 * Uses Gemini or Claude with graceful fallback to heuristic chunking.
 */
export async function toKnowledgeEntries(text: string, shopName: string): Promise<KnowledgeEntry[]> {
  // If the text has markdown headings, parse directly first
  const directMd = markdownToEntriesDirect(text)
  if (directMd && directMd.length >= 2) {
    return directMd
  }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
  const claudeKey = process.env.CLAUDE_API_KEY || process.env.CLAUDE_KEY || process.env.NEXT_PUBLIC_CLAUDE_API_KEY || ''

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

  // 1. Try Gemini if configured
  if (geminiKey) {
    const modelsToTry = [
      process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-2.5-flash',
    ]

    for (const model of modelsToTry) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: 'application/json' },
            }),
          }
        )

        if (response.ok) {
          const data = await response.json()
          const raw = (data.candidates?.[0]?.content?.parts || [])
            .map((part: { text?: string }) => part.text || '')
            .join('')

          if (raw.trim()) {
            const entries = normaliseEntries(parseJsonLoosely(raw))
            if (entries.length > 0) return entries
          }
        }
      } catch (err) {
        console.warn(`[Knowledge Import] Gemini model ${model} failed, trying fallback:`, err)
      }
    }
  }

  // 2. Try Claude if available
  if (claudeKey) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const raw = data.content?.[0]?.text || ''
        if (raw.trim()) {
          const entries = normaliseEntries(parseJsonLoosely(raw))
          if (entries.length > 0) return entries
        }
      }
    } catch (err) {
      console.warn('[Knowledge Import] Claude fallback failed:', err)
    }
  }

  // 3. Last-resort graceful fallback: direct chunking
  const fallback = fallbackTextChunking(text)
  if (fallback.length > 0) {
    return fallback
  }

  throw new Error('ไม่สามารถสกัดข้อมูลจากเอกสารนี้ได้ กรุณาตรวจสอบเนื้อหาในไฟล์')
}
