'use client'

import React, { useState, useEffect } from 'react'
import {
  Radio,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  ShoppingBag,
  Send,
  MessageSquare,
  Flame,
  CheckCircle2,
  Tv,
  Layers,
  Database,
  QrCode,
  DollarSign,
  Zap,
  Volume2,
  VolumeX,
  Play,
  Square,
  Sliders,
  Gauge,
} from 'lucide-react'
import { LiveSessionState, LiveHostPitch } from '@/lib/live/liveStudioEngine'

interface LiveStudioClientProps {
  shop: any
  initialLiveState: LiveSessionState
}

export default function LiveStudioClient({ shop, initialLiveState }: LiveStudioClientProps) {
  const [liveState, setLiveState] = useState<LiveSessionState>(initialLiveState)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [simUsername, setSimUsername] = useState('คุณส้มโอ (TikTok Live)')
  const [simComment, setSimComment] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [lastBotReply, setLastBotReply] = useState<string | null>(null)
  const [showSqlModal, setShowSqlModal] = useState(false)
  const [showDmModal, setShowDmModal] = useState(false)

  // AI Teleprompter states
  const [pitchLoading, setPitchLoading] = useState(false)
  const [currentPitch, setCurrentPitch] = useState<LiveHostPitch | null>(null)
  const [copiedPitch, setCopiedPitch] = useState(false)

  // Voice playback & tuning states
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [playingSection, setPlayingSection] = useState<'hook' | 'full' | 'reply' | 'urgency' | 'test' | null>(null)
  const [activeAudio, setActiveAudio] = useState<HTMLAudioElement | null>(null)
  const [voiceMode, setVoiceMode] = useState<'browser' | 'cloud'>('browser')
  const [voiceStyle, setVoiceStyle] = useState<'sweet_female' | 'energetic_female' | 'confident_male'>('sweet_female')
  const [voiceSpeed, setVoiceSpeed] = useState<number>(1.15)

  const handleStopAudio = () => {
    if (activeAudio) {
      activeAudio.pause()
      activeAudio.currentTime = 0
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setIsPlayingAudio(false)
    setPlayingSection(null)
    setActiveAudio(null)
  }

  const getBestThaiVoice = (style: string): SpeechSynthesisVoice | null => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
    const voices = window.speechSynthesis.getVoices()
    const thaiVoices = voices.filter(
      (v) => v.lang.startsWith('th') || v.lang.toLowerCase().includes('th-th') || v.lang.toLowerCase().includes('th_th')
    )
    if (thaiVoices.length === 0) return null

    if (style === 'confident_male') {
      return (
        thaiVoices.find((v) => v.name.includes('Niwat') || v.name.includes('Male')) ||
        thaiVoices[0]
      )
    }

    // Female / Natural
    return (
      thaiVoices.find((v) => v.name.includes('Premwadee') || v.name.includes('Natural') || v.name.includes('Online')) ||
      thaiVoices.find((v) => v.name.includes('Google') || v.name.includes('Enhanced')) ||
      thaiVoices[0]
    )
  }

  const handlePlayVoice = (
    textToSpeak: string,
    section: 'hook' | 'full' | 'reply' | 'urgency' | 'test'
  ) => {
    if (isPlayingAudio && playingSection === section) {
      handleStopAudio()
      return
    }

    handleStopAudio()
    if (!textToSpeak.trim()) return

    setIsPlayingAudio(true)
    setPlayingSection(section)

    if (voiceMode === 'browser' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(textToSpeak)
      utterance.lang = 'th-TH'

      const bestVoice = getBestThaiVoice(voiceStyle)
      if (bestVoice) {
        utterance.voice = bestVoice
      }

      if (voiceStyle === 'energetic_female') {
        utterance.rate = voiceSpeed * 1.06
        utterance.pitch = 1.1
      } else if (voiceStyle === 'confident_male') {
        utterance.rate = voiceSpeed * 0.98
        utterance.pitch = 0.95
      } else {
        utterance.rate = voiceSpeed
        utterance.pitch = 1.05
      }

      utterance.onend = () => {
        setIsPlayingAudio(false)
        setPlayingSection(null)
      }
      utterance.onerror = () => {
        setIsPlayingAudio(false)
        setPlayingSection(null)
      }

      window.speechSynthesis.speak(utterance)
    } else {
      // Cloud audio stream MP3
      const gender = voiceStyle === 'confident_male' ? 'male' : 'female'
      const audioUrl = `/api/live/tts?text=${encodeURIComponent(textToSpeak)}&shop_id=${shop.id}&speed=${voiceSpeed}&voice=${gender}`
      const audio = new Audio(audioUrl)
      audio.onplay = () => {
        setIsPlayingAudio(true)
      }
      audio.onended = () => {
        setIsPlayingAudio(false)
        setPlayingSection(null)
        setActiveAudio(null)
      }
      audio.onerror = () => {
        // Fallback to browser
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel()
          const utterance = new SpeechSynthesisUtterance(textToSpeak)
          utterance.lang = 'th-TH'
          utterance.rate = voiceSpeed
          utterance.onend = () => {
            setIsPlayingAudio(false)
            setPlayingSection(null)
          }
          utterance.onerror = () => {
            setIsPlayingAudio(false)
            setPlayingSection(null)
          }
          window.speechSynthesis.speak(utterance)
        } else {
          setIsPlayingAudio(false)
          setPlayingSection(null)
        }
      }

      audio.play().catch(() => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel()
          const utterance = new SpeechSynthesisUtterance(textToSpeak)
          utterance.lang = 'th-TH'
          utterance.rate = voiceSpeed
          utterance.onend = () => {
            setIsPlayingAudio(false)
            setPlayingSection(null)
          }
          utterance.onerror = () => {
            setIsPlayingAudio(false)
            setPlayingSection(null)
          }
          window.speechSynthesis.speak(utterance)
        } else {
          setIsPlayingAudio(false)
          setPlayingSection(null)
        }
      })
      setActiveAudio(audio)
    }
  }

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Construct absolute OBS overlay URL
  const obsOverlayUrl = mounted && typeof window !== 'undefined'
    ? `${window.location.origin}/live/overlay/${shop.id}`
    : `https://dealmee.app/live/overlay/${shop.id}`

  const handleCopyObsUrl = () => {
    navigator.clipboard.writeText(obsOverlayUrl)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 2500)
  }

  // Quick test comment buttons
  const quickTestComments = [
    { label: '🛒 ขอดูตะกร้า 1', text: 'ขอดูตะกร้า 1 หน่อยค่ะ' },
    { label: '👖 ขอดูตะกร้า 2', text: 'ขอดูตะกร้า 2 หน่อยค่ะ' },
    { label: '🎉 CF ตะกร้า 1 (2 ชิ้น)', text: 'CF 1 2 ชิ้นค่ะ พร้อมโอน' },
    { label: '⚡ CF ตะกร้า 2 (1 ตัว)', text: 'CF 2 1 ตัวค่ะ รับโปรนี้' },
    { label: '🚚 ถามเรื่องค่าส่ง', text: 'ส่งฟรีกี่บาทคะ' },
    { label: '📦 เก็บปลายทางไหม', text: 'มีเก็บเงินปลายทางไหมคะ' },
  ]

  const handleSendComment = async (customText?: string) => {
    const textToSend = customText || simComment
    if (!textToSend.trim()) return

    setIsSending(true)
    try {
      const res = await fetch('/api/live/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: shop.id,
          username: simUsername || 'ผู้ชมไลฟ์',
          comment_text: textToSend.trim(),
          platform: 'tiktok',
        }),
      })

      const data = await res.json()
      if (data.success && data.state) {
        setLiveState(data.state)
        setLastBotReply(data.ai_reply || 'ระบบรับเรื่องเรียบร้อยแล้วค่ะ')
        setSimComment('')
        if (data.action_type === 'cf_order') {
          // Open DM notification preview automatically so merchant sees the generated QR & bill
          setShowDmModal(true)
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSending(false)
    }
  }

  // Generate AI Host Pitch for active product
  const handleGeneratePitch = async (targetBasketNo?: number) => {
    setPitchLoading(true)
    try {
      const res = await fetch('/api/live/pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: shop.id,
          basket_no: targetBasketNo || liveState.current_basket_no,
        }),
      })

      const data = await res.json()
      if (data.success && data.pitch) {
        setCurrentPitch(data.pitch)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setPitchLoading(false)
    }
  }

  const handleCopyPitch = () => {
    if (!currentPitch) return
    const text = `[สคริปต์เปิด 15 วิ]\n${currentPitch.hook15s}\n\n[จุดขาย]\n${currentPitch.sellingPoints.map(p => `• ${p}`).join('\n')}\n\n[ปิดการขาย]\n${currentPitch.urgencyClosing}`
    navigator.clipboard.writeText(text)
    setCopiedPitch(true)
    setTimeout(() => setCopiedPitch(false), 2000)
  }

  const currentProduct = liveState.current_product || liveState.baskets[0]
  const latestOrder = liveState.latest_cf_order

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Hero Streamer Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 border border-rose-500/20 p-6 sm:p-8 text-white shadow-xl shadow-rose-950/20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-semibold mb-3">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span>DealMee 24/7 AI Live Studio (Virtual Streamer & Auto-CF)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              สตูดิโอ AI ไลฟ์สดขายของ & ดูด CF อัตโนมัติ 24 ชม.
            </h1>
            <p className="mt-2 text-sm sm:text-base text-slate-300 max-w-2xl">
              เชื่อมต่อ OBS Studio หรือสตรีมตรงบน TikTok Live, Facebook Live, Shopee Live
              พร้อมระบบ AI ดูดคอมเมนต์ CF บันทึกออเดอร์ลงฐานข้อมูล และส่ง QR Code พร้อมเพย์ปิดการขายในแชททันที
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowSqlModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-medium text-slate-200 transition-all cursor-pointer"
            >
              <Database className="w-4 h-4 text-emerald-400" />
              <span>โครงสร้าง SQL Live Studio</span>
            </button>
          </div>
        </div>

        {/* OBS URL Copy Banner */}
        <div className="mt-6 p-4 rounded-2xl bg-slate-950/80 border border-white/10 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
              <Tv className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-semibold text-slate-400 block">
                OBS Browser Source Widget URL (สำหรับวางในช่อง URL ของโปรแกรม OBS):
              </span>
              <span className="text-xs sm:text-sm font-mono text-white truncate block" suppressHydrationWarning>
                {obsOverlayUrl}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyObsUrl}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-rose-600/30 cursor-pointer"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedUrl ? 'คัดลอกเรียบร้อย!' : 'คัดลอกลิงก์ OBS'}</span>
            </button>
            <a
              href={`/live/overlay/${shop.id}`}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-all"
              title="เปิดดูพรีวิวแบบเต็มจอ"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Real-time Live Revenue & Performance KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block">ยอดขายในไลฟ์สด</span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              ฿{(liveState.total_cf_revenue || 0).toLocaleString()}
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block">ออเดอร์ CF อัตโนมัติ</span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {liveState.total_cf_orders || 0} <span className="text-xs font-normal text-slate-400">รายการ</span>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block">คอมเมนต์สดประมวลผล</span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {liveState.total_comments || 0} <span className="text-xs font-normal text-slate-400">ข้อความ</span>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block">ความเร็ว AI สลับจอ</span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              &lt; 30ms <span className="text-xs font-normal text-emerald-500">Ultra-fast</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2-Column Interactive Workspace: Left = Live Screen Simulation, Right = Real-time Comment Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Streamer Screen Mockup (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-3xl p-5 text-white flex flex-col justify-between shadow-lg relative overflow-hidden min-h-[500px]">
          {/* Simulated Streamer Background video/poster */}
          <div className="absolute inset-0 z-0 opacity-40">
            <img
              src="https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&auto=format&fit=crop&q=80"
              alt="Live Backdrop"
              className="w-full h-full object-cover blur-[2px]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
          </div>

          {/* Top Live Ticker Overlay */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-600/90 text-white text-xs font-black shadow-lg">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              <span>LIVE</span>
              <span className="text-[10px] opacity-80">| 1.4k ผู้ชม</span>
            </div>

            <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-xs">
              <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
              <span>ออเดอร์ CF: {liveState.total_cf_orders}</span>
            </div>
          </div>

          {/* Bottom Overlay Area (Dynamic Product Card in action) */}
          <div className="relative z-10 space-y-3 mt-auto pt-20">
            {/* Pop-up Comment Bubble */}
            {liveState.recent_comments && liveState.recent_comments.length > 0 && (
              <div className="animate-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 backdrop-blur-md border border-blue-500/40 text-xs text-white shadow-xl max-w-xs">
                  <span className="font-bold text-blue-400">
                    {liveState.recent_comments[0].username}:
                  </span>
                  <span className="truncate">
                    &ldquo;{liveState.recent_comments[0].comment_text}&rdquo;
                  </span>
                </div>
              </div>
            )}

            {/* Active Pinned Dynamic Product Card */}
            {currentProduct && (
              <div className="rounded-2xl border border-white/20 bg-slate-950/90 backdrop-blur-xl p-3 shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="px-2 py-0.5 rounded-md bg-rose-600 font-extrabold text-[11px] text-white">
                    ตะกร้า #{currentProduct.basket_no}
                  </span>
                  <span className="text-[11px] text-amber-400 font-bold flex items-center gap-1">
                    <Flame className="w-3 h-3" /> เหลือ {currentProduct.stock} ชิ้น
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <img
                    src={currentProduct.image_url}
                    alt={currentProduct.product_name}
                    className="w-16 h-16 rounded-xl object-cover border border-white/10"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-extrabold text-white truncate">
                      {currentProduct.product_name}
                    </h4>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-xl font-black text-amber-400">
                        ฿{currentProduct.live_price.toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-400 line-through">
                        ฿{currentProduct.regular_price.toLocaleString()}
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-bold block mt-0.5">
                      ✓ พิมพ์ &ldquo;CF {currentProduct.basket_no}&rdquo; เพื่อสั่งซื้อทันที
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Real-time Comment Simulator (7 Cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-rose-500" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  ตัวทดสอบคอมเมนต์สด & ดูด CF (Live Comment & CF Simulator)
                </h3>
              </div>
              {latestOrder && (
                <button
                  onClick={() => setShowDmModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-200 transition-all cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>ดูบิล & QR Code ล่าสุด</span>
                </button>
              )}
            </div>

            {/* Quick Test Buttons */}
            <div className="mt-4">
              <span className="text-xs font-bold text-slate-500 block mb-2">
                คลิกทดสอบสถานการณ์ด่วน (จำลองผู้ชมพิมพ์ในไลฟ์จริง):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {quickTestComments.map((btn, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendComment(btn.text)}
                    disabled={isSending}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:border-rose-300 dark:hover:border-rose-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition-all text-left flex items-center justify-between cursor-pointer disabled:opacity-50"
                  >
                    <span>{btn.label}</span>
                    <Sparkles className="w-3 h-3 text-rose-500 shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            {/* Last Bot Voice / Reply Toast */}
            {lastBotReply && (
              <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-rose-500/10 to-indigo-500/10 border border-rose-500/30 text-xs sm:text-sm text-slate-800 dark:text-slate-200 animate-in fade-in duration-200 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold mb-1">
                    <Radio className="w-4 h-4 animate-pulse" />
                    <span>เสียง AI สตรีมเมอร์ตอบกลับผู้ชมในไลฟ์สด:</span>
                  </div>
                  <p className="font-medium italic">&ldquo;{lastBotReply}&rdquo;</p>
                </div>
                <button
                  onClick={() => handlePlayVoice(lastBotReply, 'reply')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-sm ${
                    isPlayingAudio && playingSection === 'reply'
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-200'
                  }`}
                >
                  {isPlayingAudio && playingSection === 'reply' ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>หยุดเสียง</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>🔊 ฟังเสียงตอบ</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Live Comment Feed List */}
            <div className="mt-4 space-y-2">
              <span className="text-xs font-bold text-slate-500 block">
                ประวัติคอมเมนต์สดในไลฟ์ ({liveState.total_comments} คอมเมนต์):
              </span>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {liveState.recent_comments?.map((c, idx) => (
                  <div
                    key={`${c.id}-${idx}`}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-start justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {c.username}
                      </span>
                      <span className="text-slate-400 ml-2">({c.platform}):</span>
                      <p className="mt-0.5 text-slate-700 dark:text-slate-300 font-medium">
                        &ldquo;{c.comment_text}&rdquo;
                      </p>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        c.action_type === 'basket_switch'
                          ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                          : c.action_type === 'cf_order'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {c.action_type === 'basket_switch'
                        ? `สลับตะกร้า #${c.basket_no_triggered}`
                        : c.action_type === 'cf_order'
                        ? 'สั่งซื้อ CF สำเร็จ'
                        : 'ตอบคำถาม'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Input Form */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="ชื่อผู้ชม (เช่น คุณแอน)"
              value={simUsername}
              onChange={(e) => setSimUsername(e.target.value)}
              className="sm:w-36 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none"
            />
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                placeholder="พิมพ์ข้อความ เช่น 'ขอดูตะกร้า 2', 'CF 1 2 ชิ้น'..."
                value={simComment}
                onChange={(e) => setSimComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none"
              />
              <button
                onClick={() => handleSendComment()}
                disabled={isSending || !simComment.trim()}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-rose-600/30 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>ส่ง</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AI Live Host Teleprompter Card (1-Click Pitch Generator) */}
      <div className="bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-slate-900 border border-indigo-500/30 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-indigo-500/20 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <span>AI Live Host Teleprompter (สคริปต์พูดสดสำหรับสตรีมเมอร์)</span>
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/30 text-indigo-300 text-[10px] font-bold">
                  Gemini 3.8 Flash
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                กำลังส่องสินค้า: <strong>{currentProduct?.product_name}</strong> (ตะกร้า #{currentProduct?.basket_no})
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleGeneratePitch()}
              disabled={pitchLoading}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
              <span>{pitchLoading ? 'กำลังแต่งสคริปต์...' : '⚡ สร้างสคริปต์พูดสด 15 วิ ด้วย AI'}</span>
            </button>
            {currentPitch && (
              <>
                <button
                  onClick={() => {
                    const fullText = `${currentPitch.hook15s} ${currentPitch.sellingPoints.join(' ')} ${currentPitch.urgencyClosing}`
                    handlePlayVoice(fullText, 'full')
                  }}
                  className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer text-white ${
                    isPlayingAudio && playingSection === 'full'
                      ? 'bg-rose-600 hover:bg-rose-500 animate-pulse'
                      : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                  title="กดฟังเสียง AI สตรีมเมอร์อ่านสคริปต์ทั้งหมดแบบสด ๆ"
                >
                  {isPlayingAudio && playingSection === 'full' ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>หยุดเสียง</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>🔊 ฟังเสียง AI อ่านสด</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleCopyPitch}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
                >
                  {copiedPitch ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedPitch ? 'คัดลอกแล้ว' : 'คัดลอกบท'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* AI Voice Persona & Rhythm Tuner Bar */}
        <div className="mt-4 p-3.5 rounded-2xl bg-indigo-950/50 border border-indigo-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-indigo-200 font-bold">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>ปรับสไตล์เสียง & จังหวะ AI:</span>
            </div>

            {/* Persona Selector */}
            <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-indigo-500/30">
              <button
                type="button"
                onClick={() => {
                  setVoiceStyle('sweet_female')
                  setVoiceSpeed(1.15)
                }}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  voiceStyle === 'sweet_female'
                    ? 'bg-rose-500/30 text-rose-200 border border-rose-500/60 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🌸 แม่ค้าเสียงหวาน (1.15x)
              </button>
              <button
                type="button"
                onClick={() => {
                  setVoiceStyle('energetic_female')
                  setVoiceSpeed(1.22)
                }}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  voiceStyle === 'energetic_female'
                    ? 'bg-amber-500/30 text-amber-200 border border-amber-500/60 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ⚡ แม่ค้าขายด่วน (พลังบวก 1.22x)
              </button>
              <button
                type="button"
                onClick={() => {
                  setVoiceStyle('confident_male')
                  setVoiceSpeed(1.12)
                }}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  voiceStyle === 'confident_male'
                    ? 'bg-blue-500/30 text-blue-200 border border-blue-500/60 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                👔 พ่อค้ามั่นใจ (1.12x)
              </button>
            </div>

            {/* Speed Selector */}
            <div className="flex items-center gap-1.5 text-slate-300">
              <Gauge className="w-3.5 h-3.5 text-indigo-400" />
              <span>สปีด:</span>
              <select
                value={voiceSpeed}
                onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
                className="px-2.5 py-1 rounded-lg bg-slate-900/90 border border-indigo-500/30 text-white font-bold text-xs focus:outline-none cursor-pointer"
              >
                <option value="1.0">1.00x (ปกติ นุ่มนวล)</option>
                <option value="1.15">1.15x (แนะนำ — ไหลลื่น จังหวะสด)</option>
                <option value="1.22">1.22x (กระฉับกระเฉง ขายดี)</option>
                <option value="1.30">1.30x (แฟลชเซลล์ เร่งปิดยอด)</option>
              </select>
            </div>

            {/* Engine Selector */}
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="text-[11px] text-slate-400 font-medium">ระบบ:</span>
              <select
                value={voiceMode}
                onChange={(e) => setVoiceMode(e.target.value as 'browser' | 'cloud')}
                className="px-2.5 py-1 rounded-lg bg-slate-900/90 border border-indigo-500/30 text-white font-medium text-xs focus:outline-none cursor-pointer"
              >
                <option value="browser">🌐 Web Neural (เสียงธรรมชาติ พูดต่อเนื่อง ไม่มีแล็ก)</option>
                <option value="cloud">☁️ Cloud AI Stream (OpenAI / ElevenLabs MP3)</option>
              </select>
            </div>
          </div>

          {/* Quick Voice Tester */}
          <button
            type="button"
            onClick={() => {
              const testPhrase =
                voiceStyle === 'confident_male'
                  ? 'สวัสดีครับทุกคน วันนี้เราจัดโปรโมชั่นพิเศษสุดคุ้มในไลฟ์สดนี้เท่านั้น รีบพิมพ์ CF เข้ามาได้เลยนะครับ ช้าหมดอดนะครับ!'
                  : 'สวัสดีค่ะทุกคน วันนี้เราจัดโปรโมชั่นพิเศษสุดคุ้มในไลฟ์สดนี้เท่านั้น รีบพิมพ์ CF เข้ามาได้เลยนะคะ ช้าหมดอดนะคะ!'
              handlePlayVoice(testPhrase, 'test')
            }}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer ${
              isPlayingAudio && playingSection === 'test'
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-indigo-600/70 hover:bg-indigo-600 text-indigo-100 hover:text-white border border-indigo-400/40'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>{isPlayingAudio && playingSection === 'test' ? 'กำลังพูด...' : '🔊 ทดลองฟังเสียงนี้'}</span>
          </button>
        </div>

        {currentPitch ? (
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-300">
            {/* Hook 15s Card */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-indigo-500/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-extrabold uppercase text-amber-400 flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5" /> ท่อนเปิดใจ 15 วินาทีแรก (Hook):
                  </span>
                  <button
                    onClick={() => handlePlayVoice(currentPitch.hook15s, 'hook')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      isPlayingAudio && playingSection === 'hook'
                        ? 'bg-rose-600 text-white animate-pulse'
                        : 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/40'
                    }`}
                    title="กดฟังเสียงเฉพาะท่อนเปิดใจ"
                  >
                    {isPlayingAudio && playingSection === 'hook' ? <Square className="w-2.5 h-2.5 fill-current" /> : <Play className="w-2.5 h-2.5 fill-current" />}
                    <span>{isPlayingAudio && playingSection === 'hook' ? 'หยุด' : 'ฟังท่อนนี้'}</span>
                  </button>
                </div>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                  &ldquo;{currentPitch.hook15s}&rdquo;
                </p>
              </div>
            </div>

            {/* Selling Points Card */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-indigo-500/20">
              <span className="text-[11px] font-extrabold uppercase text-indigo-300 block mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> 3 จุดขายกระแทกใจ (Value Props):
              </span>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                {currentPitch.sellingPoints.map((pt, idx) => (
                  <li key={idx} className="leading-snug">{pt}</li>
                ))}
              </ul>
            </div>

            {/* Urgency Closing Card */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-indigo-500/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-extrabold uppercase text-rose-400 flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" /> ท่อนปิดการขายสร้าง FOMO (Urgency):
                  </span>
                  <button
                    onClick={() => handlePlayVoice(currentPitch.urgencyClosing, 'urgency')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      isPlayingAudio && playingSection === 'urgency'
                        ? 'bg-rose-600 text-white animate-pulse'
                        : 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/40'
                    }`}
                    title="กดฟังเสียงเฉพาะท่อนปิดการขาย"
                  >
                    {isPlayingAudio && playingSection === 'urgency' ? <Square className="w-2.5 h-2.5 fill-current" /> : <Play className="w-2.5 h-2.5 fill-current" />}
                    <span>{isPlayingAudio && playingSection === 'urgency' ? 'หยุด' : 'ฟังท่อนนี้'}</span>
                  </button>
                </div>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                  &ldquo;{currentPitch.urgencyClosing}&rdquo;
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 p-4 rounded-2xl bg-slate-950/50 border border-white/5 flex items-center justify-between text-xs text-slate-300">
            <span>คลิกปุ่ม <strong>&ldquo;สร้างสคริปต์พูดสด 15 วิ ด้วย AI&rdquo;</strong> เพื่อให้ AI คิดบทพูดเปิดใจ ปิดการขาย และจุดเด่นของตะกร้า #{currentProduct?.basket_no} ให้สตรีมเมอร์พูดตามได้ทันที</span>
          </div>
        )}
      </div>

      {/* Basket Lineup Organizer Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              ผังตะกร้าสินค้าในไลฟ์ (Live Basket Lineup)
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            {liveState.baskets.length} รายการพร้อมขายบนจอไลฟ์
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500">
                <th className="py-3 px-4">เลขตะกร้า</th>
                <th className="py-3 px-4">สินค้า</th>
                <th className="py-3 px-4">ราคาปกติ</th>
                <th className="py-3 px-4">ราคาพิเศษในไลฟ์</th>
                <th className="py-3 px-4">สต็อกคงเหลือ</th>
                <th className="py-3 px-4">ป้ายไฮไลท์</th>
                <th className="py-3 px-4 text-right">การกระทำ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {liveState.baskets.map((b) => (
                <tr
                  key={b.basket_no}
                  className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all ${
                    b.basket_no === liveState.current_basket_no
                      ? 'bg-rose-50/40 dark:bg-rose-950/20'
                      : ''
                  }`}
                >
                  <td className="py-3 px-4">
                    <span className="px-2.5 py-1 rounded-xl bg-slate-900 text-white font-black text-xs">
                      #{b.basket_no}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={b.image_url}
                        alt={b.product_name}
                        className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                      />
                      <span className="font-bold text-slate-900 dark:text-white">
                        {b.product_name}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-400 line-through">
                    ฿{b.regular_price.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-black text-amber-500">
                    ฿{b.live_price.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                    {b.stock} ชิ้น
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                      {b.highlight_tag || 'สินค้าขายดี'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      onClick={() => handleSendComment(`ขอดูตะกร้า ${b.basket_no}`)}
                      className="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-100 transition-all cursor-pointer"
                    >
                      สลับขึ้นจอทันที
                    </button>
                    <button
                      onClick={() => handleGeneratePitch(b.basket_no)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-100 transition-all cursor-pointer"
                    >
                      สร้างสคริปต์
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer DM Notification & PromptPay QR Preview Modal */}
      {showDmModal && latestOrder && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl relative">
            <button
              onClick={() => setShowDmModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white text-sm"
            >
              ✕ ปิด
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">
                  ตัวอย่างข้อความดูด CF ส่งเข้ากล่องข้อความ (DM)
                </h4>
                <span className="text-[11px] text-slate-400">
                  ส่งไปยัง: {latestOrder.username}
                </span>
              </div>
            </div>

            {/* Simulated DM Bubble */}
            <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 space-y-3">
              <div className="text-xs text-slate-300 leading-relaxed">
                🎉 <strong>สวัสดีค่ะคุณ {latestOrder.username}</strong><br />
                น้องบอท DealMee ล็อกสิทธิ์สินค้าจากไลฟ์สดเรียบร้อยแล้วค่ะ!
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">เลขที่บิล:</span>
                  <span className="font-mono text-amber-400 font-bold">{latestOrder.order_no}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">สินค้า:</span>
                  <span className="text-white font-medium">{latestOrder.product_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">จำนวน:</span>
                  <span className="text-white font-medium">{latestOrder.quantity} ชิ้น</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-800">
                  <span className="text-slate-400 font-bold">ยอดที่ต้องชำระ:</span>
                  <span className="text-emerald-400 font-extrabold text-sm">
                    ฿{latestOrder.total_amount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* PromptPay QR Image */}
              {latestOrder.qr_data_url && (
                <div className="flex flex-col items-center p-3 rounded-xl bg-white text-slate-900 shadow-inner">
                  <img
                    src={latestOrder.qr_data_url}
                    alt="PromptPay QR"
                    className="w-48 h-48 object-contain"
                  />
                  <span className="text-[11px] font-bold text-slate-600 mt-1">
                    สแกนชำระผ่าน PromptPay QR
                  </span>
                </div>
              )}

              <div className="text-[11px] text-center text-slate-400">
                เมื่อโอนแล้ว แตะปุ่ม &ldquo;ส่งสลิป&rdquo; ในแชทได้ทันที ระบบจะตรวจสอบสลิปอัตโนมัติค่ะ ⚡
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowDmModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-all cursor-pointer"
              >
                เข้าใจแล้ว
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SQL Migration Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 text-white shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base">คำสั่ง SQL สำหรับ DealMee Live Studio</h3>
              </div>
              <button
                onClick={() => setShowSqlModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕ ปิด
              </button>
            </div>

            <p className="text-xs text-slate-400 my-4">
              คัดลอกคำสั่งด้านล่างไปวางใน <strong>Supabase Dashboard ➡️ SQL Editor</strong> เพื่อสร้างตารางสำหรับ Live Studio (ปัจจุบันระบบมีโหมดสำรองข้อมูลอัตโนมัติให้แล้ว จึงใช้งานได้ทันทีแม้ยังไม่รัน SQL ครับ)
            </p>

            <pre className="bg-slate-950 p-4 rounded-xl text-xs text-emerald-400 font-mono overflow-x-auto max-h-72 border border-slate-800">
{`CREATE TABLE IF NOT EXISTS public.live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'DealMee 24/7 AI Live Stream',
  platform VARCHAR(50) NOT NULL DEFAULT 'tiktok',
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  current_basket_no INT NOT NULL DEFAULT 1,
  current_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  total_comments INT NOT NULL DEFAULT 0,
  total_cf_orders INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.live_baskets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  basket_no INT NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  custom_live_price NUMERIC(12, 2),
  highlight_tag TEXT DEFAULT 'สินค้าขายดี',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, basket_no)
);`}
            </pre>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText('CREATE TABLE IF NOT EXISTS public.live_sessions...')
                  alert('คัดลอกเรียบร้อย!')
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                <span>คัดลอกคำสั่ง SQL</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
