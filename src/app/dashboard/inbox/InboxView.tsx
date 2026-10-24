'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { sendMessage, toggleHandoffStatus, toggleAiMode, createMockConversation, generateAiSuggestion } from './actions'
import { getSalesStageMeta, type SalesStage } from '@/lib/ai/salesWorkflow'
import {
  SupportedPlatform,
  AiMode,
  PLATFORM_CONFIG,
  AI_MODE_CONFIG,
  normalizePlatform,
  ConversationOmnichannel,
  ChatMessageOmnichannel,
} from '@/types/omnichannel'
import CustomerProfileDrawer from './CustomerProfileDrawer'
import { MARKETPLACE_CHANNELS_ENABLED } from '@/lib/channels/availability'

export type Conversation = ConversationOmnichannel
export type ChatMessage = ChatMessageOmnichannel

/** Why the bot is not answering anyone in this shop right now (null = it is working) */
export type BotMuted = { reason: 'auto_reply_off' | 'business_hours'; detail: string } | null

interface InboxViewProps {
  conversations: Conversation[]
  messagesMap: Record<string, ChatMessage[]>
  botMuted?: BotMuted
}

/** "14:42 น." for the moment the bot takes a paused chat back */
function resumeTimeText(pausedUntil?: string | null): string {
  if (!pausedUntil) return ''
  const at = new Date(pausedUntil)
  if (Number.isNaN(at.getTime()) || at.getTime() <= Date.now()) return ''
  return at.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
}

