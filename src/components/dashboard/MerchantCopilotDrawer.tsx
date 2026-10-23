'use client'

import { useState, useRef, useEffect } from 'react'
import { Bot, X, Send, Zap, Loader2, RotateCcw } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: string[]
}

const QUICK_PROMPTS = [
  { label: '📊 สรุปยอดขาย 7 วันล่าสุด', prompt: 'ช่วยสรุปยอดขาย ออเดอร์ รายได้รวม และสถิติการขาย 7 วันล่าสุดให้หน่อย' },
  { label: '⏳ รายการที่ยังไม่โอนเงิน', prompt: 'มีออเดอร์ไหนที่ยังค้างชำระเงิน (pending) บ้าง และยอดรวมเท่าไหร่?' },
  { label: '⚠️ สินค้าสต็อกใกล้หมด', prompt: 'ตรวจสอบสินค้าที่สต็อกเหลือน้อยกว่า 5 ชิ้นให้หน่อย มีตัวไหนบ้าง?' },
  { label: '📅 สรุปคิวการจอง', prompt: 'ภาพรวมคิวการจองและนัดหมายของร้านช่วงนี้เป็นอย่างไรบ้าง?' },
  { label: '🤖 รายงาน AI ทวงสลิป', prompt: 'ระบบ Proactive Follow-up ทวงสลิปไปกี่คนแล้ว และดึงยอดขายกลับมาได้เท่าไหร่?' },
  { label: '💡 ไอเดียเพิ่มยอดขาย', prompt: 'วิเคราะห์ข้อมูลร้านแล้วแนะนำ 3 กลยุทธ์ที่ร้านควรทำตอนนี้เพื่อเพิ่มยอดขาย' },
]

const TOOL_LABELS: Record<string, string> = {
  get_sales_analytics: 'วิเคราะห์ยอดขาย',
  get_top_products: 'ข้อมูลสินค้าขายดี',
  get_low_stock_alerts: 'ตรวจเช็คสต็อกสินค้า',
  get_pending_payments: 'ตรวจออเดอร์ค้างจ่าย',
  get_booking_overview: 'ภาพรวมคิวการจอง',
  get_customer_insights: 'ค้นหาประวัติลูกค้า',
  get_follow_up_engine_stats: 'สถิติระบบทวงสลิป AI',
}

const WELCOME_CONTENT = `สวัสดีครับ! ผมคือ **DealMee Copilot** ผู้ช่วย AI วิเคราะห์ข้อมูลร้านค้าของคุณ 🤖✨

ผมสามารถช่วยคุณ:
• 📊 **วิเคราะห์ยอดขาย & รายได้**
• ⏳ **ตรวจเช็คออเดอร์ค้างจ่าย**
• ⚠️ **แจ้งเตือนสต็อกใกล้หมด**
• 📅 **ดูภาพรวมคิวจอง**
• 💡 **แนะนำกลยุทธ์เพิ่มยอดขาย**

ลองเลือกคำถามด้านบน หรือพิมพ์คำถามที่ต้องการได้เลยครับ!`

function renderFormattedText(content: string) {
  return content.split('\n').map((line, lineIdx) => {
    const parts = line.split(/(\*\*.*?\*\*)/g)
    return (
      <div key={lineIdx} className={line.trim() === '' ? 'h-2' : 'min-h-[1.25rem]'}>
        {parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={pIdx} className="font-semibold text-slate-900 dark:text-white">
                {part.slice(2, -2)}
              </strong>
            )
          }
          return <span key={pIdx}>{part}</span>
        })}
      </div>
    )
  })
}

export default function MerchantCopilotDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: WELCOME_CONTENT,
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
    }
  }, [isOpen, messages])

  const handleResetChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: WELCOME_CONTENT,
      },
    ])
  }

  const handleSend = async (userText?: string) => {
    const textToSend = (userText || input).trim()
    if (!textToSend || loading) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
    }

    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setLoading(true)

    try {
      // Build history excluding welcome and current
      const history = updated
        .filter((m) => m.id !== 'welcome' && m.id !== userMsg.id)
        .map((m) => ({ role: m.role, content: m.content }))

      const res = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history,
        }),
      })

      const data = await res.json()

      if (res.ok && data.responseText) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: data.responseText,
            toolCalls: data.toolCallsExecuted || [],
          },
        ])
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: data.error || 'ขออภัยครับ เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง',
          },
        ])
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `ขออภัยครับ เกิดข้อผิดพลาดในการเชื่อมต่อ: ${err.message}`,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Solid Dark Backdrop with blur to isolate focus */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in"
        aria-hidden="true"
      />

      {/* Drawer Container - 100% Opaque Solid Background */}
      <aside className="relative z-10 w-full max-w-md sm:max-w-lg bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col h-full animate-slide-in-right">
        {/* Header */}
        <div className="px-5 py-4 border-b border-outline-variant bg-white text-on-surface flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-semibold text-sm sm:text-base tracking-tight text-on-surface">ผู้ช่วย AI</h3>
                <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Online
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-on-surface-variant">DealMee Copilot ประจำตัวเจ้าของร้าน</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {messages.length > 1 && (
              <button
                onClick={handleResetChat}
                className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer flex items-center justify-center min-h-[36px] min-w-[36px]"
                title="เริ่มการสนทนาใหม่"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer flex items-center justify-center min-h-[44px] min-w-[44px]"
              aria-label="Close Copilot"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Quick Prompt Chips */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar shrink-0">
          <div className="flex gap-2 min-w-max">
            {QUICK_PROMPTS.map((qp, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(qp.prompt)}
                disabled={loading}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-all active:scale-[0.98] cursor-pointer shadow-xs shrink-0 disabled:opacity-50"
              >
                {qp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Messages Feed - 100% Solid Opaque Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-100/70 dark:bg-slate-950/80 text-xs sm:text-sm">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-xs shrink-0 mt-0.5">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div
                className={`max-w-[88%] rounded-2xl p-4 space-y-2 leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xs rounded-tr-xs font-medium'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 shadow-xs rounded-tl-xs'
                }`}
              >
                {/* Tool execution badges */}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2 pb-2 border-b border-slate-100 dark:border-slate-800 text-[11px]">
                    {msg.toolCalls.map((t, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 font-medium flex items-center gap-1"
                      >
                        <Zap className="h-3 w-3 text-indigo-500" />
                        <span>{TOOL_LABELS[t] || t}</span>
                      </span>
                    ))}
                  </div>
                )}

                <div className="leading-relaxed">
                  {renderFormattedText(msg.content)}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-2.5 justify-start">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-xs shrink-0 mt-0.5">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-xs p-3.5 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2.5 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                <span>DealMee Copilot กำลังดึงข้อมูลร้านค้าและวิเคราะห์คำตอบ...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 space-y-2">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="ถามยอดขาย สต็อก ลูกค้า หรือขอคำแนะนำ..."
              disabled={loading}
              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white p-2.5 rounded-xl transition-all active:scale-[0.98] shadow-xs cursor-pointer shrink-0 flex items-center justify-center min-h-[44px] min-w-[44px]"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 px-1">
            <span>⚡ เชื่อมต่อฐานข้อมูลร้านค้าแบบเรียลไทม์</span>
            <span>DealMee AI Copilot</span>
          </div>
        </div>
      </aside>
    </div>
  )
}

