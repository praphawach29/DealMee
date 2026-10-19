'use client'

import Link from 'next/link'
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
  RefreshCw,
  Share2,
  Sparkles,
  Cpu,
} from 'lucide-react'

interface ShopData {
  id: string
  name: string
  bot_name: string | null
  description: string | null
  ai_model?: string | null
  custom_ai_model?: string | null
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
}

interface SettingsFormProps {
  shop: ShopData
  onNavigateToChannels?: () => void
}

export default function SettingsForm({ shop, onNavigateToChannels }: SettingsFormProps) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPlaygroundOpen, setIsPlaygroundOpen] = useState(false)

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
            <h1 className="text-xl sm:text-2xl font-bold text-on-surface font-headline-md leading-tight">
              ตั้งค่าบอท AI & บุคลิกภาพ
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5 font-body-md">
              กำหนดชื่อบอท น้ำเสียง บุคลิกภาพ ปรับแต่งคำสั่งระบบ (System Prompt) และระบบติดตามผลอัตโนมัติ
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

        {/* Managed AI Engine Architecture (Locked Enterprise Standard) */}
        <div className="space-y-3 pt-3 border-t border-outline-variant/30">
          <input type="hidden" name="ai_model" value="gemini-3.8-flash" />
          <div className="flex items-center justify-between">
            <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-electric-blue" />
              <span>โครงสร้างสมองกล AI ประจำร้าน (Managed AI Engine)</span>
            </label>
            <span className="text-[10px] text-success-green font-bold px-2 py-0.5 rounded-full bg-success-green/10 border border-success-green/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success-green animate-pulse"></span>
              ความเสถียร 99.9%
            </span>
          </div>
          <p className="text-[11px] text-on-surface-variant">
            ระบบกำหนดมาตรฐานโมเดลที่ดีที่สุดและคุ้มค่าโควต้าให้โดยอัตโนมัติ พร้อมระบบสำรองข้ามค่ายเพื่อความต่อเนื่องของธุรกิจ
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Primary Engine */}
            <div className="bg-merchant-bg border border-electric-blue/30 rounded-xl p-3.5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-electric-blue/10 rounded-bl-full pointer-events-none"></div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-bold text-electric-blue bg-electric-blue/10 px-2 py-0.5 rounded-md">
                  โมเดลหลัก (Primary)
                </span>
                <span className="text-xs font-bold text-on-surface">Gemini 3.8 Flash Ultra</span>
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                ขับเคลื่อนแชทขายของอัตโนมัติ (LINE/FB) และ Copilot วิเคราะห์ธุรกิจ ด้วยความเร็วตอบสนองสูงพิเศษ ~1.1s ดึงข้อมูลสดจากฐานข้อมูล
              </p>
            </div>

            {/* Failover Engine */}
            <div className="bg-merchant-bg border border-emerald-500/30 rounded-xl p-3.5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-bl-full pointer-events-none"></div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                  สำรองฉุกเฉิน (Failover)
                </span>
                <span className="text-xs font-bold text-on-surface">ChatGPT (OpenAI)</span>
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                สลับการทำงานอัตโนมัติทันทีหากเซิร์ฟเวอร์ Google มีปัญหา ทำให้แชทบอทของร้านไม่เคยล่มและไม่พลาดทุกออเดอร์
              </p>
            </div>
          </div>

          <div className="bg-surface-container/60 border border-outline-variant/30 rounded-xl p-3 flex items-start gap-2.5 text-[11px] text-on-surface-variant">
            <Cpu className="w-4 h-4 text-electric-blue shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-on-surface">การจัดการโควต้าอัตโนมัติ (Zero Maintenance): </span>
              DealMee ดูแลและปรับจูนความเร็วตลอด 24 ชม. ไม่มีการหักโควต้าซ้ำซ้อน และควบคุมต้นทุนแพ็กเกจให้คุ้มค่าที่สุดสำหรับร้านค้า
            </div>
          </div>
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

      {/* Follow-up messages moved to the tools page */}
      <Link
        href="/dashboard/modules"
        className="block bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-5 shadow-sm hover:border-electric-blue/40 transition-colors"
      >
        <span className="text-sm font-bold text-on-surface">⏰ ข้อความติดตามลูกค้าอัตโนมัติ</span>
        <span className="block text-[11px] sm:text-xs text-on-surface-variant mt-0.5">
          ย้ายไปอยู่ที่หน้า &quot;เครื่องมือ&quot; แล้ว ทั้งทวงถามการโอนเงิน เตือนคิวนัด และชวนซื้อซ้ำ →
        </span>
      </Link>

      {/* Omnichannel Callout Card */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-purple-500/10 border border-outline-variant/50 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-electric-blue shrink-0" />
            <h3 className="text-sm sm:text-base font-bold text-on-surface">
              ต้องการเชื่อมต่อ LINE Official Account หรือ Facebook Page?
            </h3>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            การเชื่อมต่อ Webhook, Access Token, และคำแนะนำทีละขั้นตอน ถูกจัดไว้ในแท็บ <strong>&ldquo;เชื่อมต่อ LINE &amp; Facebook&rdquo;</strong> แยกต่างหากอย่างเป็นสัดส่วน พร้อมปุ่มลิงก์ตรงและตัวจำลองแชท
          </p>
        </div>
        {onNavigateToChannels && (
          <button
            type="button"
            onClick={onNavigateToChannels}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-electric-blue hover:bg-primary text-white rounded-xl text-xs font-semibold shrink-0 transition-all shadow-sm cursor-pointer hover:-translate-y-0.5"
          >
            <span>ไปที่หน้าเชื่อมต่อช่องทางแชท →</span>
          </button>
        )}
      </div>

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

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-4 sm:pt-6 pb-20 sm:pb-6 border-t border-outline-variant/30 mt-6 sm:pr-36">
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