export default function InboxView({ conversations, messagesMap, botMuted = null }: InboxViewProps) {
  const router = useRouter()
  const [selectedConvId, setSelectedConvId] = useState<string | null>(
    conversations.length > 0 ? conversations[0].id : null
  )
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | 'ai' | 'human'>('all')
  const [filterPlatform, setFilterPlatform] = useState<'all' | SupportedPlatform>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showProfileDrawer, setShowProfileDrawer] = useState(false)
  const [showMockMenu, setShowMockMenu] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const activeConv = conversations.find(c => c.id === selectedConvId)
  const rawActiveMessages = selectedConvId ? (messagesMap[selectedConvId] || []) : []
  // Filter out internal system/tool execution logs so only real conversation text is shown
  const activeMessages = rawActiveMessages.filter(
    msg => !msg.message.startsWith('[Tool:') && !msg.message.startsWith('[System:') && !msg.message.startsWith('[Evaluation:')
  )

  // Find latest AI suggestion if any
  const latestAiSuggestion = [...activeMessages]
    .reverse()
    .find(m => m.ai_suggested_reply)?.ai_suggested_reply

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages])

  // Polling auto-refresh every 5 seconds to sync incoming messages and statuses
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh()
    }, 5000)
    return () => clearInterval(interval)
  }, [router])

  const filteredConversations = conversations.filter(c => {
    const cleanLastMessage = c.last_message && c.last_message.startsWith('[Tool:') ? '' : c.last_message
    const matchesSearch = c.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (cleanLastMessage && cleanLastMessage.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesFilter = filterStatus === 'all' || c.status === filterStatus
    const convPlat = normalizePlatform(c.platform)
    const matchesPlatform = filterPlatform === 'all' || convPlat === filterPlatform
    return matchesSearch && matchesFilter && matchesPlatform
  })

  async function handleSend(e?: React.FormEvent, customText?: string) {
    if (e) e.preventDefault()
    const textToSend = customText ?? inputText
    if (!selectedConvId || !textToSend.trim() || loading) return

    setInputText('')
    setLoading(true)

    const res = await sendMessage(selectedConvId, textToSend)
    setLoading(false)

    if (res?.error) {
      alert(res.error)
      setInputText(textToSend)
    } else {
      router.refresh()
    }
  }

  async function handleToggleStatus(newStatus: 'ai' | 'human') {
    if (!selectedConvId) return
    setLoading(true)
    const res = await toggleHandoffStatus(selectedConvId, newStatus)
    setLoading(false)
    if (res?.error) {
      alert(res.error)
    } else {
      router.refresh()
    }
  }

  async function handleToggleAiMode(newMode: AiMode) {
    if (!selectedConvId) return
    setLoading(true)
    const res = await toggleAiMode(selectedConvId, newMode)
    setLoading(false)
    if (res?.error) {
      alert(res.error)
    } else {
      router.refresh()
    }
  }

  async function handleCreateMock(platform: SupportedPlatform = 'line') {
    setShowMockMenu(false)
    setLoading(true)
    const res = await createMockConversation(platform)
    setLoading(false)
    if (res?.error) {
      alert(res.error)
    } else {
      router.refresh()
    }
  }

  async function handleGenerateSuggestion() {
    if (!selectedConvId || suggestLoading) return
    setSuggestLoading(true)
    const res = await generateAiSuggestion(selectedConvId)
    setSuggestLoading(false)
    if (res?.error) {
      alert(res.error)
    } else {
      router.refresh()
    }
  }

  return (
    <div className="space-y-3">
    {/* The bot is off for the whole shop: say so here, where the silence is noticed */}
    {botMuted && (
      <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-200">
        <span className="material-symbols-outlined text-[18px] text-amber-600 shrink-0">smart_toy</span>
        <div>
          <p className="font-bold">ตอนนี้บอทไม่ได้ตอบลูกค้าอัตโนมัติ</p>
          <p className="mt-0.5 opacity-90">{botMuted.detail}</p>
        </div>
      </div>
    )}
    <div className="h-[calc(100vh-8.5rem)] sm:h-[calc(100vh-9.5rem)] min-h-[550px] flex border border-outline-variant/40 bg-surface rounded-2xl shadow-sm overflow-hidden">
      
      {/* Pane 1: Conversations List */}
      <div className={`w-full md:w-72 lg:w-80 shrink-0 border-r border-outline-variant/30 flex-col bg-surface-container-lowest ${
        selectedConvId ? 'hidden md:flex' : 'flex'
      }`}>
        
        {/* Header & Filter */}
        <div className="p-3.5 sm:p-4 border-b border-outline-variant/30 space-y-3">
          <div className="flex items-center justify-between relative">
            <div>
              <h1 className="text-base sm:text-lg font-bold text-on-surface font-headline-sm">Omnichannel Inbox</h1>
              <p className="text-[10px] text-outline">รวมแชททุกช่องทางในที่เดียว</p>
            </div>
            
            <div className="relative">
              <button
                onClick={() => setShowMockMenu(!showMockMenu)}
                disabled={loading}
                className="text-xs bg-electric-blue/10 text-electric-blue hover:bg-electric-blue/20 font-bold px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer shrink-0"
                title="สร้างแชทจำลองทดสอบ"
              >
                <span className="material-symbols-outlined text-[15px]">add</span>
                <span>จำลองแชท</span>
              </button>

              {/* Mock Platform Menu */}
              {showMockMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-surface border border-outline-variant rounded-xl shadow-lg z-50 p-1.5 space-y-1">
                  <div className="text-[10px] font-bold text-outline px-2 py-1">เลือกช่องทางจำลอง:</div>
                  <button
                    onClick={() => handleCreateMock('line')}
                    className="w-full text-left px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-emerald-50 text-emerald-700 flex items-center gap-2 cursor-pointer"
                  >
                    <span>🟢 LINE OA</span>
                  </button>
                  <button
                    onClick={() => handleCreateMock('facebook')}
                    className="w-full text-left px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-blue-50 text-blue-700 flex items-center gap-2 cursor-pointer"
                  >
                    <span>🔵 Facebook Page</span>
                  </button>
                  {MARKETPLACE_CHANNELS_ENABLED && (
                  <>
                  <button
                    onClick={() => handleCreateMock('tiktok')}
                    className="w-full text-left px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 text-slate-800 flex items-center gap-2 cursor-pointer"
                  >
                    <span>⚫ TikTok Shop</span>
                  </button>
                  <button
                    onClick={() => handleCreateMock('shopee')}
                    className="w-full text-left px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-orange-50 text-orange-700 flex items-center gap-2 cursor-pointer"
                  >
                    <span>🟠 Shopee</span>
                  </button>
                  </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อลูกค้าหรือข้อความ..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-outline-variant rounded-xl bg-merchant-bg text-on-surface focus:outline-none focus:border-electric-blue"
            />
          </div>

          {/* Platform Channel Filter Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setFilterPlatform('all')}
              className={`py-1 px-2.5 text-[11px] font-bold rounded-lg transition-all shrink-0 cursor-pointer ${
                filterPlatform === 'all'
                  ? 'bg-on-surface text-surface shadow-xs'
                  : 'bg-surface text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              ทั้งหมด
            </button>
            <button
              onClick={() => setFilterPlatform('line')}
              className={`py-1 px-2 text-[11px] font-bold rounded-lg transition-all shrink-0 cursor-pointer ${
                filterPlatform === 'line'
                  ? 'bg-[#06C755] text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              LINE
            </button>
            <button
              onClick={() => setFilterPlatform('facebook')}
              className={`py-1 px-2 text-[11px] font-bold rounded-lg transition-all shrink-0 cursor-pointer ${
                filterPlatform === 'facebook'
                  ? 'bg-[#1877F2] text-white shadow-xs'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              Facebook
            </button>
            {MARKETPLACE_CHANNELS_ENABLED && (
            <>
            <button
              onClick={() => setFilterPlatform('tiktok')}
              className={`py-1 px-2 text-[11px] font-bold rounded-lg transition-all shrink-0 cursor-pointer ${
                filterPlatform === 'tiktok'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
              }`}
            >
              TikTok
            </button>
            <button
              onClick={() => setFilterPlatform('shopee')}
              className={`py-1 px-2 text-[11px] font-bold rounded-lg transition-all shrink-0 cursor-pointer ${
                filterPlatform === 'shopee'
                  ? 'bg-[#EE4D2D] text-white shadow-xs'
                  : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
              }`}
            >
              Shopee
            </button>
            </>
            )}
          </div>

          {/* AI / Human Filter Pills */}
          <div className="flex gap-1 overflow-x-auto pb-0.5">
            <button
              onClick={() => setFilterStatus('all')}
              className={`flex-1 py-1 px-2 text-[10px] font-bold rounded-lg transition-all shrink-0 cursor-pointer ${
                filterStatus === 'all'
                  ? 'bg-electric-blue text-white shadow-xs'
                  : 'bg-surface text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              รวม ({filteredConversations.length})
            </button>
            <button
              onClick={() => setFilterStatus('ai')}
              className={`flex-1 py-1 px-2 text-[10px] font-bold rounded-lg transition-all shrink-0 cursor-pointer ${
                filterStatus === 'ai'
                  ? 'bg-electric-blue text-white shadow-xs'
                  : 'bg-surface text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              🤖 AI ({conversations.filter(c => c.status === 'ai').length})
            </button>
            <button
              onClick={() => setFilterStatus('human')}
              className={`flex-1 py-1 px-2 text-[10px] font-bold rounded-lg transition-all shrink-0 cursor-pointer ${
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
              const platKey = normalizePlatform(conv.platform)
              const platConfig = PLATFORM_CONFIG[platKey] || PLATFORM_CONFIG.line
              const curAiMode = conv.ai_mode || (conv.status === 'human' ? 'manual' : 'auto')

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
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-electric-blue/10 text-electric-blue flex items-center justify-center font-bold shrink-0 text-xs sm:text-sm relative">
                    {conv.customer_name.charAt(0)}
                    {/* Platform mini indicator on avatar */}
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border border-surface flex items-center justify-center text-[8px] font-bold text-white shadow-xs"
                      style={{ backgroundColor: platConfig.color }}
                      title={platConfig.name}
                    >
                      {platConfig.shortLabel.charAt(0)}
                    </span>
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
                        {/* AI Mode Badge */}
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md flex items-center gap-0.5 border ${
                          curAiMode === 'auto'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : curAiMode === 'copilot'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          <span>
                            {curAiMode === 'auto' ? '🤖 Auto' : curAiMode === 'copilot' ? '💡 Copilot' : '👤 แอดมิน'}
                          </span>
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

                      {/* Omnichannel Platform Badge */}
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${platConfig.badgeClass}`}>
                        {platConfig.shortLabel}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="p-8 text-center text-outline">
              <span className="material-symbols-outlined text-3xl mb-2">forum</span>
              <p className="text-xs">ไม่พบแชทในหมวดที่เลือก</p>
              <button
                onClick={() => handleCreateMock('line')}
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
          {/* Active Chat Header */}
          <div className="p-3 sm:p-4 bg-surface border-b border-outline-variant/30 flex items-center justify-between shadow-xs shrink-0">
            {(() => {
              const activePlatKey = normalizePlatform(activeConv.platform)
              const activePlatConfig = PLATFORM_CONFIG[activePlatKey] || PLATFORM_CONFIG.line
              const activeAiMode = activeConv.ai_mode || (activeConv.status === 'human' ? 'manual' : 'auto')

              return (
                <>
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    {/* Back button for mobile */}
                    <button
                      onClick={() => setSelectedConvId(null)}
                      className="md:hidden p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container shrink-0 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                    </button>

                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-electric-blue/10 text-electric-blue flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 relative">
                      {activeConv.customer_name.charAt(0)}
                      <span
                        className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border border-surface flex items-center justify-center text-[8px] font-bold text-white shadow-xs"
                        style={{ backgroundColor: activePlatConfig.color }}
                        title={activePlatConfig.name}
                      >
                        {activePlatConfig.shortLabel.charAt(0)}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <h2 className="text-xs sm:text-sm font-bold text-on-surface flex items-center gap-1.5 truncate">
                        <span className="truncate">{activeConv.customer_name}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border shrink-0 ${activePlatConfig.badgeClass}`}>
                          {activePlatConfig.name}
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

                  {/* AI Mode Selector & Quick Controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* AI Mode Pill Switcher */}
                    <div className="hidden sm:flex items-center bg-surface-container p-0.5 rounded-xl border border-outline-variant/40 text-xs">
                      <button
                        onClick={() => handleToggleAiMode('auto')}
                        disabled={loading}
                        className={`px-2 py-1 rounded-lg font-bold text-[10px] sm:text-[11px] transition-all cursor-pointer ${
                          activeAiMode === 'auto'
                            ? 'bg-electric-blue text-white shadow-xs'
                            : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                        title="AI ปิดดีลอัตโนมัติ 24/7"
                      >
                        🤖 Auto
                      </button>
                      <button
                        onClick={() => handleToggleAiMode('copilot')}
                        disabled={loading}
                        className={`px-2 py-1 rounded-lg font-bold text-[10px] sm:text-[11px] transition-all cursor-pointer ${
                          activeAiMode === 'copilot'
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                        title="AI ช่วยร่างคำตอบ แอดมินตรวจสอบก่อนส่ง"
                      >
                        💡 Copilot
                      </button>
                      <button
                        onClick={() => handleToggleAiMode('manual')}
                        disabled={loading}
                        className={`px-2 py-1 rounded-lg font-bold text-[10px] sm:text-[11px] transition-all cursor-pointer ${
                          activeAiMode === 'manual'
                            ? 'bg-slate-700 text-white shadow-xs'
                            : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                        title="แอดมินพิมพ์คุยเอง 100%"
                      >
                        👤 แอดมิน
                      </button>
                    </div>

                    {/* Mobile fallback button */}
                    <div className="sm:hidden">
                      {activeConv.status === 'ai' ? (
                        <button
                          onClick={() => handleToggleStatus('human')}
                          disabled={loading}
                          className="bg-amber-500 text-white text-[10px] font-bold px-2 py-1.5 rounded-lg"
                        >
                          คุยแทน
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleStatus('ai')}
                          disabled={loading}
                          className="bg-electric-blue text-white text-[10px] font-bold px-2 py-1.5 rounded-lg"
                        >
                          ให้ AI
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => setShowProfileDrawer(!showProfileDrawer)}
                      className={`p-2 rounded-xl border transition-all flex items-center gap-1 text-xs font-bold cursor-pointer ${
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
                </>
              )
            })()}
          </div>

          {/* Pause Status Alert Banner */}
          {activeConv.status === 'human' && (() => {
            const resumeAt = resumeTimeText(activeConv.paused_until)
            return (
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-3.5 sm:px-4 py-2 flex items-center justify-between text-xs text-amber-700 dark:text-amber-300 shrink-0">
              <div className="flex items-center gap-1.5 font-medium">
                <span className="material-symbols-outlined text-[17px] text-amber-600">pause_circle</span>
                <span>
                  โหมดแอดมินคุยแทน: บอท AI หยุดตอบชั่วคราว
                  {resumeAt ? ` และจะกลับมาตอบเองเวลา ${resumeAt}` : ' และจะกลับมาตอบเองภายใน 1 ชั่วโมง'}
                </span>
              </div>
              <button
                onClick={() => handleToggleAiMode('auto')}
                disabled={loading}
                className="text-[11px] underline font-bold hover:text-amber-900 dark:hover:text-amber-100 cursor-pointer ml-2 shrink-0"
              >
                เปิด Auto ทันที
              </button>
            </div>
            )
          })()}

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

          {/* AI Copilot Suggestion Box (for Copilot / Suggest mode) */}
          {latestAiSuggestion && (
            <div className="mx-3 sm:mx-4 mb-2 p-3 bg-gradient-to-r from-amber-500/10 to-electric-blue/10 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shrink-0 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-start gap-2 text-xs text-on-surface min-w-0">
                <span className="material-symbols-outlined text-amber-500 text-[18px] shrink-0 mt-0.5">auto_awesome</span>
                <div>
                  <span className="font-bold text-amber-700 dark:text-amber-400">💡 AI ร่างคำตอบแนะนำ: </span>
                  <span className="text-on-surface-variant italic">&quot;{latestAiSuggestion}&quot;</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={() => setInputText(latestAiSuggestion)}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-surface border border-outline-variant hover:bg-surface-container text-on-surface transition-all cursor-pointer"
                >
                  นำไปแก้ไข
                </button>
                <button
                  type="button"
                  onClick={() => handleSend(undefined, latestAiSuggestion)}
                  disabled={loading}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-electric-blue hover:bg-primary text-white shadow-xs transition-all cursor-pointer flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[13px]">send</span>
                  <span>ส่งทันที</span>
                </button>
              </div>
            </div>
          )}

          {/* Quick Action Chips & AI Generate Prompt */}
          <div className="px-3 sm:px-4 py-1.5 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0 bg-surface/50 border-t border-outline-variant/20">
            <button
              type="button"
              onClick={handleGenerateSuggestion}
              disabled={suggestLoading || loading}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-gradient-to-r from-purple-500/15 to-electric-blue/15 hover:from-purple-500/25 hover:to-electric-blue/25 text-purple-700 dark:text-purple-300 border border-purple-500/30 transition-all cursor-pointer flex items-center gap-1 shrink-0 disabled:opacity-50"
              title="ให้ AI ช่วยร่างข้อความตอบกลับล่าสุด"
            >
              <span className={`material-symbols-outlined text-[14px] ${suggestLoading ? 'animate-spin' : ''}`}>
                {suggestLoading ? 'sync' : 'auto_awesome'}
              </span>
              <span>{suggestLoading ? 'กำลังร่าง...' : '✨ AI ร่างคำตอบ'}</span>
            </button>
            <button
              type="button"
              onClick={() => setInputText('ขออนุญาตส่งเลขที่บัญชีสำหรับชำระเงินนะครับ/ค่ะ')}
              className="px-2 py-1 text-[11px] font-medium rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-all cursor-pointer shrink-0 border border-outline-variant/30"
            >
              💳 ขอเลขที่บัญชี
            </button>
            <button
              type="button"
              onClick={() => setInputText('รบกวนส่งสลิปหลักฐานการโอนเงินเพื่อยืนยันออเดอร์ได้เลยครับ/ค่ะ')}
              className="px-2 py-1 text-[11px] font-medium rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-all cursor-pointer shrink-0 border border-outline-variant/30"
            >
              🧾 ขอสลิปโอนเงิน
            </button>
            <button
              type="button"
              onClick={() => setInputText('สินค้าพร้อมส่งครับ สามารถกดสั่งซื้อหรือแจ้งยอดได้เลยครับ')}
              className="px-2 py-1 text-[11px] font-medium rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-all cursor-pointer shrink-0 border border-outline-variant/30"
            >
              📦 สินค้าพร้อมส่ง
            </button>
            <button
              type="button"
              onClick={() => setInputText('ร้านค้าเปิดให้บริการทุกวัน 09:00 - 18:00 น. ครับ')}
              className="px-2 py-1 text-[11px] font-medium rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-all cursor-pointer shrink-0 border border-outline-variant/30"
            >
              ⏰ เวลาทำการ
            </button>
          </div>

          {/* Message Input Bar */}
          <form onSubmit={(e) => handleSend(e)} className="p-2.5 sm:p-4 bg-surface border-t border-outline-variant/30 flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={activeConv.ai_mode === 'auto' ? "พิมพ์ตอบกลับ (สลับเป็นแอดมินให้อัตโนมัติ)..." : "พิมพ์ข้อความตอบกลับ..."}
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
            onClick={() => handleCreateMock('line')}
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
          {(() => {
            const sidePlatKey = normalizePlatform(activeConv.platform)
            const sidePlatConfig = PLATFORM_CONFIG[sidePlatKey] || PLATFORM_CONFIG.line
            const sideAiMode = activeConv.ai_mode || (activeConv.status === 'human' ? 'manual' : 'auto')
            const sideAiConfig = AI_MODE_CONFIG[sideAiMode]

            return (
              <>
                <div className="text-center space-y-2 pb-4 border-b border-outline-variant/30">
                  <div className="w-14 h-14 rounded-full bg-electric-blue/10 text-electric-blue flex items-center justify-center font-bold text-xl mx-auto relative">
                    {activeConv.customer_name.charAt(0)}
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-surface flex items-center justify-center text-[9px] font-bold text-white shadow-xs"
                      style={{ backgroundColor: sidePlatConfig.color }}
                    >
                      {sidePlatConfig.shortLabel.charAt(0)}
                    </span>
                  </div>
                  <h3 className="font-bold text-on-surface text-sm truncate">{activeConv.customer_name}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border inline-block ${sidePlatConfig.badgeClass}`}>
                    {sidePlatConfig.name}
                  </span>
                </div>

                <div className="space-y-3.5 text-xs">
                  <h4 className="font-bold text-outline uppercase tracking-wider text-[10px]">รายละเอียดลูกค้า</h4>
                  
                  <div className="space-y-1">
                    <p className="text-outline">Platform ID:</p>
                    <p className="font-mono text-on-surface font-semibold text-[11px] truncate">{activeConv.user_id}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-outline">โหมด AI ปัจจุบัน:</p>
                    <p className="font-semibold text-on-surface flex items-center gap-1.5 text-xs">
                      <span className={`w-2 h-2 rounded-full ${sideAiMode === 'auto' ? 'bg-blue-500' : sideAiMode === 'copilot' ? 'bg-amber-500' : 'bg-slate-500'}`}></span>
                      {sideAiConfig.label}
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
                    className="w-full py-2 px-3 bg-electric-blue/10 text-electric-blue hover:bg-electric-blue/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 mt-4 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">person_search</span>
                    <span>ดูข้อมูล AI Memory</span>
                  </button>
                </div>
              </>
            )
          })()}
        </div>
      )}
    </div>
    </div>
  )
}
