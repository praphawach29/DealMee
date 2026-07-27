'use client'

import { useState, useEffect } from 'react'
import { testPlaygroundChat, getPlaygroundQuotaStatus } from '../settings/actions'

interface ChatMessage {
  id: string
  sender: 'user' | 'bot'
  text: string
  timestamp: string
  quotaExceeded?: boolean
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
      text: `สวัสดีค่ะ ยินดีต้อนรับสู่ระบบแชทจำลอง! หนูชื่อ "${initialBotName}" พนักงานขาย AI ประจำร้าน ลองพิมพ์ถามข้อมูลสินค้า ราคา หรือโปรโมชั่นเพื่อทดสอบการตอบได้เลยค่ะ 😊`,
      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
    },
  ])

  useEffect(() => {
    if (!isOpen) return
    getPlaygroundQuotaStatus().then((status) => {
      if (status) setQuotaStatus(status)
    })
  }, [isOpen])

  if (!isOpen) return null

  const handleSend = async (queryText?: string, simulateQuotaExceeded?: boolean) => {
    const textToSend = simulateQuotaExceeded
      ? '🚫 [ทดสอบ] จำลองข้อความเมื่อโควต้าหมด'
      : queryText || inputQuery
    if (!textToSend.trim() || loading) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
    }

    // Snapshot before appending the new user message — this becomes the
    // conversation history sent to the AI so it remembers prior turns
    // (e.g. "รับ 2 ตัว" referring to a product mentioned earlier). The
    // Playground never writes to chat_messages like the real LINE webhook
    // does, so without this the AI would have no memory between messages.
    const history = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ sender: m.sender, text: m.text }))

    setMessages((prev) => [...prev, userMsg])
    if (!queryText && !simulateQuotaExceeded) setInputQuery('')
    setLoading(true)

    const res = await testPlaygroundChat(textToSend.trim(), botName, personality, simulateQuotaExceeded, history)
    setLoading(false)

    const botReply: ChatMessage = {
      id: (Date.now() + 1).toString(),
      sender: 'bot',
      text: res.response || 'ขออภัยค่ะ ระบบทดสอบขัดข้องชั่วคราว',
      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      quotaExceeded: res.quotaExceeded === true,
    }

    setMessages((prev) => [...prev, botReply])
  }

  const quickPresets = [
    '🛍️ มีสินค้าอะไรพร้อมส่งบ้าง',
    '💰 มีโปรโมชั่นหรือส่วนลดไหม',
    '💳 ขอช่องทางชำระเงินหน่อย',
    '🚚 คิดค่าจัดส่งเท่าไหร่',
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
              <div className="w-10 h-10 rounded-full bg-electric-blue/20 border border-electric-blue/40 flex items-center justify-center text-electric-blue font-bold text-lg">
                🤖
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
                <p className="text-[10px] mt-1 flex items-center gap-1.5">
                  <span className={quotaStatus.isOverQuota ? 'text-rose-400 font-bold' : 'text-slate-500'}>
                    {quotaStatus.isUnlimited
                      ? 'โควต้าข้อความ: ไม่จำกัด'
                      : `โควต้าข้อความเดือนนี้: ${quotaStatus.messagesUsed.toLocaleString()} / ${quotaStatus.messageLimit.toLocaleString()} (${usagePct}%)`}
                  </span>
                  {quotaStatus.isOverQuota && (
                    <span className="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-1.5 py-0.5 rounded font-bold">
                      หมดโควต้าแล้ว
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
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
              className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/60 whitespace-nowrap transition-colors cursor-pointer disabled:opacity-50"
            >
              {preset}
            </button>
          ))}
          <button
            disabled={loading}
            onClick={() => handleSend(undefined, true)}
            title="ดูตัวอย่างข้อความที่ลูกค้าจะเห็นเมื่อโควต้าหมด โดยไม่หักโควต้าจริงของร้าน"
            className="text-xs px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 whitespace-nowrap transition-colors cursor-pointer disabled:opacity-50 shrink-0"
          >
            🚫 จำลองโควต้าหมด
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
                  <div className="w-7 h-7 rounded-full bg-electric-blue/20 border border-electric-blue/40 flex items-center justify-center text-xs shrink-0 mb-1">
                    🤖
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
                  {msg.text}
                </div>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 px-1">{msg.timestamp}</span>
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
            className="flex-1 bg-slate-800 border border-slate-700/80 text-slate-100 text-xs sm:text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-electric-blue transition-all disabled:opacity-50 placeholder:text-slate-500"
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !inputQuery.trim()}
            className="bg-electric-blue hover:bg-primary text-white font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-electric-blue/20 disabled:opacity-50 cursor-pointer flex items-center gap-1 shrink-0 text-xs sm:text-sm"
          >
            <span>ส่ง</span>
            <span className="material-symbols-outlined text-[16px]">send</span>
          </button>
        </div>

      </div>
    </div>
  )
}
