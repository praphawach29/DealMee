'use client'

import { useState, useRef, useEffect } from 'react'
import { Bot, X, Send, Zap, Loader2 } from 'lucide-react'

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
      content:
        'สวัสดีครับ! ผมคือ **Botify Jarvis** ผู้ช่วย AI วิเคราะห์ข้อมูลร้านค้าของคุณ 🤖✨\n\nผมสามารถช่วยคุณ:\n• 📊 **วิเคราะห์ยอดขาย & รายได้**\n• ⏳ **ตรวจเช็คออเดอร์ค้างจ่าย**\n• ⚠️ **แจ้งเตือนสต็อกใกล้หมด**\n• 📅 **ดูภาพรวมคิวจอง**\n• 💡 **แนะนำกลยุทธ์เพิ่มยอดขาย**\n\nลองเลือกคำถามด้านล่าง หรือพิมพ์คำถามที่ต้องการได้เลยครับ!',
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
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-fade-in"
      />

      {/* Drawer */}
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md sm:max-w-lg bg-surface border-l border-outline-variant/30 shadow-2xl flex flex-col h-full animate-slide-in-right">
          {/* Header */}
          <div className="px-5 py-4 border-b border-outline-variant/30 bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 text-indigo-200 shadow-inner">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm sm:text-base tracking-tight">Botify Jarvis</h3>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Online
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-indigo-200/80">AI Copilot ประจำตัวเจ้าของร้าน</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-indigo-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close Copilot"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Quick Prompt Chips */}
          <div className="px-4 py-2.5 bg-surface-container/60 border-b border-outline-variant/20 overflow-x-auto no-scrollbar shrink-0">
            <div className="flex gap-2 min-w-max">
              {QUICK_PROMPTS.map((qp, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(qp.prompt)}
                  disabled={loading}
                  className="px-2.5 py-1 text-[11px] sm:text-xs font-semibold rounded-lg bg-surface border border-outline-variant/50 text-on-surface-variant hover:border-indigo-500 hover:text-indigo-600 transition-all active:scale-[0.98] cursor-pointer shadow-2xs shrink-0 disabled:opacity-50"
                >
                  {qp.label}
                </button>
              ))}
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 font-body-md text-xs sm:text-sm">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-3 sm:p-3.5 space-y-2 leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white shadow-xs rounded-tr-xs'
                      : 'bg-surface-container border border-outline-variant/30 text-on-surface shadow-2xs rounded-tl-xs'
                  }`}
                >
                  {/* Tool execution badges */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5 pb-1.5 border-b border-outline-variant/30 text-[10px]">
                      {msg.toolCalls.map((t, idx) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-0.5"
                        >
                          <Zap className="h-3 w-3" />
                          <span>{t}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="whitespace-pre-line leading-relaxed">{msg.content}</div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5 justify-start">
                <div className="w-7 h-7 rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <div className="bg-surface-container border border-outline-variant/30 rounded-2xl rounded-tl-xs p-3 text-xs text-on-surface-variant flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                  <span>Jarvis กำลังวิเคราะห์ข้อมูลร้านค้า...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="p-3 sm:p-4 border-t border-outline-variant/30 bg-surface shrink-0">
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
                className="flex-1 bg-surface-container border border-outline-variant/50 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-on-surface placeholder:text-outline focus:outline-hidden focus:border-indigo-500 transition-colors"
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
          </div>
        </div>
      </div>
    </div>
  )
}
