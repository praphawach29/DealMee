'use client'

import { useState, useEffect } from 'react'
import { testPlaygroundChat, getPlaygroundQuotaStatus, getPlaygroundGreeting } from '../settings/actions'
import { Bot, X, Send } from 'lucide-react'

interface ChatMessage {
  id: string
  sender: 'user' | 'bot'
  text: string
  timestamp: string
  quotaExceeded?: boolean
  origin?: 'ack' | 'reply' | 'tool'
  imageUrl?: string
  toolCalls?: { name: string; args: Record<string, any> }[]
  scheduled?: { delayMinutes: number; content: string }[]
}

interface QuotaStatus {
  messagesUsed: number
  messageLimit: number
  isUnlimited: boolean
  isOverQuota: boolean
}

interface ChatPlaygroundModalProps {
  isOpen: boolean
  onClose: () => void
  initialBotName?: string
  initialPersonality?: string
}

export default function ChatPlaygroundModal({
  isOpen,
  onClose,
  initialBotName = 'น้อง Botify',
  initialPersonality = 'สุภาพ เรียบร้อย มืออาชีพ และมุ่งมั่นให้บริการ',
}: ChatPlaygroundModalProps) {
  const [botName, setBotName] = useState(initialBotName)
  const [personality, setPersonality] = useState(initialPersonality)
  const [inputQuery, setInputQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: `สวัสดีค่ะ ยินดีต้อนรับสู่ระบบแชทจำลอง! หนูชื่อ "${initialBotName}" พนักงานขาย AI ประจำร้าน ลองพิมพ์ถามข้อมูลสินค้า ราคา หรือโปรโมชั่นเพื่อทดสอบการตอบได้เลยค่ะ`,
      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
    },
  ])

  useEffect(() => {
    if (!isOpen) return
    getPlaygroundQuotaStatus().then((status) => {
      if (status) setQuotaStatus(status)
    })
    getPlaygroundGreeting().then((result) => {
      setMessages((prev) => prev.map((msg) => msg.id === 'welcome' ? { ...msg, text: result.greeting } : msg))
    })
  }, [isOpen])

  if (!isOpen) return null

  const handleSend = async (queryText?: string, simulateQuotaExceeded?: boolean) => {
    const textToSend = simulateQuotaExceeded
      ? '[ทดสอบ] จำลองข้อความเมื่อโควต้าหมด'
      : queryText || inputQuery
    if (!textToSend.trim() || loading) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
    }

    const history = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ sender: m.sender, text: m.text }))

    setMessages((prev) => [...prev, userMsg])
    if (!queryText && !simulateQuotaExceeded) setInputQuery('')
    setLoading(true)

    const res = await testPlaygroundChat(textToSend.trim(), botName, personality, simulateQuotaExceeded, history)
    setLoading(false)

    const timestamp = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })

    if (res.error) {
      setMessages((prev) => [...prev, { id: `${Date.now()}-err`, sender: 'bot', text: res.error!, timestamp }])
      return
    }

    const replies: ChatMessage[] = res.bubbles.map((bubble, i) => ({
      id: `${Date.now()}-${i}`,
      sender: 'bot' as const,
      text: bubble.type === 'image' ? 'ส่งรูปภาพให้ลูกค้า' : bubble.content,
      imageUrl: bubble.type === 'image' ? bubble.content : undefined,
      origin: bubble.origin,
      timestamp,
      quotaExceeded: res.quotaExceeded === true,
    }))

    if (replies.length === 0) {
      replies.push({ id: `${Date.now()}-empty`, sender: 'bot', text: 'ขออภัยค่ะ ระบบทดสอบขัดข้องชั่วคราว', timestamp })
    }

    replies[replies.length - 1].toolCalls = res.toolCalls
    replies[replies.length - 1].scheduled = res.scheduled

    setMessages((prev) => [...prev, ...replies])
  }

  const quickPresets = [
    'จองโต๊ะ 4 คนพรุ่งนี้ 18:00 ได้ไหม',
    'วันนี้มีโต๊ะว่างช่วงเย็นไหม',
    'ขอดูเวลาที่จองได้หน่อย',
    'ยกเลิกการจองต้องทำยังไง',
  ]
  const usagePct =
    quotaStatus && !quotaStatus.isUnlimited && quotaStatus.messageLimit > 0
      ? Math.min(100, Math.round((quotaStatus.messagesUsed / quotaStatus.messageLimit) * 100))
      : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl h-[90vh] max-h-[720px] shadow-2xl flex flex-col overflow-hidden text-slate-100">
        
        {/* Header Bar */}
        <div className="p-3.5 sm:p-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-electric-blue/20 border border-electric-blue/40 flex items-center justify-center text-electric-blue">
                <Bot className="h-5 w-5" />
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full"></span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  placeholder="ชื่อบอท AI"
                  className="bg-slate-800 border border-slate-700 text-slate-100 font-bold text-sm px-2 py-0.5 rounded-lg focus:outline-none focus:border-electric-blue w-36"
                  title="คลิกเพื่อแก้ไขชื่อบอทจำลอง"
                />
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md font-semibold">
                  Online • AI Sales
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                ทดสอบคำตอบของพนักงานขายก่อนใช้งานจริงบน LINE OA
              </p>
              {quotaStatus && (
                <p className="text-[10px] mt-1 flex items-center gap-1.5 font-mono">
                  <span className={quotaStatus.isOverQuota ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                    {quotaStatus.isUnlimited
                      ? 'โควต้าข้อความ: ไม่จำกัด'
                      : `โควต้าข้อความเดือนนี้: ${quotaStatus.messagesUsed.toLocaleString()} / ${quotaStatus.messageLimit.toLocaleString()} (${usagePct}%)`}
                  </span>
                  {quotaStatus.isOverQuota && (
                    <span className="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-1.5 py-0.5 rounded font-bold font-sans">
                      หมดโควต้าแล้ว
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer min-h-[44px] min-w-[44px]"
            aria-label="Close playground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Presets Bar */}
        <div className="p-2.5 bg-slate-950/40 border-b border-slate-800/60 flex items-center gap-2 overflow-x-auto shrink-0">
          <span className="text-[11px] font-bold text-slate-400 shrink-0 ml-1">คำถามตัวอย่าง:</span>
          {quickPresets.map((preset, idx) => (
            <button
              key={idx}
              disabled={loading}
              onClick={() => handleSend(preset.replace(/^[^\s]+\s/, ''))}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/60 whitespace-nowrap transition-colors cursor-pointer disabled:opacity-50 min-h-[36px] flex items-center active:scale-[0.98]"
            >
              {preset}
            </button>
          ))}
          <button
            disabled={loading}
            onClick={() => handleSend(undefined, true)}
            title="ดูตัวอย่างข้อความที่ลูกค้าจะเห็นเมื่อโควต้าหมด โดยไม่หักโควต้าจริงของร้าน"
            className="text-xs px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 whitespace-nowrap transition-colors cursor-pointer disabled:opacity-50 shrink-0 min-h-[36px] flex items-center active:scale-[0.98]"
          >
            จำลองโควต้าหมด
          </button>
        </div>

        {/* Chat History Area */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-950/30">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-end gap-2 max-w-[85%] sm:max-w-[75%]">
                {msg.sender === 'bot' && (
                  <div className="w-7 h-7 rounded-full bg-electric-blue/20 border border-electric-blue/40 flex items-center justify-center text-electric-blue shrink-0 mb-1">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                )}
                <div
                  className={`p-3 rounded-2xl text-xs sm:text-sm whitespace-pre-wrap leading-relaxed shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-electric-blue text-white rounded-br-none'
                      : msg.quotaExceeded
                      ? 'bg-rose-500/10 text-rose-200 border border-rose-500/40 rounded-bl-none'
                      : 'bg-slate-800 text-slate-100 border border-slate-700/80 rounded-bl-none'
                  }`}
                >
                  {msg.origin === 'ack' && (
                    <div className="text-[10px] uppercase tracking-wide text-amber-400/80 mb-1 font-semibold">
                      ข้อความตอบรับทันที (LINE Reply)
                    </div>
                  )}
                  {msg.origin === 'tool' && (
                    <div className="text-[10px] uppercase tracking-wide text-emerald-400/80 mb-1 font-semibold">
                      ส่งแยกอีกข้อความ (LINE Push)
                    </div>
                  )}
                  {msg.text}
                  {msg.imageUrl && (
                    <img
                      src={msg.imageUrl}
                      alt="รูปที่บอทส่งให้ลูกค้า"
                      className="mt-2 rounded-lg max-w-[200px] border border-slate-600"
                    />
                  )}
                </div>
              </div>

              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-1.5 ml-9 text-[10px] text-slate-400 bg-slate-900/60 border border-slate-700/60 rounded-lg px-2.5 py-1.5 max-w-[85%] sm:max-w-[75%]">
                  <span className="text-slate-500">เครื่องมือที่ทำงานจริง: </span>
                  {msg.toolCalls.map((t) => t.name).join(', ')}
                </div>
              )}

              {msg.scheduled && msg.scheduled.length > 0 && (
                <div className="mt-1.5 ml-9 text-[10px] text-slate-400 bg-slate-900/60 border border-slate-700/60 rounded-lg px-2.5 py-1.5 max-w-[85%] sm:max-w-[75%]">
                  {msg.scheduled.map((s, i) => (
                    <div key={i}>ตั้งเวลาส่งอีก {s.delayMinutes} นาที: {s.content}</div>
                  ))}
                </div>
              )}

              <span className="text-[10px] text-slate-500 mt-1 px-1 font-mono">{msg.timestamp}</span>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-slate-400 text-xs bg-slate-800/80 border border-slate-700/60 p-3 rounded-2xl w-fit">
              <span className="w-2 h-2 rounded-full bg-electric-blue animate-bounce"></span>
              <span className="w-2 h-2 rounded-full bg-electric-blue animate-bounce delay-150"></span>
              <span className="w-2 h-2 rounded-full bg-electric-blue animate-bounce delay-300"></span>
              <span className="ml-1 text-slate-300">"{botName}" กำลังประมวลผลคำตอบ...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="พิมพ์คำถามทดสอบที่ลูกค้าอาจถาม (เช่น ราคาเท่าไหร่, ขอส่วนลด)..."
            disabled={loading}
            className="flex-1 bg-slate-800 border border-slate-700/80 text-slate-100 text-xs sm:text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-electric-blue transition-all disabled:opacity-50 placeholder:text-slate-500 min-h-[44px]"
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !inputQuery.trim()}
            className="bg-electric-blue hover:bg-primary text-white font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-electric-blue/20 disabled:opacity-50 cursor-pointer flex items-center gap-1 shrink-0 text-xs sm:text-sm min-h-[44px] min-w-[44px] active:scale-[0.98]"
            aria-label="Send message"
          >
            <span>ส่ง</span>
            <Send className="h-4 w-4" />
          </button>
        </div>

      </div>
    </div>
  )
}
