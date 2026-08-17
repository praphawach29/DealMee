'use client'

import { useState, useEffect, useRef } from 'react'
import { sendMessage, toggleHandoffStatus, createMockConversation } from './actions'
import { getSalesStageMeta, type SalesStage } from '@/lib/ai/salesWorkflow'

export interface Conversation {
  id: string
  shop_id: string
  user_id: string
  customer_name: string
  customer_avatar: string | null
  platform: string
  last_message: string | null
  last_message_at: string
  unread_count: number
  status: 'ai' | 'human' | 'closed'
  sales_stage?: 'greeting' | 'showcase' | 'closing' | 'post_sale' | string | null
  created_at: string
}

export interface ChatMessage {
  id: string
  conversation_id: string
  shop_id: string
  sender_type: 'user' | 'bot' | 'agent'
  sender_name: string | null
  message: string
  created_at: string
}

interface InboxViewProps {
  conversations: Conversation[]
  messagesMap: Record<string, ChatMessage[]>
}

import CustomerProfileDrawer from './CustomerProfileDrawer'

export default function InboxView({ conversations, messagesMap }: InboxViewProps) {
  const [selectedConvId, setSelectedConvId] = useState<string | null>(
    conversations.length > 0 ? conversations[0].id : null
  )
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | 'ai' | 'human'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showProfileDrawer, setShowProfileDrawer] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const activeConv = conversations.find(c => c.id === selectedConvId)
  const rawActiveMessages = selectedConvId ? (messagesMap[selectedConvId] || []) : []
  // Filter out internal system/tool execution logs so only real conversation text is shown
  const activeMessages = rawActiveMessages.filter(
    msg => !msg.message.startsWith('[Tool:') && !msg.message.startsWith('[System:') && !msg.message.startsWith('[Evaluation:')
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages])

  const filteredConversations = conversations.filter(c => {
    const cleanLastMessage = c.last_message && c.last_message.startsWith('[Tool:') ? '' : c.last_message
    const matchesSearch = c.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (cleanLastMessage && cleanLastMessage.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesFilter = filterStatus === 'all' || c.status === filterStatus
    return matchesSearch && matchesFilter
  })

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedConvId || !inputText.trim() || loading) return

    const textToSend = inputText
    setInputText('')
    setLoading(true)

    const res = await sendMessage(selectedConvId, textToSend)
    setLoading(false)

    if (res?.error) {
      alert(res.error)
      setInputText(textToSend)
    }
  }

  async function handleToggleStatus(newStatus: 'ai' | 'human') {
    if (!selectedConvId) return
    setLoading(true)
    const res = await toggleHandoffStatus(selectedConvId, newStatus)
    setLoading(false)
    if (res?.error) {
      alert(res.error)
    }
  }

  async function handleCreateMock() {
    setLoading(true)
    const res = await createMockConversation()
    setLoading(false)
    if (res?.error) {
      alert(res.error)
    }
  }

  return (
    <div className="h-[calc(100vh-8.5rem)] sm:h-[calc(100vh-9.5rem)] min-h-[550px] flex border border-outline-variant/40 bg-surface rounded-2xl shadow-sm overflow-hidden">
      
      {/* Pane 1: Conversations List (Hidden on mobile if a conversation is selected) */}
      <div className={`w-full md:w-72 lg:w-80 shrink-0 border-r border-outline-variant/30 flex-col bg-surface-container-lowest ${
        selectedConvId ? 'hidden md:flex' : 'flex'
      }`}>
        
        {/* Header & Filter */}
        <div className="p-3.5 sm:p-4 border-b border-outline-variant/30 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-base sm:text-lg font-bold text-on-surface font-headline-sm">กล่องข้อความ</h1>
            <button
              onClick={handleCreateMock}
              disabled={loading}
              className="text-xs bg-electric-blue/10 text-electric-blue hover:bg-electric-blue/20 font-bold px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer shrink-0"
              title="สร้างแชทจำลองสำหรับทดสอบ"
            >
              <span className="material-symbols-outlined text-[15px]">add</span>
              <span>จำลองแชท</span>
            </button>
          </div>

          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อลูกค้า..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-outline-variant rounded-xl bg-merchant-bg text-on-surface focus:outline-none focus:border-electric-blue"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex gap-1 overflow-x-auto pb-0.5">
            <button
              onClick={() => setFilterStatus('all')}
              className={`flex-1 py-1 px-2 text-[11px] font-bold rounded-lg transition-all shrink-0 ${
                filterStatus === 'all'
                  ? 'bg-electric-blue text-white shadow-xs'
                  : 'bg-surface text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              ทั้งหมด ({conversations.length})
            </button>
            <button
              onClick={() => setFilterStatus('ai')}
              className={`flex-1 py-1 px-2 text-[11px] font-bold rounded-lg transition-all shrink-0 ${
                filterStatus === 'ai'
                  ? 'bg-electric-blue text-white shadow-xs'
                  : 'bg-surface text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              🤖 AI ({conversations.filter(c => c.status === 'ai').length})
            </button>
            <button
              onClick={() => setFilterStatus('human')}
              className={`flex-1 py-1 px-2 text-[11px] font-bold rounded-lg transition-all shrink-0 ${
                filterStatus === 'human'
                  ? 'bg-electric-blue text-white shadow-xs'
                  : 'bg-surface text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              👤 แอดมิน ({conversations.filter(c => c.status === 'human').length})
            </button>
          </div>
        </div>

        {/* Conversation Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/20">
          {filteredConversations.length > 0 ? (
            filteredConversations.map((conv) => {
              const isSelected = conv.id === selectedConvId
              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`p-3 sm:p-3.5 cursor-pointer transition-all flex items-start gap-3 relative ${
                    isSelected
                      ? 'bg-surface-container-high border-l-4 border-l-electric-blue'
                      : 'hover:bg-surface-container'
                  }`}
                >
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-electric-blue/10 text-electric-blue flex items-center justify-center font-bold shrink-0 text-xs sm:text-sm">
                    {conv.customer_name.charAt(0)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h3 className="text-xs sm:text-sm font-bold text-on-surface truncate">{conv.customer_name}</h3>
                      <span className="text-[10px] text-outline shrink-0">
                        {new Date(conv.last_message_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-[11px] sm:text-xs text-on-surface-variant truncate font-body-sm mb-1.5">
                      {conv.last_message && conv.last_message.startsWith('[Tool:') ? 'แอดมิน/บอทอยู่ระหว่างช่วยเหลือลูกค้า' : (conv.last_message || 'ยังไม่มีข้อความ')}
                    </p>

                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <div className="flex items-center gap-1">
                        <span className={`px-2 py-0.5 text-[9px] sm:text-[10px] font-bold rounded-md flex items-center gap-1 ${
                          conv.status === 'ai'
                            ? 'bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                            : 'bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                        }`}>
                          <span className="material-symbols-outlined text-[11px]">
                            {conv.status === 'ai' ? 'smart_toy' : 'person'}
                          </span>
                          {conv.status === 'ai' ? 'AI ตอบ' : 'แอดมินตอบ'}
                        </span>

                        {(() => {
                          const stageMeta = getSalesStageMeta(conv.sales_stage)
                          return (
                            <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border flex items-center gap-1 ${stageMeta.badgeClass}`}>
                              <span className={`w-1 h-1 rounded-full ${stageMeta.dotClass}`} />
                              <span>{stageMeta.label}</span>
                            </span>
                          )
                        })()}
                      </div>

                      <span className="text-[9px] bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800 px-1.5 py-0.5 rounded font-bold border border-green-200">
                        LINE
                      </span>
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="p-8 text-center text-outline">
              <span className="material-symbols-outlined text-3xl mb-2">forum</span>
              <p className="text-xs">ไม่พบแชทที่ค้นหา</p>
              <button
                onClick={handleCreateMock}
                className="mt-3 text-xs bg-electric-blue text-white px-3 py-1.5 rounded-lg font-bold cursor-pointer"
              >
                + สร้างแชทจำลองทดสอบ
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Pane 2: Active Chat Room (Hidden on mobile if no conversation selected) */}
      {activeConv ? (
        <div className={`flex-1 flex-col bg-merchant-bg min-w-0 ${
          selectedConvId ? 'flex' : 'hidden md:flex'
        }`}>
          
          {/* Active Chat Top Bar */}
          <div className="p-3 sm:p-4 bg-surface border-b border-outline-variant/30 flex items-center justify-between shadow-xs shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              {/* Back button for mobile */}
              <button
                onClick={() => setSelectedConvId(null)}
                className="md:hidden p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container shrink-0"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              </button>

              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-electric-blue/10 text-electric-blue flex items-center justify-center font-bold text-xs sm:text-sm shrink-0">
                {activeConv.customer_name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xs sm:text-sm font-bold text-on-surface flex items-center gap-1.5 truncate">
                  <span className="truncate">{activeConv.customer_name}</span>
                  <span className="text-[9px] bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800 px-1.5 py-0.5 rounded font-bold border border-green-200 shrink-0">
                    LINE OA
                  </span>
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[10px] text-outline font-mono truncate">ID: {activeConv.user_id}</p>
                  {(() => {
                    const activeStage = getSalesStageMeta(activeConv.sales_stage)
                    return (
                      <span className={`px-2 py-0.2 text-[9px] font-bold rounded-md flex items-center gap-1 border ${activeStage.badgeClass}`} title={activeStage.description}>
                        <span className={`w-1.5 h-1.5 rounded-full ${activeStage.dotClass}`} />
                        <span>ขั้นตอน: {activeStage.label}</span>
                      </span>
                    )
                  })()}
                </div>
              </div>
            </div>

            {/* Human Handoff Toggle */}
            <div className="flex items-center gap-2 shrink-0">
              {activeConv.status === 'ai' ? (
                <button
                  onClick={() => handleToggleStatus('human')}
                  disabled={loading}
                  className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white text-[11px] sm:text-xs font-bold px-3 py-1.5 sm:py-2 rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">back_hand</span>
                  <span className="hidden sm:inline">Takeover (แอดมินคุยแทน)</span>
                  <span className="sm:hidden">คุยแทน</span>
                </button>
              ) : (
                <button
                  onClick={() => handleToggleStatus('ai')}
                  disabled={loading}
                  className="flex items-center gap-1 bg-electric-blue hover:bg-primary text-white text-[11px] sm:text-xs font-bold px-3 py-1.5 sm:py-2 rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">smart_toy</span>
                  <span className="hidden sm:inline">ให้ AI ตอบต่อ</span>
                  <span className="sm:hidden">ให้ AI ตอบ</span>
                </button>
              )}

              <button
                onClick={() => setShowProfileDrawer(!showProfileDrawer)}
                className={`p-2 rounded-xl border transition-all flex items-center gap-1 text-xs font-bold ${
                  showProfileDrawer
                    ? 'bg-electric-blue text-white border-electric-blue'
                    : 'bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-container'
                }`}
                title="เปิด/ปิด โปรไฟล์ความจำลูกค้า"
              >
                <span className="material-symbols-outlined text-base">person_search</span>
                <span className="hidden lg:inline">AI Memory</span>
              </button>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-3.5 sm:p-6 overflow-y-auto space-y-3 sm:space-y-4">
            {activeMessages.map((msg) => {
              const isUser = msg.sender_type === 'user'
              const isBot = msg.sender_type === 'bot'
              const isAgent = msg.sender_type === 'agent'

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1 mb-1 text-[10px] sm:text-[11px] text-outline">
                    {isBot && <span className="material-symbols-outlined text-[13px] text-electric-blue">smart_toy</span>}
                    {isAgent && <span className="material-symbols-outlined text-[13px] text-purple-600">support_agent</span>}
                    <span className="font-bold">{msg.sender_name || (isUser ? 'ลูกค้า' : isBot ? 'Bot' : 'แอดมิน')}</span>
                    <span>•</span>
                    <span>{new Date(msg.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  <div
                    className={`max-w-[85%] sm:max-w-md p-2.5 sm:p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                      isAgent
                        ? 'bg-electric-blue text-white rounded-tr-xs shadow-xs'
                        : isBot
                        ? 'bg-blue-50 text-blue-950 border border-blue-200/60 rounded-tl-xs shadow-xs'
                        : 'bg-surface border border-outline-variant/40 text-on-surface rounded-tl-xs shadow-xs'
                    }`}
                  >
                    {msg.message}
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input Bar */}
          <form onSubmit={handleSend} className="p-2.5 sm:p-4 bg-surface border-t border-outline-variant/30 flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={activeConv.status === 'ai' ? "พิมพ์ตอบกลับ (สลับเป็นแอดมินให้อัตโนมัติ)..." : "พิมพ์ข้อความตอบกลับ..."}
              className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm border border-outline-variant rounded-xl bg-merchant-bg text-on-surface focus:outline-none focus:border-electric-blue"
            />
            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              className="bg-electric-blue hover:bg-primary text-white p-2 sm:p-2.5 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center cursor-pointer shadow-sm shrink-0"
            >
              <span className="material-symbols-outlined text-[18px] sm:text-[22px]">send</span>
            </button>
          </form>
        </div>
      ) : (
        /* Empty State Chat Room */
        <div className="hidden md:flex flex-1 flex-col items-center justify-center p-8 bg-merchant-bg text-center">
          <div className="w-14 h-14 bg-electric-blue/10 rounded-full flex items-center justify-center text-electric-blue mb-4">
            <span className="material-symbols-outlined text-2xl">chat</span>
          </div>
          <h2 className="text-base font-bold text-on-surface mb-1">เลือกรายการแชทเพื่อเริ่มสนทนา</h2>
          <p className="text-xs text-outline max-w-xs mb-6">
            คลิกเลือกชื่อลูกค้าจากแถบซ้ายมือเพื่อดูประวัติการสนทนาและพิมพ์ตอบกลับ
          </p>
          <button
            onClick={handleCreateMock}
            className="bg-electric-blue text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md cursor-pointer"
          >
            + สร้างแชทจำลองทดสอบ
          </button>
        </div>
      )}

      {/* Pane 3: Customer Sidebar Info or AI Memory Drawer */}
      {activeConv && showProfileDrawer && (
        <CustomerProfileDrawer
          userId={activeConv.user_id}
          customerName={activeConv.customer_name}
          onClose={() => setShowProfileDrawer(false)}
        />
      )}

      {activeConv && !showProfileDrawer && (
        <div className="hidden lg:flex w-64 xl:w-72 border-l border-outline-variant/30 bg-surface flex-col p-5 space-y-5 shrink-0">
          <div className="text-center space-y-2 pb-4 border-b border-outline-variant/30">
            <div className="w-14 h-14 rounded-full bg-electric-blue/10 text-electric-blue flex items-center justify-center font-bold text-xl mx-auto">
              {activeConv.customer_name.charAt(0)}
            </div>
            <h3 className="font-bold text-on-surface text-sm truncate">{activeConv.customer_name}</h3>
            <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-bold border border-green-200 inline-block">
              LINE Official Account
            </span>
          </div>

          <div className="space-y-3.5 text-xs">
            <h4 className="font-bold text-outline uppercase tracking-wider text-[10px]">รายละเอียดลูกค้า</h4>
            
            <div className="space-y-1">
              <p className="text-outline">Platform ID:</p>
              <p className="font-mono text-on-surface font-semibold text-[11px] truncate">{activeConv.user_id}</p>
            </div>

            <div className="space-y-1">
              <p className="text-outline">สถานะการตอบ:</p>
              <p className="font-semibold text-on-surface flex items-center gap-1.5 text-xs">
                <span className={`w-2 h-2 rounded-full ${activeConv.status === 'ai' ? 'bg-blue-500' : 'bg-amber-500'}`}></span>
                {activeConv.status === 'ai' ? 'บอท AI ควบคุมอยู่' : 'แอดมินเข้าควบคุมแล้ว'}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-outline">เริ่มสนทนาเมื่อ:</p>
              <p className="font-semibold text-on-surface text-xs" suppressHydrationWarning>
                {new Date(activeConv.created_at).toLocaleDateString('th-TH')}
              </p>
            </div>

            <button
              onClick={() => setShowProfileDrawer(true)}
              className="w-full py-2 px-3 bg-electric-blue/10 text-electric-blue hover:bg-electric-blue/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 mt-4"
            >
              <span className="material-symbols-outlined text-sm">person_search</span>
              <span>ดูข้อมูล AI Memory</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
