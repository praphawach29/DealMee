import { createHash } from 'node:crypto'

/**
 * Splits a merchant document into overlapping chunks without dropping the
 * body. Thai prose often has no spaces, so cuts prefer punctuation or
 * whitespace and otherwise fall on a character boundary (Thai letters are
 * one code point, so we slice by code point and never by UTF-16 unit).
 *
 * Merchant-written Q&A stays a separate, higher-priority source. This module
 * only slices text; it does not summarise.
 */

export const DEFAULT_CHUNK_CHARS = 900
export const DEFAULT_OVERLAP_CHARS = 150
export const MAX_CHUNKS_PER_DOCUMENT = 400
export interface ChunkOptions {
  fileName?: string | null
  maxChars?: number
  overlapChars?: number
}

export interface DocumentChunk {
  content: string
  /** Heading path, e.g. "เสื้อยืด > ไซส์". Null when the source has no headings. */
  section: string | null
  fileName: string | null
  index: number
}

export function contentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

export function codePointLength(text: string): number {
  return Array.from(text).length
}

export function codePointSlice(text: string, start: number, end?: number): string {
  return Array.from(text).slice(start, end).join('')
}

interface Section {
  section: string | null
  lines: string[]
}

interface Piece {
  text: string
}

function parseSections(text: string): Section[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const sections: Section[] = []
  const stack: { level: number; title: string }[] = []
  let current: Section = { section: null, lines: [] }

  const flush = () => {
    if (current.lines.some((line) => line.trim().length > 0)) sections.push(current)
  }

  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line)
    if (!heading) {
      current.lines.push(line)
      continue
    }
    flush()
    const level = heading[1].length
    while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop()
    stack.push({ level, title: heading[2].trim() })
    current = { section: stack.map((item) => item.title).join(' > '), lines: [] }
  }
  flush()
  return sections
}

const BREAK_CHARS = new Set([' ', '\t', '。', '！', '？', '!', '?', '；', ';', '，', ',', '、', '|', '）', ')', '』', '”', '"'])

function splitLongLine(line: string, maxChars: number): string[] {
  const trimmed = line.trim()
  if (!trimmed) return []
  if (codePointLength(trimmed) <= maxChars) return [trimmed]

  const parts: string[] = []
  let rest = trimmed
  while (codePointLength(rest) > maxChars) {
    const window = Array.from(codePointSlice(rest, 0, maxChars))
    let cut = -1
    const floor = Math.floor(maxChars * 0.5)
    for (let i = window.length - 1; i >= floor; i--) {
      if (BREAK_CHARS.has(window[i])) {
        cut = i + 1
        break
      }
    }
    if (cut === -1) cut = maxChars
    const piece = codePointSlice(rest, 0, cut).trim()
    if (piece) parts.push(piece)
    rest = codePointSlice(rest, cut).trim()
  }
  if (rest) parts.push(rest)
  return parts
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim()
  return trimmed.startsWith('|') && trimmed.includes('|')
}

function piecesFromLines(lines: string[], pieceChars: number): Piece[] {
  const pieces: Piece[] = []
  let i = 0
  while (i < lines.length) {
    if (!isTableRow(lines[i])) {
      if (lines[i].trim()) pieces.push(...splitLongLine(lines[i], pieceChars).map((text) => ({ text })))
      i++
      continue
    }

    const table: string[] = []
    while (i < lines.length && (isTableRow(lines[i]) || isTableSeparator(lines[i]))) {
      table.push(lines[i].trim())
      i++
    }
    const headerLines = table.length >= 2 && isTableSeparator(table[1]) ? table.slice(0, 2) : table.slice(0, 1)
    const header = headerLines.join('\n')
    const data = table.slice(headerLines.length)
    if (data.length === 0) {
      for (const part of splitLongLine(table.join('\n'), pieceChars)) pieces.push({ text: part })
      continue
    }

    let buf: string[] = []
    const flush = () => {
      if (buf.length === 0) return
      pieces.push({ text: `${header}\n${buf.join('\n')}` })
      buf = []
    }
    for (const row of data) {
      const candidate = `${header}\n${[...buf, row].join('\n')}`
      if (codePointLength(candidate) > pieceChars && buf.length > 0) flush()
      if (codePointLength(`${header}\n${row}`) > pieceChars) {
        flush()
        for (const part of splitLongLine(row, pieceChars)) pieces.push({ text: part })
      } else {
        buf.push(row)
      }
    }
    flush()
  }
  return pieces
}

/** Tail used as overlap. Snaps forward to a newline when one sits in the first half of the window. */
export function overlapTail(text: string, overlapChars: number): string {
  if (overlapChars <= 0) return ''
  const chars = Array.from(text.trim())
  if (chars.length === 0) return ''
  if (chars.length <= overlapChars) return chars.join('')
  let tail = chars.slice(chars.length - overlapChars).join('')
  const newline = tail.indexOf('\n')
  if (newline >= 0 && newline < tail.length * 0.6) tail = tail.slice(newline + 1)
  return tail.trim()
}

function packPieces(pieces: Piece[], maxChars: number, overlapChars: number): string[] {
  const chunks: string[] = []
  let buf = ''
  for (const piece of pieces) {
    const addition = buf ? `${buf}\n${piece.text}` : piece.text
    if (buf && codePointLength(addition) > maxChars) {
      chunks.push(buf.trim())
      const tail = overlapTail(buf, overlapChars)
      const withOverlap = tail ? `${tail}\n${piece.text}` : piece.text
      buf = codePointLength(withOverlap) <= maxChars ? withOverlap : piece.text
    } else {
      buf = addition
    }
  }
  if (buf.trim()) chunks.push(buf.trim())
  // Keep short Q&A. A one-line price is still the answer a customer asked for.
  return chunks.filter((chunk) => chunk.trim().length > 0)
}

export function chunkDocument(text: string, options: ChunkOptions = {}): DocumentChunk[] {
  const raw = (text || '').replace(/\u0000/g, '').trim()
  if (!raw) return []

  const maxChars = Math.max(80, options.maxChars ?? DEFAULT_CHUNK_CHARS)
  const overlapChars = Math.max(0, Math.min(options.overlapChars ?? DEFAULT_OVERLAP_CHARS, Math.floor(maxChars / 3)))
  // Leave room for the overlap prefix so the next chunk still shares a tail.
  const pieceChars = Math.max(40, maxChars - overlapChars - 1)
  const fileName = options.fileName?.trim() || null
  const sections = parseSections(raw)
  const chunks: DocumentChunk[] = []

  for (const section of sections) {
    const pieces = piecesFromLines(section.lines, pieceChars)
    for (const content of packPieces(pieces, maxChars, overlapChars)) {
      if (chunks.length >= MAX_CHUNKS_PER_DOCUMENT) return chunks
      chunks.push({
        content,
        section: section.section,
        fileName,
        index: chunks.length,
      })
    }
  }
  return chunks
}

/** One Q&A entry. Long answers are split; the question stays in `section`. */
export function chunkQaEntry(
  entry: { title: string; content: string; fileName?: string | null },
  options: ChunkOptions = {}
): DocumentChunk[] {
  const title = entry.title.trim()
  const content = entry.content.trim()
  if (!title || !content) return []
  const chunks = chunkDocument(`Q: ${title}\nA: ${content}`, {
    ...options,
    fileName: entry.fileName,
  })
  return chunks.map((chunk) => ({
    ...chunk,
    section: chunk.section || title,
  }))
}
