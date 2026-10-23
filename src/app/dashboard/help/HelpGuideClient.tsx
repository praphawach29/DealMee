'use client'

import { Fragment, useMemo, useState } from 'react'
import { BookOpen, ChevronDown, MessageCircle, Search } from 'lucide-react'
import type { Guide, GuideTopic } from '@/lib/helpGuide'
import { DEALMEE_LINE_OA } from '@/components/landing/data'

/** Topics whose title or text contains every word typed (Thai has no spaces, so words are what the person separated). */
function searchTopics(topics: GuideTopic[], query: string): GuideTopic[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return topics
  return topics.filter((t) => {
    const hay = `${t.title}\n${t.body}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}

/** **bold** only; the guide files use nothing else inline */
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>
  )
}

/** The small markdown subset the kb-bot files use: paragraphs, 1. lists, - lists and | tables. */
function TopicBody({ body }: { body: string }) {
  const lines = body.split('\n')
  const blocks: React.ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    if (line.trim().startsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
        if (!cells.every((c) => /^:?-{3,}:?$/.test(c))) rows.push(cells)
        i++
      }
      const [head, ...rest] = rows
      blocks.push(
        <div key={i} className="overflow-x-auto">
          <table className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                {head.map((c, j) => (
                  <th key={j} className="text-left font-semibold px-3 py-2 border-b border-slate-200 dark:border-slate-700">
                    {inline(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rest.map((r, k) => (
                <tr key={k} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  {r.map((c, j) => (
                    <td key={j} className="px-3 py-2">
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }
    const ordered = /^\d+\.\s/.test(line)
    if (ordered || /^-\s/.test(line)) {
      const items: string[] = []
      const re = ordered ? /^\d+\.\s+/ : /^-\s+/
      while (i < lines.length && re.test(lines[i])) {
        items.push(lines[i].replace(re, ''))
        i++
      }
      const List = ordered ? 'ol' : 'ul'
      blocks.push(
        <List key={i} className={`${ordered ? 'list-decimal' : 'list-disc'} pl-5 space-y-1`}>
          {items.map((it, k) => (
            <li key={k}>{inline(it)}</li>
          ))}
        </List>
      )
      continue
    }
    blocks.push(<p key={i}>{inline(line)}</p>)
    i++
  }
  return <div className="space-y-2.5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{blocks}</div>
}

export default function HelpGuideClient({
  guides,
  initialTab,
  initialQuery,
}: {
  guides: Guide[]
  initialTab?: string
  initialQuery?: string
}) {
  const [tab, setTab] = useState(guides.find((g) => g.id === initialTab)?.id ?? guides[0].id)
  const [query, setQuery] = useState(initialQuery ?? '')
  const [open, setOpen] = useState<string | null>(null)

  const searching = query.trim().length > 0
  // While searching, look through every guide so the owner doesn't have to guess which tab
  const results = useMemo(() => {
    const pool = searching ? guides : guides.filter((g) => g.id === tab)
    return pool.flatMap((g) => searchTopics(g.topics, query).map((t) => ({ guide: g, topic: t })))
  }, [guides, tab, query, searching])

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <BookOpen className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-heading text-xl sm:text-2xl font-semibold text-on-surface">คู่มือการใช้งาน</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">วิธีตั้งค่าร้าน ฟีเจอร์ของบอท และเรื่องแพ็กเกจ ค้นหาด้วยคำที่สงสัยได้เลย</p>
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-outline absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหา เช่น เชื่อม LINE, ตรวจสลิป, เติมเงิน"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-outline-variant bg-white text-sm text-on-surface placeholder:text-outline outline-none focus:border-primary shadow-card"
        />
      </div>

      {!searching && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {guides.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                setTab(g.id)
                setOpen(null)
              }}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                tab === g.id
                  ? 'bg-primary text-white'
                  : 'bg-white border border-outline-variant text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white border border-outline-variant rounded-2xl divide-y divide-outline-variant shadow-card">
        {results.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">ไม่พบหัวข้อที่ตรงกับคำค้น ลองใช้คำอื่น หรือทักทีมงานด้านล่าง</p>
        ) : (
          results.map(({ guide, topic }) => {
            const key = `${guide.id}:${topic.title}`
            const isOpen = open === key || (searching && results.length <= 3)
            return (
              <div key={key}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : key)}
                  className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 text-left cursor-pointer hover:bg-surface-container"
                >
                  <span className="font-heading text-sm font-semibold text-on-surface">
                    {topic.title}
                    {searching && <span className="ml-2 text-[11px] font-normal text-slate-400">{guide.label}</span>}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-4 sm:px-5 pb-4">
                    <TopicBody body={topic.body} />
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <a
        href={DEALMEE_LINE_OA.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 p-4 rounded-2xl border border-[#06C755]/30 bg-[#06C755]/5 hover:bg-[#06C755]/10 transition-colors"
      >
        <MessageCircle className="w-5 h-5 text-[#06C755] shrink-0" />
        <span className="text-sm text-slate-700 dark:text-slate-200">
          ไม่เจอคำตอบ? ทักทีมงานทาง LINE <strong>{DEALMEE_LINE_OA.id}</strong>
        </span>
      </a>
    </div>
  )
}
