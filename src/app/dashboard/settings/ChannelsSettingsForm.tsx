'use client'

import { useState } from 'react'
import { updateChannelSettings } from './actions'
import {
  Save,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  MessageCircle,
  Eye,
  EyeOff,
  Sparkles,
  Send,
  HelpCircle,
  ShieldCheck,
  Zap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface ShopChannelData {
  id: string
  line_token?: string | null
  line_secret?: string | null
  facebook_page_id?: string | null
  facebook_page_token?: string | null
  facebook_verify_token?: string | null
  facebook_app_secret?: string | null
}

export default function ChannelsSettingsForm({ shop }: { shop: ShopChannelData }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  
  // Collapsible Guide States (Mobile-friendly accordions)
  const [showLineGuide, setShowLineGuide] = useState(false)
  const [showFbGuide, setShowFbGuide] = useState(false)
  const [showSimulator, setShowSimulator] = useState(false)

  // Copy state
  const [copiedLine, setCopiedLine] = useState(false)
  const [copiedFb, setCopiedFb] = useState(false)

  // Password visibility state
  const [showLineSecret, setShowLineSecret] = useState(false)
  const [showLineToken, setShowLineToken] = useState(false)
  const [showFbToken, setShowFbToken] = useState(false)
  const [showFbSecret, setShowFbSecret] = useState(false)

  // Simulation state
  const [simText, setSimText] = useState('')
  const [simMode, setSimMode] = useState<'auto' | 'copilot'>('auto')
  const [simLoading, setSimLoading] = useState(false)
  const [simResult, setSimResult] = useState<any>(null)

  const lineWebhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhook/${shop.id}`
    : `https://app.dealmee.app/api/webhook/${shop.id}`

  const fbWebhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhook/facebook/${shop.id}`
    : `https://app.dealmee.app/api/webhook/facebook/${shop.id}`

  const handleCopyLine = () => {
    navigator.clipboard.writeText(lineWebhookUrl)
    setCopiedLine(true)
    setTimeout(() => setCopiedLine(false), 2000)
  }

  const handleCopyFb = () => {
    navigator.clipboard.writeText(fbWebhookUrl)
    setCopiedFb(true)
    setTimeout(() => setCopiedFb(false), 2000)
  }

  async function handleTestFbSimulation() {
    if (!simText.trim()) return
    setSimLoading(true)
    setSimResult(null)
    try {
      const res = await fetch('/api/test/facebook-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: shop.id,
          message: simText.trim(),
          ai_mode: simMode,
        }),
      })
      const data = await res.json()
      setSimResult(data)
    } catch (err: any) {
      setSimResult({ error: err?.message || 'Failed to simulate Facebook message' })
    } finally {
      setSimLoading(false)
    }
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setMessage(null)

    const res = await updateChannelSettings(formData)
    setLoading(false)

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    if (res?.error) {
      setMessage({ type: 'error', text: res.error })
    } else if (res?.success) {
      setMessage({ type: 'success', text: res.success })
    }
  }

  const isLineConnected = Boolean(shop.line_token && shop.line_token.trim())
  const isFbConnected = Boolean(shop.facebook_page_token && shop.facebook_page_token.trim())

  return (
    <form action={handleSubmit} className="space-y-4 sm:space-y-6">
      {/* Top Header & Save Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <h1 className="text-lg sm:text-2xl font-bold text-on-surface font-headline-md leading-tight">
              เชื่อมต่อช่องทางแชท
            </h1>
            <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-electric-blue/10 text-electric-blue border border-electric-blue/20 shrink-0">
              Omnichannel
            </span>
            <span className="hidden sm:inline-block text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
              Live Integration
            </span>
          </div>
          <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
            <span className="sm:hidden">เชื่อมต่อ LINE OA และ Facebook ให้บอท AI ตอบลูกค้าอัตโนมัติ 24 ชม.</span>
            <span className="hidden sm:inline">เชื่อมต่อ LINE Official Account และ Facebook Messenger เพื่อให้บอท AI ช่วยตอบแชทและปิดการขาย 24 ชม.</span>
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="self-end sm:self-auto flex items-center justify-center gap-1.5 sm:gap-2 bg-electric-blue hover:bg-primary text-white font-label-md font-semibold px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl transition-all shadow-md shadow-electric-blue/20 hover:-translate-y-0.5 cursor-pointer disabled:opacity-50 shrink-0 text-xs sm:text-sm active:scale-95"
        >
          {loading ? <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 animate-spin" /> : <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />}
          <span className="sm:hidden">{loading ? 'กำลังบันทึก...' : 'บันทึก'}</span>
          <span className="hidden sm:inline">{loading ? 'กำลังบันทึก...' : 'บันทึกการเชื่อมต่อ'}</span>
        </button>
      </div>

      {/* Alert Notification */}
      {message && (
        <div
          className={`p-3.5 sm:p-4 rounded-xl text-xs sm:text-sm font-label-md flex items-center justify-between transition-all ${
            message.type === 'success'
              ? 'bg-success-green/10 text-success-green border border-success-green/20'
              : 'bg-error-red/10 text-error-red border border-error-red/20'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-success-green shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-error-red shrink-0" />
            )}
            <p>{message.text}</p>
          </div>
          <button type="button" onClick={() => setMessage(null)} className="text-xs opacity-70 hover:opacity-100 p-1">✕</button>
        </div>
      )}

      {/* Omnichannel Overview Banner */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-purple-500/10 border border-outline-variant/40 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Zap className="w-4 h-4 text-amber-500 shrink-0" />
            <h3 className="text-xs sm:text-base font-bold text-on-surface">
              ศูนย์รวมแชทแห่งเดียว (Unified Inbox)
            </h3>
          </div>
          <p className="text-[11px] sm:text-xs text-on-surface-variant leading-relaxed">
            <span className="sm:hidden">รวมแชทจาก LINE และ Facebook ในที่เดียว บอท AI ตอบอัตโนมัติหรือร่างคำตอบทันที</span>
            <span className="hidden sm:inline">ข้อความจาก LINE OA และ Facebook จะรวมอยู่ในหน้ารวมแชทเดียวกัน บอท AI จะช่วยตอบอัตโนมัติหรือร่างคำตอบแบบ Copilot ให้ทันที</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0 pt-0.5 sm:pt-0">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold ${
            isLineConnected ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30' : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
          }`}>
            <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isLineConnected ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
            <span className="sm:hidden">LINE {isLineConnected ? 'ต่อแล้ว' : 'ยังไม่ต่อ'}</span>
            <span className="hidden sm:inline">LINE {isLineConnected ? 'พร้อมใช้งาน' : 'ยังไม่ต่อ'}</span>
          </span>

          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold ${
            isFbConnected ? 'bg-blue-500/15 text-blue-600 border border-blue-500/30' : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
          }`}>
            <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isFbConnected ? 'bg-blue-500' : 'bg-slate-400'}`}></span>
            <span className="sm:hidden">FB {isFbConnected ? 'ต่อแล้ว' : 'ยังไม่ต่อ'}</span>
            <span className="hidden sm:inline">Facebook {isFbConnected ? 'พร้อมใช้งาน' : 'ยังไม่ต่อ'}</span>
          </span>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* CARD 1: LINE Official Account (LINE OA) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section className="bg-surface border border-outline-variant/40 rounded-xl sm:rounded-2xl p-3.5 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant/30 pb-3 sm:pb-4">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
              <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h2 className="text-sm sm:text-lg font-bold text-on-surface font-headline-sm">
                  <span className="sm:hidden">LINE Official Account</span>
                  <span className="hidden sm:inline">เชื่อมต่อ LINE Official Account</span>
                </h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  isLineConnected
                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                    : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                }`}>
                  {isLineConnected ? 'เชื่อมต่อแล้ว' : 'ยังไม่ได้เชื่อมต่อ'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-on-surface-variant">
                <span className="sm:hidden">รับและตอบแชทลูกค้า LINE OA อัตโนมัติ</span>
                <span className="hidden sm:inline">รับและตอบแชทลูกค้า LINE OA อัตโนมัติผ่าน Messaging API</span>
              </p>
            </div>
          </div>

          {/* Direct Link Button to LINE Developers */}
          <a
            href="https://developers.line.biz/console/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 active:bg-emerald-500/25 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 rounded-xl font-bold text-xs transition-all shrink-0 active:scale-[0.98]"
          >
            <span className="sm:hidden">ไปหา Key ที่ LINE Developers ↗</span>
            <span className="hidden sm:inline">ไปหา Key ที่ LINE Developers Console</span>
            <ExternalLink className="hidden sm:inline w-3.5 h-3.5 shrink-0" />
          </a>
        </div>

        {/* Step-by-Step Instructions Accordion for LINE */}
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => setShowLineGuide(!showLineGuide)}
            className="w-full flex items-center justify-between p-3 sm:p-3.5 text-xs font-bold text-emerald-800 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>วิธีขอ Key & ติดตั้ง LINE Messaging API (5 ขั้นตอน)</span>
            </div>
            <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1 shrink-0">
              {showLineGuide ? (
                <>
                  <span>ย่อคำแนะนำ</span>
                  <ChevronUp className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <span>ดูวิธีตั้งค่า</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </>
              )}
            </span>
          </button>

          {showLineGuide && (
            <div className="px-3.5 pb-3.5 pt-1 text-xs border-t border-emerald-500/15 space-y-2">
              <ol className="list-decimal list-inside space-y-1.5 text-on-surface-variant pl-1 leading-relaxed">
                <li>
                  เข้าสู่ระบบที่ <a href="https://developers.line.biz/console/" target="_blank" rel="noopener noreferrer" className="text-emerald-700 dark:text-emerald-400 underline font-semibold">developers.line.biz/console</a> ด้วยบัญชี LINE Business แล้วคลิกเข้า Channel ประเภท <strong>Messaging API</strong> ของคุณ
                </li>
                <li>
                  ไปที่แท็บ <strong>Basic settings</strong> เลื่อนลงมาล่างสุด ก๊อปปี้ <strong>Channel Secret</strong> มาวางในช่องด้านล่าง
                </li>
                <li>
                  ไปที่แท็บ <strong>Messaging API</strong> เลื่อนลงมาที่หัวข้อ <strong>Channel access token</strong> กดปุ่ม <strong>Issue</strong> แล้วก๊อปปี้รหัส Token ทั้งหมดมาวางในช่อง <strong>Channel Access Token</strong>
                </li>
                <li>
                  นำ <strong>LINE Webhook URL</strong> ด้านล่างนี้ ไปวางในช่อง <em>Webhook URL</em> ในหน้า LINE Developers แล้วกด <strong>Verify</strong> จากนั้นเปิดสวิตช์ <strong>Use webhook</strong> ให้เป็นสีเขียว
                </li>
                <li>
                  ในแท็บ Messaging API เลื่อนลงมาที่ <strong>Auto-reply messages</strong> กด Edit แล้วตั้งค่าปิด <em>Auto-response</em> ของ LINE เพื่อป้องกันบอทตอบซ้ำซ้อนกับ DealMee
                </li>
              </ol>
            </div>
          )}
        </div>

        {/* Input Fields for LINE */}
        <div className="space-y-3.5 sm:space-y-4 pt-1">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-bold text-on-surface font-label-md">
                Channel Access Token (Long-lived)
              </label>
              <button
                type="button"
                onClick={() => setShowLineToken(!showLineToken)}
                className="text-xs text-on-surface-variant hover:text-on-surface flex items-center gap-1 cursor-pointer"
              >
                {showLineToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showLineToken ? 'ซ่อน' : 'แสดง'}</span>
              </button>
            </div>
            <input
              name="line_token"
              type={showLineToken ? 'text' : 'password'}
              defaultValue={shop.line_token || ''}
              placeholder="eyJhbGciOiJIUzI1NiJ9..."
              className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-mono"
            />
            <p className="text-[11px] text-outline">นำมาจากแท็บ Messaging API → Channel access token (กดปุ่ม Issue)</p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-bold text-on-surface font-label-md">
                Channel Secret
              </label>
              <button
                type="button"
                onClick={() => setShowLineSecret(!showLineSecret)}
                className="text-xs text-on-surface-variant hover:text-on-surface flex items-center gap-1 cursor-pointer"
              >
                {showLineSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showLineSecret ? 'ซ่อน' : 'แสดง'}</span>
              </button>
            </div>
            <input
              name="line_secret"
              type={showLineSecret ? 'text' : 'password'}
              defaultValue={shop.line_secret || ''}
              placeholder="••••••••••••••••••••••••"
              className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-mono"
            />
            <p className="text-[11px] text-outline">นำมาจากแท็บ Basic settings → Channel secret (32 ตัวอักษร)</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
              LINE Webhook URL ประจำร้านค้าของคุณ
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                readOnly
                value={lineWebhookUrl}
                className="w-full pl-3.5 pr-24 py-2.5 rounded-xl border border-outline-variant bg-surface-container-high text-on-surface-variant text-xs font-mono outline-none truncate"
              />
              <button
                type="button"
                onClick={handleCopyLine}
                className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-surface hover:bg-surface-container-highest active:bg-surface-container text-on-surface font-semibold text-xs rounded-lg transition-all flex items-center justify-center gap-1 border border-outline-variant/60 shadow-xs cursor-pointer active:scale-95"
              >
                {copiedLine ? <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
                <span>{copiedLine ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
              </button>
            </div>
            <p className="text-[11px] text-outline leading-relaxed">
              นำ URL นี้ไปใส่ใน LINE Developers Console → Messaging API → Webhook URL แล้วเปิด Verify
            </p>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* CARD 2: Facebook Page (Messenger) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section className="bg-surface border border-outline-variant/40 rounded-xl sm:rounded-2xl p-3.5 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant/30 pb-3 sm:pb-4">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600 shrink-0">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h2 className="text-sm sm:text-lg font-bold text-on-surface font-headline-sm">
                  <span className="sm:hidden">Facebook (Messenger)</span>
                  <span className="hidden sm:inline">เชื่อมต่อ Facebook Page (Messenger)</span>
                </h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  isFbConnected
                    ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                    : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                }`}>
                  {isFbConnected ? 'เชื่อมต่อแล้ว' : 'ยังไม่ได้เชื่อมต่อ'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-on-surface-variant">
                <span className="sm:hidden">รับและตอบแชทลูกค้า Messenger อัตโนมัติ</span>
                <span className="hidden sm:inline">รับข้อความจาก Facebook Messenger และให้ AI ช่วยตอบหรือร่างคำแนะนำทันที</span>
              </p>
            </div>
          </div>

          {/* Direct Link Button to Meta for Developers */}
          <a
            href="https://developers.facebook.com/apps/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 active:bg-blue-500/25 text-blue-700 dark:text-blue-400 border border-blue-500/30 rounded-xl font-bold text-xs transition-all shrink-0 active:scale-[0.98]"
          >
            <span className="sm:hidden">ไปหา Key ที่ Meta Developers ↗</span>
            <span className="hidden sm:inline">ไปหา Key ที่ Meta for Developers</span>
            <ExternalLink className="hidden sm:inline w-3.5 h-3.5 shrink-0" />
          </a>
        </div>

        {/* Step-by-Step Instructions Accordion for Facebook */}
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => setShowFbGuide(!showFbGuide)}
            className="w-full flex items-center justify-between p-3 sm:p-3.5 text-xs font-bold text-blue-800 dark:text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 shrink-0 text-blue-600" />
              <span>วิธีขอ Key & ติดตั้ง Facebook Messenger Webhook (6 ขั้นตอน)</span>
            </div>
            <span className="text-[11px] font-semibold text-blue-600 flex items-center gap-1 shrink-0">
              {showFbGuide ? (
                <>
                  <span>ย่อคำแนะนำ</span>
                  <ChevronUp className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <span>ดูวิธีตั้งค่า</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </>
              )}
            </span>
          </button>

          {showFbGuide && (
            <div className="px-3.5 pb-3.5 pt-1 text-xs border-t border-blue-500/15 space-y-2">
              <ol className="list-decimal list-inside space-y-1.5 text-on-surface-variant pl-1 leading-relaxed">
                <li>
                  เข้าสู่ระบบที่ <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" className="text-blue-700 dark:text-blue-400 underline font-semibold">developers.facebook.com/apps</a> กด <strong>Create App</strong> (เลือกประเภท Use cases: <em>Other</em> → <em>Business</em>)
                </li>
                <li>
                  ในหน้า Dashboard ของแอพ เลื่อนหาผลิตภัณฑ์ <strong>Messenger</strong> แล้วกด <strong>Set Up</strong>
                </li>
                <li>
                  ไปที่เมนู <strong>Messenger → Settings</strong>:
                  <ul className="list-disc list-inside pl-4 pt-1 space-y-0.5 text-slate-600 dark:text-slate-300">
                    <li>เลื่อนลงไปที่ <strong>Webhooks</strong> กดปุ่ม <em>Add Callback URL</em> นำ <strong>Facebook Webhook Callback URL</strong> และ <strong>Verify Token</strong> ด้านล่างนี้ไปวาง แล้วกดยืนยัน (Verify and Save)</li>
                    <li>ในตาราง Webhook Fields ให้กด <strong>Subscribe</strong> 2 ช่อง: <code>messages</code> และ <code>messaging_postbacks</code></li>
                  </ul>
                </li>
                <li>
                  เลื่อนไปที่หัวข้อ <strong>Generate Access Tokens</strong> เลือก Facebook Page ที่ต้องการ แล้วกดสร้าง Token จากนั้นก๊อปปี้มาใส่ในช่อง <strong>Page Access Token</strong>
                </li>
                <li>
                  ก๊อปปี้ <strong>Page ID</strong> ของเพจคุณมาใส่ในช่อง <strong>Facebook Page ID</strong>
                </li>
                <li className="text-blue-700 dark:text-blue-300 font-semibold pt-0.5">
                  💡 <em>ข้อควรรู้:</em> ในโหมด <strong>Development Mode</strong> แอดมินและผู้มีสิทธิ์ใน Meta App สามารถทักเพจเพื่อทดสอบให้บอท AI ตอบได้ทันทีโดยไม่ต้องรอ Meta App Review!
                </li>
              </ol>
            </div>
          )}
        </div>

        {/* Input Fields for Facebook */}
        <div className="space-y-3.5 sm:space-y-4 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
                Facebook Page ID
              </label>
              <input
                name="facebook_page_id"
                type="text"
                defaultValue={shop.facebook_page_id || ''}
                placeholder="เช่น 109823476123456"
                className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-mono"
              />
              <p className="text-[11px] text-outline">รหัสประจำ Facebook Page ที่ต้องการเปิดใช้งาน</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
                Verify Token (กำหนดเองได้)
              </label>
              <input
                name="facebook_verify_token"
                type="text"
                defaultValue={shop.facebook_verify_token || `dealmee_verify_${shop.id.slice(0, 8)}`}
                placeholder="dealmee_verify_token_123"
                className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-mono"
              />
              <p className="text-[11px] text-outline">รหัส Verify Token สำหรับยืนยัน Webhook ใน Meta Developers</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-bold text-on-surface font-label-md">
                Page Access Token (Long-Lived Token)
              </label>
              <button
                type="button"
                onClick={() => setShowFbToken(!showFbToken)}
                className="text-xs text-on-surface-variant hover:text-on-surface flex items-center gap-1 cursor-pointer"
              >
                {showFbToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showFbToken ? 'ซ่อน' : 'แสดง'}</span>
              </button>
            </div>
            <input
              name="facebook_page_token"
              type={showFbToken ? 'text' : 'password'}
              defaultValue={shop.facebook_page_token || ''}
              placeholder="EAABw..."
              className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-mono"
            />
            <p className="text-[11px] text-outline">Token จาก Meta for Developers → Messenger → Generate Access Tokens</p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-bold text-on-surface font-label-md">
                App Secret (ไม่บังคับ - ตรวจสอบความปลอดภัย)
              </label>
              <button
                type="button"
                onClick={() => setShowFbSecret(!showFbSecret)}
                className="text-xs text-on-surface-variant hover:text-on-surface flex items-center gap-1 cursor-pointer"
              >
                {showFbSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showFbSecret ? 'ซ่อน' : 'แสดง'}</span>
              </button>
            </div>
            <input
              name="facebook_app_secret"
              type={showFbSecret ? 'text' : 'password'}
              defaultValue={shop.facebook_app_secret || ''}
              placeholder="••••••••••••••••••••••••"
              className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-mono"
            />
            <p className="text-[11px] text-outline">App Secret จาก App Settings → Basic ใน Meta Developers</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
              Facebook Webhook Callback URL
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                readOnly
                value={fbWebhookUrl}
                className="w-full pl-3.5 pr-24 py-2.5 rounded-xl border border-outline-variant bg-surface-container-high text-on-surface-variant text-xs font-mono outline-none truncate"
              />
              <button
                type="button"
                onClick={handleCopyFb}
                className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-surface hover:bg-surface-container-highest active:bg-surface-container text-on-surface font-semibold text-xs rounded-lg transition-all flex items-center justify-center gap-1 border border-outline-variant/60 shadow-xs cursor-pointer active:scale-95"
              >
                {copiedFb ? <Check className="w-3.5 h-3.5 text-success-green shrink-0" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
                <span>{copiedFb ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
              </button>
            </div>
            <p className="text-[11px] text-outline leading-relaxed">
              นำ URL นี้และ Verify Token ไปใส่ใน Meta for Developers → Webhooks → Messenger
            </p>
          </div>

          {/* Interactive Facebook Simulator Tester (Collapsible on Mobile) */}
          <div className="mt-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5 overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setShowSimulator(!showSimulator)}
              className="w-full flex items-center justify-between p-3 sm:p-3.5 text-xs font-bold text-blue-800 dark:text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                <span>จำลองแชททดสอบระบบ Facebook (Real-time Test)</span>
              </div>
              <span className="text-[11px] font-semibold text-blue-600 flex items-center gap-1 shrink-0">
                {showSimulator ? (
                  <>
                    <span>ปิดตัวทดสอบ</span>
                    <ChevronUp className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    <span>เปิดตัวทดสอบ</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </>
                )}
              </span>
            </button>

            {showSimulator && (
              <div className="p-3.5 sm:p-4 border-t border-blue-500/15 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-on-surface-variant">
                    จำลองเป็นลูกค้าทัก Facebook Messenger เข้ามาเพื่อดูการตอบของ AI
                  </span>
                  <div className="flex items-center gap-1 bg-surface rounded-lg p-0.5 border border-outline-variant/40 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSimMode('auto')}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                        simMode === 'auto'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      ตอบอัตโนมัติ
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimMode('copilot')}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                        simMode === 'copilot'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      Copilot แนะนำ
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={simText}
                    onChange={(e) => setSimText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleTestFbSimulation()
                      }
                    }}
                    placeholder="พิมพ์ข้อความทดสอบ เช่น สินค้าราคาเท่าไหร่..."
                    className="flex-1 px-3 py-2 rounded-xl border border-outline-variant bg-surface text-on-surface text-xs focus:border-blue-500 outline-none"
                  />
                  <button
                    type="button"
                    disabled={simLoading || !simText.trim()}
                    onClick={handleTestFbSimulation}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shrink-0 active:scale-95"
                  >
                    {simLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>ส่งทดสอบ</span>
                  </button>
                </div>

                {simResult && (
                  <div className="p-3 rounded-xl bg-surface border border-outline-variant/40 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
                      <span className="font-bold text-on-surface">ผลการประมวลผล:</span>
                      <span className="text-blue-600 font-semibold">{simResult.mode}</span>
                    </div>
                    {simResult.reply_text && (
                      <div className="p-2.5 rounded-lg bg-blue-500/10 text-on-surface border border-blue-500/20 whitespace-pre-wrap leading-relaxed text-xs">
                        {simResult.reply_text}
                      </div>
                    )}
                    {simResult.suggested_reply && (
                      <div className="p-2.5 rounded-lg bg-purple-500/10 text-on-surface border border-purple-500/20 whitespace-pre-wrap leading-relaxed text-xs">
                        <span className="font-bold text-purple-600 block mb-0.5">คำตอบแนะนำ (Copilot):</span>
                        {simResult.suggested_reply}
                      </div>
                    )}
                    {simResult.error && (
                      <div className="text-error-red text-[11px]">{simResult.error}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Bottom Save Bar (with clearance for floating Copilot widget) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 pb-20 sm:pb-6 border-t border-outline-variant/30">
        <div className="text-xs text-on-surface-variant flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>ข้อมูล Access Token และ Secrets ทั้งหมดจะถูกเข้ารหัสและเก็บรักษาอย่างปลอดภัย</span>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-electric-blue hover:bg-primary text-white font-label-md font-semibold px-6 sm:px-8 py-3 rounded-xl transition-all shadow-md shadow-electric-blue/20 hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer text-xs sm:text-sm shrink-0 active:scale-[0.99]"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
          ) : (
            <Save className="w-4 h-4 shrink-0" />
          )}
          <span>{loading ? 'กำลังบันทึก...' : 'บันทึกการเชื่อมต่อช่องทางแชท'}</span>
        </button>
      </div>
    </form>
  )
}
