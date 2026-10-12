'use client'

import { useState } from 'react'
import { updateBotSettings } from './actions'
import ChatPlaygroundModal from '../components/ChatPlaygroundModal'
import {
  MessageSquare,
  Save,
  CheckCircle2,
  AlertCircle,
  Bot,
  Brain,
  Bell,
  QrCode,
  Calendar,
  HeartHandshake,
  MessageCircle,
  Copy,
  Check,
  RefreshCw,
  Send,
  Sparkles,
} from 'lucide-react'

interface ShopData {
  id: string
  name: string
  bot_name: string | null
  description: string | null
  personality: string | null
  greeting_message: string | null
  system_prompt: string | null
  line_token: string | null
  line_secret: string | null
  facebook_page_id?: string | null
  facebook_page_token?: string | null
  facebook_verify_token?: string | null
  facebook_app_secret?: string | null
  business_type: string | null
  company_name?: string | null
  company_tax_id?: string | null
  company_address?: string | null
  company_phone?: string | null
  company_email?: string | null
  company_logo_url?: string | null
  vat_enabled?: boolean | null
  follow_up_config?: {
    qr_recovery_enabled?: boolean
    qr_recovery_delay_mins?: number
    booking_reminder_enabled?: boolean
    repurchase_enabled?: boolean
    repurchase_delay_days?: number
  } | null
}

