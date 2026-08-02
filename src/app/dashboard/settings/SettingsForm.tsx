'use client'

import { useState } from 'react'
import { updateBotSettings } from './actions'
import ChatPlaygroundModal from '../components/ChatPlaygroundModal'

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
  business_type: string | null
}

export default function SettingsForm({ shop }: { shop: ShopData }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPlaygroundOpen, setIsPlaygroundOpen] = useState(false)

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhook/${shop.id}`
    : `https://botify.ai/api/webhook/${shop.id}`

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
              <span className="material-symbols-outlined text-[18px]">chat</span>
              <span>ทดสอบแชทจำลอง</span>
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-electric-blue hover:bg-primary text-white font-label-md font-semibold px-4 py-2 rounded-xl transition-all shadow-md shadow-electric-blue/20 hover:-translate-y-0.5 cursor-pointer disabled:opacity-50 shrink-0 text-xs sm:text-sm"
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
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
            <span className="material-symbols-outlined text-[20px]">
              {message.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <p>{message.text}</p>
          </div>
          <button onClick={() => setMessage(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Section 1: General Bot Profile */}
      <section className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
        <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-3.5 sm:pb-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-electric-blue/10 flex items-center justify-center text-electric-blue shrink-0">
            <span className="material-symbols-outlined text-[20px]">smart_toy</span>
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
              defaultValue={shop.bot_name || 'น้อง Botify'}
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
            <span className="material-symbols-outlined text-[20px]">psychology</span>
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

      {/* Section 3: LINE OA Integration */}
      <section className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
        <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-3.5 sm:pb-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-success-green/10 flex items-center justify-center text-success-green shrink-0">
            <span className="material-symbols-outlined text-[20px]">forum</span>
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
              Webhook URL ประจำร้านค้าของคุณ
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                readOnly
                value={webhookUrl}
                className="w-full flex-1 px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-surface-container-high text-on-surface-variant text-xs font-mono outline-none truncate"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="w-full sm:w-auto px-4 py-2.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 border border-outline-variant/50 shrink-0 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {copied ? 'check' : 'content_copy'}
                </span>
                <span>{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
              </button>
            </div>
            <p className="text-[11px] sm:text-xs text-outline mt-1 leading-relaxed">
              นำ URL นี้ไปใส่ใน LINE Developers Console → Messaging API → Webhook URL แล้วกดเปิด Verify
            </p>
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
            <span className="material-symbols-outlined text-[20px]">
              {message.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <p>{message.text}</p>
          </div>
          <button onClick={() => setMessage(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      <div className="flex justify-end pt-2 sm:pt-4">
        <button
          type="submit"
          disabled={loading}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-electric-blue hover:bg-primary text-white font-label-md font-semibold px-8 py-3 rounded-xl transition-all shadow-md shadow-electric-blue/20 hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer text-xs sm:text-sm"
        >
          <span className="material-symbols-outlined text-[18px] sm:text-[20px]">
            {loading ? 'sync' : 'save'}
          </span>
          <span>{loading ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าทั้งหมด'}</span>
        </button>
      </div>
    </form>

    <ChatPlaygroundModal
      isOpen={isPlaygroundOpen}
      onClose={() => setIsPlaygroundOpen(false)}
      initialBotName={shop.bot_name || 'น้อง Botify'}
      initialPersonality={shop.personality || 'สุภาพ เรียบร้อย มืออาชีพ และมุ่งมั่นให้บริการ'}
    />
    </>
  )
}
