import { readFileSync } from 'fs'
import path from 'path'

/**
 * The in-app guide (/dashboard/help). One source for two readers: the markdown files
 * DealMee's own LINE bot answers from (docs/sales/kb-bot, imported into the "DealMee"
 * shop's knowledge base). Each "## " heading is a question a shop owner actually asks,
 * so a fix to the guide reaches the bot and the help page together.
 * The files are traced into the deployment by outputFileTracingIncludes in next.config.ts.
 */
export type GuideId = 'setup' | 'faq' | 'pricing'

export interface GuideTopic {
  title: string
  body: string
}

export interface Guide {
  id: GuideId
  label: string
  topics: GuideTopic[]
}

const FILES: { id: GuideId; label: string; file: string }[] = [
  { id: 'setup', label: 'ตั้งค่าร้าน', file: '03-คู่มือตั้งค่าร้าน.md' },
  { id: 'faq', label: 'ฟีเจอร์และคำถามที่พบบ่อย', file: '02-ฟีเจอร์และคำถามที่พบบ่อย.md' },
  { id: 'pricing', label: 'แพ็กเกจและการชำระเงิน', file: '01-แพ็กเกจและราคา.md' },
]

/** One topic per "## " heading; the H1 is the file's title and is dropped. */
export function parseGuide(md: string): GuideTopic[] {
  const topics: GuideTopic[] = []
  let current: GuideTopic | null = null
  for (const line of md.replace(/\r\n/g, '\n').split('\n')) {
    const heading = line.match(/^##\s+(.+?)\s*$/)
    if (heading) {
      if (current) topics.push(current)
      current = { title: heading[1], body: '' }
    } else if (current && !/^#\s/.test(line)) {
      current.body += `${line}\n`
    }
  }
  if (current) topics.push(current)
  return topics.map((t) => ({ ...t, body: t.body.trim() }))
}

export function loadGuides(): Guide[] {
  const dir = path.join(process.cwd(), 'docs', 'sales', 'kb-bot')
  return FILES.map(({ id, label, file }) => {
    try {
      return { id, label, topics: parseGuide(readFileSync(path.join(dir, file), 'utf8')) }
    } catch (err) {
      console.error(`[helpGuide] could not read ${file}:`, err)
      return { id, label, topics: [] }
    }
  })
}
