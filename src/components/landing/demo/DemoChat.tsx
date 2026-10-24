'use client'

import React, { useEffect, useRef, useState } from 'react'
import { QrCode, RotateCcw, Send, X } from 'lucide-react'
import { DEMO_MESSAGE_MAX_CHARS, DEMO_MESSAGES_PER_VISITOR, DEMO_SHOPS, type DemoPersona } from '@/lib/demo/shops'

/**
 * The demo chat window: the visitor chats with the real sales engine against one of three
 * sample shops (see src/app/api/demo/chat). No account. Replies, product cards, orders and
 * bookings are real; the payment QR is a placeholder and nothing reaches LINE.
 */

interface ProductCard {
  id: string
  name: string
  price: number
  stock?: number | null
}

type Bubble =
  | { from: 'user'; type: 'text'; text: string }
  | { from: 'bot'; type: 'text'; text: string }
  | { from: 'bot'; type: 'qr'; caption: string }
  | { from: 'bot'; type: 'products'; products: ProductCard[] }
  | { from: 'bot'; type: 'note'; text: string }

const ERROR_TEXT: Record<string, string> = {
  visitor_limit: `ลองครบ ${DEMO_MESSAGES_PER_VISITOR} ข้อความของวันนี้แล้ว อยากลองกับข้อมูลร้านของคุณเอง สมัครทดลองใช้ฟรีได้เลยครับ`,
  global_limit: 'วันนี้มีคนลองเดโมเยอะมาก ระบบพักเดโมไว้ก่อน พรุ่งนี้กลับมาลองได้ หรือสมัครทดลองใช้ฟรีได้เลยครับ',
  too_long: `ข้อความยาวเกินไป (ไม่เกิน ${DEMO_MESSAGE_MAX_CHARS} ตัวอักษร)`,
}
const GENERIC_ERROR = 'ตอนนี้เดโมขัดข้องชั่วคราว ลองใหม่อีกครั้งนะครับ'