export default function SettingsForm({ shop }: { shop: ShopData }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [copiedLine, setCopiedLine] = useState(false)
  const [copiedFb, setCopiedFb] = useState(false)
  const [isPlaygroundOpen, setIsPlaygroundOpen] = useState(false)

  // Facebook Simulation State
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

    const res = await updateBotSettings(formData)
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

  return (
    <>
      <form action={handleSubmit} className="space-y-5 sm:space-y-6">
        {/* Top Header & Save Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-on-surface font-headline-md leading-tight">ตั้งค่าบอทและ LINE OA</h1>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5 font-body-md">
              กำหนดบุคลิกภาพ ปรับแต่งคำสั่ง AI และเชื่อมต่อ Webhook กับ LINE Official Account
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlaygroundOpen(true)}
              className="flex items-center justify-center gap-2 bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md font-semibold px-4 py-2 rounded-xl transition-all border border-outline-variant/40 shadow-sm cursor-pointer text-xs sm:text-sm"
            >
              <MessageSquare className="w-4 h-4 shrink-0 text-on-surface-variant" />
              <span>ทดสอบแชทจำลอง</span>
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-electric-blue hover:bg-primary text-white font-label-md font-semibold px-4 py-2 rounded-xl transition-all shadow-md shadow-electric-blue/20 hover:-translate-y-0.5 cursor-pointer disabled:opacity-50 shrink-0 text-xs sm:text-sm"
            >
              {loading ? <RefreshCw className="w-4 h-4 shrink-0 animate-spin" /> : <Save className="w-4 h-4 shrink-0" />}
              <span>{loading ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}</span>
            </button>
          </div>
        </div>

      {/* Alert Notification */}
      {message && (
        <div
          className={`p-4 rounded-xl text-xs sm:text-sm font-label-md flex items-center justify-between transition-all ${
            message.type === 'success'
              ? 'bg-success-green/10 text-success-green border border-success-green/20'
              : 'bg-error-red/10 text-error-red border border-error-red/20'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-success-green shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-error-red shrink-0" />
            )}
            <p>{message.text}</p>
          </div>
          <button onClick={() => setMessage(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Section 1: General Bot Profile */}
      <section className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
        <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-3.5 sm:pb-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-electric-blue/10 flex items-center justify-center text-electric-blue shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-on-surface font-headline-sm">โปรไฟล์และตัวตนของบอท</h2>
            <p className="text-[11px] sm:text-xs text-on-surface-variant">ตั้งชื่อบอท เลือกลักษณะนิสัย และข้อความทักทายแรก</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-5">
          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
              ชื่อร้านค้า
            </label>
            <input
              name="name"
              type="text"
              defaultValue={shop.name || ''}
              required
              className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
              ชื่อบอท AI
            </label>
            <input
              name="bot_name"
              type="text"
              defaultValue={shop.bot_name || 'น้อง DealMee'}
              placeholder="เช่น น้องเสิร์ฟ, น้องแคร์"
              className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
            บุคลิกและน้ำเสียงการพูด
          </label>
          <select
            name="personality"
            defaultValue={shop.personality || 'หญิง-สุภาพ'}
            className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all"
          >
            <option value="หญิง-สุภาพ">💬 หญิง - สุภาพ เรียบร้อย (ลงท้ายค่ะ/นะคะ)</option>
            <option value="หญิง-น่ารัก">💄 หญิง - น่ารัก เป็นกันเอง มีอีโมจิ</option>
            <option value="ชาย-สุภาพ">💻 ชาย - สุภาพ มืออาชีพ (ลงท้ายครับ)</option>
            <option value="ชาย-เป็นกันเอง">💪 ชาย - เป็นกันเอง สนิทสนม</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
            ข้อความทักทายแรกเมื่อลูกค้าแอดไลน์
          </label>
          <input
            name="greeting_message"
            type="text"
            defaultValue={shop.greeting_message || 'สวัสดีค่ะ มีอะไรให้ช่วยไหมคะ?'}
            placeholder="ข้อความที่บอทจะส่งทันทีเมื่อลูกค้าแอดไลน์เข้ามาครั้งแรก"
            className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all"
          />
        </div>
      </section>

      {/* Section 2: AI Prompt Instructions */}
      <section className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
        <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-3.5 sm:pb-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 shrink-0">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-on-surface font-headline-sm">คำสั่งและกฎกติกาการตอบ (System Prompt)</h2>
            <p className="text-[11px] sm:text-xs text-on-surface-variant">สอนวิธีคิด บริบทของร้าน และเงื่อนไขการตอบคำถามให้ AI</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
            รายละเอียดและบริบทของร้านค้า
          </label>
          <textarea
            name="description"
            rows={3}
            defaultValue={shop.description || ''}
            placeholder="เช่น ร้านของเราเป็นร้านขายเสื้อผ้าแฟชั่นผู้หญิง มีหน้าร้านอยู่ที่สยามสแควร์ เปิดทุกวัน 10:00-21:00 น."
            className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all leading-relaxed"
          ></textarea>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
            คำสั่งเฉพาะและกฎเหล็กการตอบ
          </label>
          <textarea
            name="system_prompt"
            rows={5}
            defaultValue={shop.system_prompt || ''}
            placeholder={`1. แนะนำสินค้าขายดีของร้านเมื่อลูกค้าถาม\n2. ตอบคำถามอย่างกระชับ ไม่เยิ่นย้อ\n3. หากลูกค้าถามราคา ให้แจ้งรายละเอียดราคาพร้อมวิธีชำระเงิน\n4. หากลูกค้าถามเรื่องนอกเหนือจากสินค้า ให้แจ้งว่า 'เดี๋ยวให้แอดมินช่วยดูแลนะคะ'`}
            className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all font-mono text-xs leading-relaxed"
          ></textarea>
        </div>
      </section>

      {/* Section: Proactive Sales Follow-up & Recovery */}
      <section className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
        <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-3.5 sm:pb-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-on-surface font-headline-sm flex items-center gap-2">
              <span>ระบบติดตามลูกค้าเชิงรุก (Proactive Sales Follow-up)</span>
              <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-900/60 dark:text-amber-200 dark:border-amber-700 px-2 py-0.5 rounded-full font-bold">
                AI Auto-Closing
              </span>
            </h2>
            <p className="text-[11px] sm:text-xs text-on-surface-variant">
              ให้ AI ทักตามลูกค้าอัตโนมัติเมื่อขอ QR แล้วยังไม่โอน, เตือนคิวนัดหมาย และทักกระตุ้นการซื้อซ้ำ
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: QR Payment Follow-up */}
          <div className="p-4 rounded-xl border border-outline-variant/50 bg-surface-container-lowest space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-xs sm:text-sm font-bold text-on-surface">ทักตามสลิป QR Code ค้างชำระ</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="qr_recovery_enabled"
                  value="true"
                  defaultChecked={shop.follow_up_config?.qr_recovery_enabled !== false}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              เมื่อส่ง QR ให้ลูกค้าแล้ว หากยังไม่ส่งสลิป บอทจะทักเตือนอย่างสุภาพและแจ้งรอบจัดส่งของวันเพื่อกระตุ้นการโอน (ยกเลิกอัตโนมัติเมื่อสลิปผ่าน)
            </p>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] font-medium text-outline">หน่วงเวลาทัก:</span>
              <select
                name="qr_recovery_delay_mins"
                defaultValue={shop.follow_up_config?.qr_recovery_delay_mins || 20}
                className="px-2.5 py-1 text-xs rounded-lg border border-outline-variant bg-surface text-on-surface outline-none"
              >
                <option value={15}>15 นาที</option>
                <option value={20}>20 นาที (แนะนำ)</option>
                <option value={30}>30 นาที</option>
                <option value={60}>1 ชั่วโมง</option>
              </select>
            </div>
          </div>

          {/* Card 2: Booking Reminders */}
          <div className="p-4 rounded-xl border border-outline-variant/50 bg-surface-container-lowest space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-xs sm:text-sm font-bold text-on-surface">ส่งข้อความเตือนนัดหมาย</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="booking_reminder_enabled"
                  value="true"
                  defaultChecked={shop.follow_up_config?.booking_reminder_enabled !== false}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
            </div>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              ส่งข้อความแจ้งเตือนอัตโนมัติล่วงหน้า 24 ชม. และ 3 ชม. ก่อนถึงเวลา เพื่อลดอัตราการไม่มาตามนัด (No-show)
            </p>
            <div className="text-[11px] text-outline pt-1">
              ✨ ส่งเตือนอัตโนมัติ: ล่วงหน้า 1 วัน และ 3 ชม.
            </div>
          </div>

          {/* Card 3: Repurchase & Feedback Follow-up */}
          <div className="p-4 rounded-xl border border-outline-variant/50 bg-surface-container-lowest space-y-3 md:col-span-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HeartHandshake className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-xs sm:text-sm font-bold text-on-surface">ทักถามความพึงพอใจ & เสนอโปรซื้อซ้ำ</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="repurchase_enabled"
                  value="true"
                  defaultChecked={shop.follow_up_config?.repurchase_enabled !== false}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              หลังลูกค้าได้รับสินค้าหรือใช้บริการเรียบร้อย บอทจะทักถามผลตอบรับ และมอบข้อเสนอพิเศษเพื่อกระตุ้นให้กลับมาซื้อซ้ำ
            </p>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] font-medium text-outline">ส่งข้อความหลังสั่งซื้อ:</span>
              <select
                name="repurchase_delay_days"
                defaultValue={shop.follow_up_config?.repurchase_delay_days || 21}
                className="px-2.5 py-1 text-xs rounded-lg border border-outline-variant bg-surface text-on-surface outline-none"
              >
                <option value={14}>14 วัน</option>
                <option value={21}>21 วัน (แนะนำ)</option>
                <option value={30}>30 วัน</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: LINE OA Integration */}
      <section className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
        <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-3.5 sm:pb-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-success-green/10 flex items-center justify-center text-success-green shrink-0">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-on-surface font-headline-sm">เชื่อมต่อ LINE Official Account</h2>
            <p className="text-[11px] sm:text-xs text-on-surface-variant">กรอก Credentials จาก LINE Developers เพื่อเปิดใช้งานบอท</p>
          </div>
        </div>

        <div className="space-y-3.5 sm:space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
              Channel Access Token
            </label>
            <input
              name="line_token"
              type="text"
              defaultValue={shop.line_token || ''}
              placeholder="eyJhbGciOiJIUzI1NiJ9..."
              className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
              Channel Secret
            </label>
            <input
              name="line_secret"
              type="password"
              defaultValue={shop.line_secret || ''}
              placeholder="••••••••••••••••••••••••"
              className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
              LINE Webhook URL ประจำร้านค้าของคุณ
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                readOnly
                value={lineWebhookUrl}
                className="w-full flex-1 px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-surface-container-high text-on-surface-variant text-xs font-mono outline-none truncate"
              />
              <button
                type="button"
                onClick={handleCopyLine}
                className="w-full sm:w-auto px-4 py-2.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 border border-outline-variant/50 shrink-0 cursor-pointer"
              >
                {copiedLine ? <Check className="w-4 h-4 text-success-green shrink-0" /> : <Copy className="w-4 h-4 shrink-0" />}
                <span>{copiedLine ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
              </button>
            </div>
            <p className="text-[11px] sm:text-xs text-outline mt-1 leading-relaxed">
              นำ URL นี้ไปใส่ใน LINE Developers Console → Messaging API → Webhook URL แล้วกดเปิด Verify
            </p>
          </div>
        </div>
      </section>

      {/* Section 4: Facebook Page (Messenger) Integration */}
      <section className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
        <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3.5 sm:pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 shrink-0">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-on-surface font-headline-sm">เชื่อมต่อ Facebook Page (Messenger)</h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">Omnichannel v2</span>
              </div>
              <p className="text-[11px] sm:text-xs text-on-surface-variant">เชื่อมต่อ Meta Graph API และ Webhook ให้บอทตอบแชทลูกค้า Facebook อัตโนมัติ</p>
            </div>
          </div>
        </div>

        <div className="space-y-3.5 sm:space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
                Facebook Page ID
              </label>
              <input
                name="facebook_page_id"
                type="text"
                defaultValue={shop.facebook_page_id || ''}
                placeholder="เช่น 109823476123456"
                className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all font-mono"
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
                className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all font-mono"
              />
              <p className="text-[11px] text-outline">ใช้ยืนยัน Webhook ตอนตั้งค่าใน Meta Developers Console</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
              Page Access Token (Long-Lived Token)
            </label>
            <input
              name="facebook_page_token"
              type="password"
              defaultValue={shop.facebook_page_token || ''}
              placeholder="EAABw..."
              className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all font-mono"
            />
            <p className="text-[11px] text-outline">Token สำหรับส่งข้อความตอบกลับผ่าน Graph API (ทำงานได้ทันทีในโหมด Development)</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
              App Secret (สำหรับยืนยันความปลอดภัย X-Hub-Signature-256)
            </label>
            <input
              name="facebook_app_secret"
              type="password"
              defaultValue={shop.facebook_app_secret || ''}
              placeholder="••••••••••••••••••••••••"
              className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
              Facebook Webhook Callback URL
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                readOnly
                value={fbWebhookUrl}
                className="w-full flex-1 px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-surface-container-high text-on-surface-variant text-xs font-mono outline-none truncate"
              />
              <button
                type="button"
                onClick={handleCopyFb}
                className="w-full sm:w-auto px-4 py-2.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 border border-outline-variant/50 shrink-0 cursor-pointer"
              >
                {copiedFb ? <Check className="w-4 h-4 text-success-green shrink-0" /> : <Copy className="w-4 h-4 shrink-0" />}
                <span>{copiedFb ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
              </button>
            </div>
            <p className="text-[11px] sm:text-xs text-outline mt-1 leading-relaxed">
              นำ URL นี้และ Verify Token ไปใส่ใน Meta for Developers → Webhooks → Page (Messenger) แล้วเลือก Subscribe อีเวนต์ <code>messages</code> และ <code>messaging_postbacks</code>
            </p>
          </div>

          {/* Interactive Facebook Simulator Box */}
          <div className="mt-4 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-700">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>จำลองทดสอบ Facebook Messenger (ไม่ต้องรอ Meta ตรวจสอบแอพ)</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-on-surface-variant">โหมด:</span>
                <select
                  value={simMode}
                  onChange={(e) => setSimMode(e.target.value as any)}
                  className="px-2 py-0.5 rounded border border-outline-variant bg-surface text-on-surface text-xs outline-none"
                >
                  <option value="auto">Auto Reply (บอทตอบทันที)</option>
                  <option value="copilot">Copilot (ร่างให้แอดมินตรวจ)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={simText}
                onChange={(e) => setSimText(e.target.value)}
                placeholder="พิมพ์ข้อความทดสอบ เช่น สอบถามสินค้า หรือ มีโปรโมชั่นไหม"
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-outline-variant bg-surface text-on-surface outline-none focus:border-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleTestFbSimulation()
                  }
                }}
              />
              <button
                type="button"
                onClick={handleTestFbSimulation}
                disabled={simLoading || !simText.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-sm"
              >
                {simLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{simLoading ? 'กำลังประมวลผล...' : 'ทดสอบส่งข้อความ'}</span>
              </button>
            </div>

            {simResult && (
              <div className="p-3 rounded-lg bg-surface border border-outline-variant/60 text-xs space-y-1.5 mt-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span className={simResult.error ? 'text-error-red' : 'text-success-green'}>
                    {simResult.error ? '❌ เกิดข้อผิดพลาด' : '✅ จำลองการทำงานสำเร็จ'}
                  </span>
                  <span className="text-on-surface-variant font-mono">
                    {simResult.status} ({simResult.aiMode || simMode})
                  </span>
                </div>
                {simResult.reply && (
                  <div className="p-2 rounded bg-surface-container-low text-on-surface leading-relaxed">
                    <span className="font-semibold text-blue-600 block mb-0.5">บอท AI ตอบกลับ:</span>
                    {simResult.reply}
                  </div>
                )}
                {simResult.suggestedReply && (
                  <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-on-surface leading-relaxed">
                    <span className="font-semibold text-amber-700 block mb-0.5">💡 คำแนะนำร่างข้อความ (Copilot Mode):</span>
                    {simResult.suggestedReply}
                    <div className="text-[10px] text-amber-800 mt-1">ข้อความนี้จะถูกส่งไปแสดงในหน้ารวมแชท (Inbox) เพื่อให้แอดมินกดอนุมัติส่งได้ใน 1 คลิก</div>
                  </div>
                )}
                {simResult.error && (
                  <div className="text-error-red text-[11px]">{simResult.error}</div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Bottom Save Button & Notification */}
      {message && (
        <div
          className={`p-4 rounded-xl text-xs sm:text-sm font-label-md flex items-center justify-between transition-all ${
            message.type === 'success'
              ? 'bg-success-green/10 text-success-green border border-success-green/20'
              : 'bg-error-red/10 text-error-red border border-error-red/20'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-success-green shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-error-red shrink-0" />
            )}
            <p>{message.text}</p>
          </div>
          <button onClick={() => setMessage(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-4 sm:pt-6 border-t border-outline-variant/30 mt-6 sm:pr-36">
        <div className="text-xs text-on-surface-variant flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>ตรวจสอบคำสั่งและบุคลิกภาพของ AI บอทก่อนกดบันทึก</span>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-electric-blue hover:bg-primary text-white font-label-md font-semibold px-8 py-3 rounded-xl transition-all shadow-md shadow-electric-blue/20 hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer text-xs sm:text-sm shrink-0"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 animate-spin" />
          ) : (
            <Save className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          )}
          <span>{loading ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าทั้งหมด'}</span>
        </button>
      </div>
    </form>

    <ChatPlaygroundModal
      isOpen={isPlaygroundOpen}
      onClose={() => setIsPlaygroundOpen(false)}
      initialBotName={shop.bot_name || 'น้อง DealMee'}
      initialPersonality={shop.personality || 'สุภาพ เรียบร้อย มืออาชีพ และมุ่งมั่นให้บริการ'}
    />
    </>
  )
}
