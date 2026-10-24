/**
 * Pulls readable text out of the three sources a shop owner is likely to
 * already have: their website, a price list or FAQ spreadsheet, and a PDF
 * brochure. Everything here is pure text wrangling — turning that text into
 * Q&A entries is `toKnowledgeEntries()` in ./ingest.ts.
 */

/** How much text the Q&A summariser sees. The rest is still chunked for retrieval. */
export const MAX_EXTRACT_CHARS = 60_000

/** Upper bound on text stored as chunks from one upload, so one file cannot create an unbounded embedding bill. */
export const MAX_INDEX_CHARS = 200_000

export interface ExtractedSource {
  text: string
  /** Shown back to the shop owner so they can see what was read. */
  label: string
}

function collapseWhitespace(text: string) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function truncate(text: string) {
  return text.length > MAX_INDEX_CHARS ? text.slice(0, MAX_INDEX_CHARS) : text
}

/**
 * Strips a page down to its prose. Deliberately not a real HTML parser —
 * script, style and nav content is dropped and the rest is unescaped, which
 * is enough to feed an extraction model and avoids pulling a DOM library
 * into a serverless function for one job.
 */
export function htmlToText(html: string): string {
  const withoutNoise = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, ' ')

  const spaced = withoutNoise
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')

  const unescaped = spaced
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))

  return collapseWhitespace(unescaped)
}

export async function extractFromUrl(rawUrl: string): Promise<ExtractedSource> {
  let url: URL
  try {
    url = new URL(rawUrl.trim())
  } catch {
    throw new Error('ลิงก์ไม่ถูกต้อง กรุณาใส่ URL เต็ม เช่น https://example.com')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('รองรับเฉพาะลิงก์ http และ https เท่านั้น')
  }

  const response = await fetch(url.toString(), {
    headers: {
      // Some sites serve a stripped page to unknown clients; a plain browser
      // UA gets the same HTML a shop owner sees when they check their site.
      'User-Agent': 'Mozilla/5.0 (compatible; DealMeeKnowledgeBot/1.0)',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(20_000),
  })

  if (!response.ok) {
    throw new Error(`เปิดลิงก์ไม่สำเร็จ (HTTP ${response.status}) กรุณาตรวจสอบว่าเว็บเปิดดูได้จริง`)
  }

  const text = htmlToText(await response.text())
  if (text.length < 50) {
    throw new Error('อ่านเนื้อหาจากหน้านี้ไม่ได้ เว็บอาจโหลดด้วย JavaScript ทั้งหมด ลองใช้ไฟล์ PDF แทนได้ค่ะ')
  }

  return { text: truncate(text), label: url.hostname + url.pathname }
}

export async function extractFromPdf(file: File): Promise<ExtractedSource> {
  const { extractText, getDocumentProxy } = await import('unpdf')
  const buffer = new Uint8Array(await file.arrayBuffer())

  let text: string
  try {
    const pdf = await getDocumentProxy(buffer)
    const result = await extractText(pdf, { mergePages: true })
    text = collapseWhitespace(Array.isArray(result.text) ? result.text.join('\n') : result.text)
  } catch {
    throw new Error('อ่านไฟล์ PDF ไม่สำเร็จ ไฟล์อาจเสียหายหรือถูกใส่รหัสผ่านไว้')
  }

  if (text.length < 50) {
    throw new Error('ไฟล์ PDF นี้ไม่มีข้อความให้อ่าน (อาจเป็นไฟล์สแกนเป็นรูปภาพ) กรุณาใช้ไฟล์ที่คัดลอกข้อความได้')
  }

  return { text: truncate(text), label: file.name }
}

/**
 * Splits one CSV line, honouring quoted fields so a comma inside
 * "เสื้อยืด, ไซส์ L" doesn't split the cell.
 */
function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cell += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      cells.push(cell.trim())
      cell = ''
    } else {
      cell += char
    }
  }
  cells.push(cell.trim())
  return cells
}

export function parseCsv(content: string): string[][] {
  return content
    .replace(/^﻿/, '') // Excel writes a BOM that would otherwise stick to the first header
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(splitCsvLine)
}

export async function extractFromCsv(file: File): Promise<ExtractedSource> {
  const rows = parseCsv(await file.text())
  if (rows.length === 0) throw new Error('ไฟล์ CSV ว่างเปล่า')

  const text = rows.map((row) => row.filter(Boolean).join(' | ')).join('\n')
  if (text.length < 20) throw new Error('ไฟล์ CSV ไม่มีข้อมูลให้อ่าน')

  return { text: truncate(text), label: file.name }
}

/**
 * Universal document extractor using Microsoft MarkItDown.
 * Seamlessly handles: .docx, .xlsx, .pptx, .pdf, .csv, .png, .jpg
 * Preserves tables and markdown structure for maximum RAG accuracy.
 */
export async function extractUniversalDocument(file: File): Promise<ExtractedSource> {
  const ext = file.name.toLowerCase()
  if (ext.endsWith('.md') || ext.endsWith('.markdown') || ext.endsWith('.txt')) {
    const rawText = await file.text()
    if (rawText.trim().length >= 10) {
      return {
        text: truncate(rawText.trim()),
        label: file.name,
      }
    }
    throw new Error('ไฟล์ข้อความว่างเปล่าหรือไม่พบเนื้อหา')
  }

  try {
    const { parseDocumentWithMarkItDown } = await import('@/lib/documentProcessor')
    const buffer = await file.arrayBuffer()
    const result = await parseDocumentWithMarkItDown(buffer, file.name)

    if (result.success && result.markdown && result.markdown.trim().length >= 20) {
      return {
        text: truncate(result.markdown.trim()),
        label: file.name,
      }
    }
  } catch (err) {
    console.warn('[extractUniversalDocument] MarkItDown parser warning, falling back:', err)
  }

  // Graceful fallbacks if MarkItDown is unavailable or couldn't parse
  if (ext.endsWith('.pdf')) {
    return await extractFromPdf(file)
  }
  if (ext.endsWith('.csv')) {
    return await extractFromCsv(file)
  }

  throw new Error(`ไม่สามารถอ่านข้อมูลจากไฟล์ ${file.name} ได้ กรุณาตรวจสอบว่าเป็นเอกสารที่เปิดอ่านได้ปกติ`)
}