export default function DemoChat({
  persona,
  onPersonaChange,
  onClose,
}: {
  persona: DemoPersona
  onPersonaChange: (p: DemoPersona) => void
  onClose: () => void
}) {
  const [chats, setChats] = useState<Record<DemoPersona, Bubble[]>>({ shop: [], spa: [], cleaning: [] })
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const demo = DEMO_SHOPS.find((s) => s.persona === persona)!
  const bubbles = chats[persona]

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [bubbles, busy])

  const push = (p: DemoPersona, items: Bubble[]) => setChats((prev) => ({ ...prev, [p]: [...prev[p], ...items] }))

  async function send(text: string) {
    const message = text.trim()
    if (!message || busy) return
    const p = persona
    setInput('')
    push(p, [{ from: 'user', type: 'text', text: message }])
    setBusy(true)
    try {
      const res = await fetch('/api/demo/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: p, message }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        push(p, [{ from: 'bot', type: 'note', text: ERROR_TEXT[data.error] || GENERIC_ERROR }])
        return
      }
      const incoming: Bubble[] = (data.bubbles || []).map((b: any) =>
        b.type === 'qr'
          ? { from: 'bot', type: 'qr', caption: b.caption }
          : b.type === 'products'
            ? { from: 'bot', type: 'products', products: b.products }
            : b.type === 'note'
              ? { from: 'bot', type: 'note', text: b.text }
              : { from: 'bot', type: 'text', text: b.text }
      )
      push(p, incoming.length ? incoming : [{ from: 'bot', type: 'note', text: GENERIC_ERROR }])
    } catch {
      push(p, [{ from: 'bot', type: 'note', text: GENERIC_ERROR }])
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  function reset() {
    if (busy) return
    const p = persona
    setChats((prev) => ({ ...prev, [p]: [] }))
    fetch('/api/demo/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona: p, reset: true }),
    }).catch(() => {})
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      {/* What this is, in one line */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <div className="text-sm font-bold text-slate-900">ลองคุยกับบอทตัวอย่าง</div>
          <div className="text-xs text-slate-500">ไม่ต้องสมัคร · ร้านและสินค้าเป็นข้อมูลตัวอย่าง</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="-mr-1 rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          aria-label="ปิด"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Pick a sample shop */}
      <div className="grid grid-cols-3 gap-1.5 px-3 py-2.5 border-b border-slate-100">
        {DEMO_SHOPS.map((s) => (
          <button
            key={s.persona}
            type="button"
            onClick={() => onPersonaChange(s.persona)}
            className={`rounded-xl px-2 py-2 text-xs font-semibold border leading-tight ${
              s.persona === persona ? 'bg-primary text-white border-primary' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
            }`}
          >
            <span className="block text-base">{s.emoji}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* LINE-style header of the sample shop */}
      <div className="bg-[#06C755] px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 shrink-0 rounded-full bg-white/20 flex items-center justify-center">{demo.emoji}</div>
          <div className="min-w-0">
            <div className="text-white font-bold text-sm truncate">{demo.shopName}</div>
            <div className="text-emerald-100 text-[11px]">ตอบโดย {demo.botName} · DealMee AI</div>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="shrink-0 text-white/90 hover:text-white text-xs font-semibold inline-flex items-center gap-1"
        >
          <RotateCcw className="w-3.5 h-3.5" /> เริ่มใหม่
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 bg-[#ECE5DD] p-3.5 overflow-y-auto flex flex-col gap-2.5">
        <BotText text={demo.greeting} />
        {bubbles.map((b, i) => (
          <BubbleView key={i} b={b} />
        ))}
        {busy && <TypingIndicator />}
      </div>

      {bubbles.length === 0 && (
        <div className="px-3 pt-2.5 bg-white">
          <div className="text-[11px] text-slate-500 mb-1.5">กดคำถามตัวอย่าง หรือพิมพ์เองก็ได้</div>
          <div className="flex flex-wrap gap-1.5">
            {demo.starters.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                disabled={busy}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
        className="p-3 flex gap-2 bg-white"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={DEMO_MESSAGE_MAX_CHARS}
          placeholder="พิมพ์ถามเหมือนเป็นลูกค้า…"
          className="flex-1 min-w-0 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="shrink-0 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-40"
          aria-label="ส่ง"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
      <div className="px-4 pb-3 text-[11px] text-slate-400 bg-white leading-relaxed">
        ลองได้ {DEMO_MESSAGES_PER_VISITOR} ข้อความต่อวัน · QR ในเดโมเป็นภาพตัวอย่าง · ไม่ต้องใส่ชื่อหรือเบอร์จริง
      </div>
    </div>
  )
}

/** Three bouncing dots, like a chat app while the other side is typing */
function TypingIndicator() {
  return (
    <div
      className="self-start bg-white rounded-2xl rounded-bl-xs border border-slate-200/60 px-4 py-3.5 shadow-xs flex items-center gap-1.5"
      role="status"
      aria-label="บอทกำลังพิมพ์"
    >
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-2 w-2 rounded-full bg-slate-400 animate-bounce motion-reduce:animate-none"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  )
}

function BotText({ text }: { text: string }) {
  return (
    <div className="self-start max-w-[85%] bg-white text-slate-900 rounded-2xl rounded-bl-xs border border-slate-200/60 px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line shadow-xs">
      {text}
    </div>
  )
}

function BubbleView({ b }: { b: Bubble }) {
  if (b.from === 'user') {
    return (
      <div className="self-end max-w-[85%] bg-[#DCF8C6] text-slate-950 rounded-2xl rounded-br-xs px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line shadow-xs font-medium">
        {b.text}
      </div>
    )
  }
  if (b.type === 'text') return <BotText text={b.text} />
  if (b.type === 'note') {
    return (
      <div className="self-center max-w-[92%] rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 text-center leading-relaxed">
        {b.text}
      </div>
    )
  }
  if (b.type === 'qr') {
    return (
      <div className="self-start max-w-[85%] bg-white rounded-2xl rounded-bl-xs border border-slate-200/60 p-3 shadow-xs">
        <div className="mx-auto mb-2 flex h-28 w-28 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-[11px] font-semibold leading-snug text-slate-500">
          <QrCode className="mb-1 h-8 w-8 text-slate-400" />
          QR ตัวอย่าง
          <br />
          ร้านจริงสแกนจ่ายได้
        </div>
        <div className="text-sm text-slate-900 leading-relaxed whitespace-pre-line">{b.caption}</div>
      </div>
    )
  }
  return (
    <div className="self-start w-full overflow-x-auto no-scrollbar">
      <div className="flex gap-2 pb-1">
        {b.products.map((p) => (
          <div key={p.id} className="w-40 shrink-0 rounded-[14px] border border-slate-200 bg-white p-3 shadow-card">
            <div className="text-xs font-bold text-slate-900 leading-snug line-clamp-2 min-h-[2rem]">{p.name}</div>
            <div className="mt-1.5 text-sm font-bold text-[#06C755]">฿{Number(p.price).toLocaleString('th-TH')}</div>
            <div className="text-[11px] text-slate-500">
              {p.stock == null ? '' : p.stock > 0 ? `เหลือ ${p.stock} ชิ้น` : 'หมดชั่วคราว'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
