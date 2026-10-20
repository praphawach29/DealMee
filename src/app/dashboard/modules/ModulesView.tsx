'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateShopFeatures, updateBotDiscountCap, updateFollowUpConfig, updatePendingOrderExpiry, updateBusinessHours, updateHighValueThreshold } from './actions'
import { DEFAULT_HIGH_VALUE_THRESHOLD, HIGH_VALUE_THRESHOLD_OPTIONS } from '@/lib/ai/salesModes'
import { PENDING_ORDER_EXPIRY_OPTIONS } from '@/lib/orders/pendingOrderExpiry'
import { DEFAULT_BUSINESS_HOURS, THAI_DAY_SHORT, type BusinessHours } from '@/lib/shop/businessHours'

interface ModulesViewProps {
  initialFeatures: Record<string, boolean>
  bizType?: string
  initialDiscountCap?: number
  initialFollowUp?: Record<string, any>
  initialOrderExpiryHours?: number
  initialHighValueThreshold?: number
  initialBusinessHours?: BusinessHours
}

export default function ModulesView({
  initialFeatures,
  bizType = 'retail',
  initialDiscountCap = 0,
  initialFollowUp = {},
  initialOrderExpiryHours = 24,
  initialHighValueThreshold = DEFAULT_HIGH_VALUE_THRESHOLD,
  initialBusinessHours = DEFAULT_BUSINESS_HOURS,
}: ModulesViewProps) {
  const router = useRouter()
  const isBookingDefault = bizType === 'booking' || bizType === 'service'
  const [featureState, setFeatureState] = useState<Record<string, boolean>>({
    auto_reply: initialFeatures?.auto_reply ?? true,
    booking_system: initialFeatures?.booking_system ?? isBookingDefault,
    slip_verify: initialFeatures?.slip_verify ?? true,
    product_recommend: initialFeatures?.product_recommend ?? true,
    admin_notify: initialFeatures?.admin_notify ?? true,
    official_letters: initialFeatures?.official_letters ?? false,
  })

  const [loading, setLoading] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [discountCap, setDiscountCap] = useState<string>(String(initialDiscountCap))
  const [savingCap, setSavingCap] = useState(false)

  // Automatic follow-up messages (shops.follow_up_config); a missing value means on, as the scheduler treats it
  const [followUp, setFollowUp] = useState({
    qr_recovery_enabled: initialFollowUp.qr_recovery_enabled !== false,
    qr_recovery_delay_mins: Number(initialFollowUp.qr_recovery_delay_mins) || 20,
    booking_reminder_enabled: initialFollowUp.booking_reminder_enabled !== false,
    repurchase_enabled: initialFollowUp.repurchase_enabled !== false,
    repurchase_delay_days: Number(initialFollowUp.repurchase_delay_days) || 21,
  })
  const [savingFollowUp, setSavingFollowUp] = useState(false)
  const [orderExpiryHours, setOrderExpiryHours] = useState<number>(initialOrderExpiryHours)
  const [highValue, setHighValue] = useState<number>(initialHighValueThreshold)
  const [savingHighValue, setSavingHighValue] = useState(false)
  const [savingExpiry, setSavingExpiry] = useState(false)

  const showToast = (text: string) => {
    setToastMessage(text)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const saveFollowUp = async (patch: Partial<typeof followUp>) => {
    const previous = followUp
    setFollowUp({ ...followUp, ...patch })
    setSavingFollowUp(true)
    const res = await updateFollowUpConfig(patch)
    setSavingFollowUp(false)
    if (res?.error) {
      setFollowUp(previous)
      alert(res.error)
    } else {
      showToast(res?.success || 'บันทึกแล้ว')
    }
  }

  const [businessHours, setBusinessHours] = useState<BusinessHours>(initialBusinessHours)
  const [savingHours, setSavingHours] = useState(false)

  const saveBusinessHours = async () => {
    setSavingHours(true)
    const res = await updateBusinessHours(businessHours)
    setSavingHours(false)
    if (res?.error) {
      alert(res.error)
    } else {
      showToast(res?.success || 'บันทึกแล้ว')
    }
  }

  const toggleDay = (day: number) =>
    setBusinessHours((h) => ({
      ...h,
      days: h.days.includes(day) ? h.days.filter((d) => d !== day) : [...h.days, day].sort(),
    }))

  const saveHighValue = async (value: number) => {
    const previous = highValue
    setHighValue(value)
    setSavingHighValue(true)
    const res = await updateHighValueThreshold(value)
    setSavingHighValue(false)
    if (res?.error) {
      setHighValue(previous)
      alert(res.error)
    } else {
      showToast(res?.success || 'บันทึกแล้ว')
    }
  }

  const saveOrderExpiry = async (hours: number) => {
    const previous = orderExpiryHours
    setOrderExpiryHours(hours)
    setSavingExpiry(true)
    const res = await updatePendingOrderExpiry(hours)
    setSavingExpiry(false)
    if (res?.error) {
      setOrderExpiryHours(previous)
      alert(res.error)
    } else {
      showToast(res?.success || 'บันทึกแล้ว')
    }
  }

  const handleSaveDiscountCap = async () => {
    setSavingCap(true)
    const res = await updateBotDiscountCap(Number(discountCap))
    setSavingCap(false)
    if (res?.error) {
      alert(res.error)
    } else {
      setToastMessage(res?.success || 'บันทึกแล้ว')
      setTimeout(() => setToastMessage(null), 3000)
      router.refresh()
    }
  }

  const modulesList = [
    {
      id: 'auto_reply',
      name: '🤖 AI ตอบแชทอัตโนมัติ',
      description: 'อนุญาตให้ AI Agent ตอบข้อความแชทของลูกค้าโดยอัตโนมัติตาม Prompt และคลังความรู้',
      icon: 'smart_toy',
      color: 'text-electric-blue bg-electric-blue/10',
    },
    {
      id: 'booking_system',
      name: '📅 ระบบจองคิวนัดหมาย',
      description: 'เปิดให้ AI สามารถเช็คปฏิทินเวลาว่าง แนะนำสล็อตเวลา และเปิดรับจองคิวให้ลูกค้า',
      icon: 'calendar_month',
      color: 'text-purple-600 bg-purple-500/10',
    },
    {
      id: 'slip_verify',
      name: '🧾 ระบบตรวจสลิปโอนเงิน',
      description: 'ตรวจสอบสลิปชำระเงินของลูกค้าผ่าน API ธนาคาร ยืนยันยอดโอนและยอดสลิปซ้ำ',
      icon: 'receipt_long',
      color: 'text-emerald-600 bg-emerald-500/10',
    },
    {
      id: 'product_recommend',
      name: '🛍️ ระบบแนะนำสินค้า & เชียร์ขาย',
      description: 'ดึงข้อมูลสินค้าในแคตตาล็อกมาแนะนำ ส่งรูปภาพสินค้า และแจ้งราคากับลูกค้า',
      icon: 'add_shopping_cart',
      color: 'text-amber-600 bg-amber-500/10',
    },
    {
      id: 'admin_notify',
      name: '🔔 แจ้งเตือนแอดมินเมื่อมีออเดอร์',
      description: 'ส่งการ์ดแจ้งเตือนเข้า LINE ส่วนตัวของเจ้าของร้าน เมื่อมีออเดอร์ใหม่หรือลูกค้าขอคุยกับคน',
      icon: 'notifications_active',
      color: 'text-rose-600 bg-rose-500/10',
    },
    {
      id: 'official_letters',
      name: '🏛️ ระบบร่างหนังสือราชการ (ระเบียบสารบรรณ)',
      description: 'เปิดใช้สตูดิโอร่างหนังสือราชการ บันทึกข้อความ ครุฑไทย และจัดรูปแบบตามระเบียบงานสารบรรณ พ.ศ. 2526',
      icon: 'history_edu',
      color: 'text-indigo-600 bg-indigo-500/10',
    },
  ]

  const handleToggle = async (id: string) => {
    const nextVal = !featureState[id]
    const nextState = {
      ...featureState,
      [id]: nextVal,
    }

    setFeatureState(nextState)
    setLoading(true)

    const res = await updateShopFeatures(nextState)
    setLoading(false)

    if (res?.error) {
      alert(res.error)
      setFeatureState(featureState)
    } else {
      setToastMessage('บันทึกสถานะสวิตช์ลงฐานข้อมูล Supabase เรียบร้อยแล้ว!')
      setTimeout(() => setToastMessage(null), 3000)
      router.refresh()
    }
  }

  return (
    <div className="flex flex-col w-full relative space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-on-surface font-headline-md leading-tight">เครื่องมือ & ทักษะ AI</h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5 font-body-md">
            เปิด-ปิด ความสามารถพิเศษของ AI Agent ประจำร้านค้าของคุณ ข้อมูลจะถูกบันทึกลง Supabase ทันที
          </p>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3.5 rounded-xl bg-success-green/10 text-success-green border border-success-green/20 text-xs sm:text-sm font-bold flex items-center gap-2 animate-in fade-in">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Master Section Container */}
      <section className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-electric-blue/10 flex items-center justify-center text-electric-blue shrink-0">
            <span className="material-symbols-outlined text-[18px]">extension</span>
          </div>
          <div>
            <h2 className="text-base font-bold text-on-surface font-headline-sm">รายการทักษะและฟังก์ชันทั้งหมด</h2>
            <p className="text-[11px] sm:text-xs text-on-surface-variant">เลือกเปิดใช้งานฟีเจอร์ที่คุณต้องการให้บอทช่วยทำงาน</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-5">
          {modulesList.map((m) => {
            const isEnabled = !!featureState[m.id]

            return (
              <div key={m.id} className="bg-merchant-bg border border-outline-variant/40 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 flex flex-col justify-between space-y-3 hover:border-electric-blue/40 transition-all">
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center font-bold shrink-0 ${m.color}`}>
                      <span className="material-symbols-outlined text-lg sm:text-xl">{m.icon}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-on-surface text-xs sm:text-sm leading-tight truncate">{m.name}</h3>
                      <span className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md inline-block mt-0.5 ${
                        isEnabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500 border border-gray-200'
                      }`}>
                        {isEnabled ? '● เปิดใช้งานอยู่' : '○ ปิดใช้งาน'}
                      </span>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleToggle(m.id)}
                    className={`w-11 h-6 sm:w-13 sm:h-7 rounded-full p-0.5 transition-colors duration-200 cursor-pointer disabled:opacity-50 shrink-0 ${
                      isEnabled ? 'bg-electric-blue' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                        isEnabled ? 'translate-x-5 sm:translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <p className="text-[11px] sm:text-xs text-on-surface-variant leading-relaxed font-body-sm">
                  {m.description}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Bot discount cap */}
      <section className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <div>
          <h2 className="text-base font-bold text-on-surface font-headline-sm">💸 เพดานส่วนลดที่บอทให้ได้เอง</h2>
          <p className="text-[11px] sm:text-xs text-on-surface-variant mt-0.5">
            บอทลดราคาให้ลูกค้าที่ลังเลได้ไม่เกินกี่ % ของยอดออเดอร์ (ครั้งเดียวต่อออเดอร์) ใส่ 0 เพื่อปิด — บอทจะส่งเรื่องขอส่วนลดให้แอดมินแทน
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <input
            type="number"
            min={0}
            max={50}
            step={1}
            value={discountCap}
            onChange={(e) => setDiscountCap(e.target.value)}
            className="w-24 rounded-xl border border-outline-variant/60 bg-merchant-bg px-3 py-2 text-sm text-on-surface"
          />
          <span className="text-sm text-on-surface-variant">%</span>
          <button
            type="button"
            disabled={savingCap}
            onClick={handleSaveDiscountCap}
            className="rounded-xl bg-electric-blue px-4 py-2 text-xs sm:text-sm font-bold text-white disabled:opacity-50"
          >
            {savingCap ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </section>

      {/* Automatic follow-up messages */}
      <section className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-bold text-on-surface font-headline-sm">⏰ ข้อความติดตามลูกค้าอัตโนมัติ</h2>
          <p className="text-[11px] sm:text-xs text-on-surface-variant mt-0.5">
            บอททักลูกค้าเองตามจังหวะ ปิดแล้วข้อความที่ตั้งเวลาไว้จะถูกยกเลิกด้วย
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
          {[
              {
                key: 'qr_recovery_enabled' as const,
                title: '💳 ทวงถามการโอนเงิน',
                desc: 'ลูกค้าได้ QR แล้วยังไม่ส่งสลิป บอทจะทักเตือนอย่างสุภาพ (หยุดเองเมื่อสลิปผ่าน)',
                delay: {
                  key: 'qr_recovery_delay_mins' as const,
                  label: 'ทักหลังส่ง QR',
                  options: [[15, '15 นาที'], [20, '20 นาที (แนะนำ)'], [30, '30 นาที'], [60, '1 ชั่วโมง']] as [number, string][],
                },
              },
              {
                key: 'booking_reminder_enabled' as const,
                title: '📅 เตือนก่อนถึงคิวนัด',
                desc: 'ส่งข้อความเตือนล่วงหน้า 1 วัน และ 3 ชั่วโมงก่อนเวลานัด ลดการไม่มาตามนัด',
              },
              {
                key: 'repurchase_enabled' as const,
                title: '💚 ทักถามความพึงพอใจ & ชวนซื้อซ้ำ',
                desc: 'หลังลูกค้าได้รับสินค้า บอทจะทักถามผลตอบรับและเสนอโปรเพื่อกลับมาซื้อซ้ำ',
                delay: {
                  key: 'repurchase_delay_days' as const,
                  label: 'ทักหลังสั่งซื้อ',
                  options: [[14, '14 วัน'], [21, '21 วัน (แนะนำ)'], [30, '30 วัน']] as [number, string][],
                },
              },
            ].map((item) => {
            const on = followUp[item.key]
            return (
              <div key={item.key} className="bg-merchant-bg border border-outline-variant/40 rounded-xl p-3.5 space-y-2.5 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-on-surface text-xs sm:text-sm leading-tight">{item.title}</h3>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={item.title}
                    disabled={savingFollowUp}
                    onClick={() => saveFollowUp({ [item.key]: !on })}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 cursor-pointer disabled:opacity-50 shrink-0 ${on ? 'bg-electric-blue' : 'bg-slate-300'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${on ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
                <p className="text-[11px] sm:text-xs text-on-surface-variant leading-relaxed flex-1">{item.desc}</p>
                {item.delay && (
                  <label className={`flex items-center gap-2 text-[11px] text-on-surface-variant ${on ? '' : 'opacity-50'}`}>
                    <span>{item.delay.label}</span>
                    <select
                      value={followUp[item.delay.key]}
                      disabled={!on || savingFollowUp}
                      onChange={(e) => saveFollowUp({ [item.delay!.key]: Number(e.target.value) })}
                      className="px-2 py-1 text-xs rounded-lg border border-outline-variant bg-surface text-on-surface outline-none"
                    >
                      {item.delay.options.map(([value, text]) => (
                        <option key={value} value={value}>{text}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Cancel unpaid orders */}
      <section className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <div>
          <h2 className="text-base font-bold text-on-surface font-headline-sm">🗑️ ยกเลิกออเดอร์ค้างชำระอัตโนมัติ</h2>
          <p className="text-[11px] sm:text-xs text-on-surface-variant mt-0.5">
            ออเดอร์ที่ลูกค้าไม่ชำระภายในเวลาที่กำหนดจะถูกยกเลิก คืนสต็อกสินค้า และหยุดข้อความทวงถามการโอนเงิน
          </p>
        </div>
        <label className="flex items-center gap-2.5 text-sm text-on-surface-variant">
          <span>ยกเลิกเมื่อไม่ชำระภายใน</span>
          <select
            value={orderExpiryHours}
            disabled={savingExpiry}
            onChange={(e) => saveOrderExpiry(Number(e.target.value))}
            className="rounded-xl border border-outline-variant/60 bg-merchant-bg px-3 py-2 text-sm text-on-surface disabled:opacity-50"
          >
            {PENDING_ORDER_EXPIRY_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {h === 0 ? 'ไม่ยกเลิกอัตโนมัติ' : h === 24 ? '24 ชั่วโมง (ค่าเริ่มต้น)' : `${h} ชั่วโมง`}
              </option>
            ))}
          </select>
        </label>
      </section>

      {/* High-value products go to the admin */}
      <section className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <div>
          <h2 className="text-base font-bold text-on-surface font-headline-sm">💎 สินค้าราคาสูง ให้แอดมินปิดการขาย</h2>
          <p className="text-[11px] sm:text-xs text-on-surface-variant mt-0.5">
            บอทตอบข้อมูลสินค้าได้ตามปกติ แต่เมื่อลูกค้าสนใจซื้อ บอทจะขอชื่อและเบอร์โทร แล้วแจ้งแอดมินทาง LINE ทันทีแทนการเปิดออเดอร์เอง
            ร้านที่ไม่มีสินค้าในระบบ (เพจบริการ/ให้ข้อมูล) บอทจะทำแบบนี้กับทุกคำขอซื้อโดยอัตโนมัติ
          </p>
        </div>
        <label className="flex items-center gap-2.5 text-sm text-on-surface-variant">
          <span>สินค้าราคาตั้งแต่</span>
          <select
            value={highValue}
            disabled={savingHighValue}
            onChange={(e) => saveHighValue(Number(e.target.value))}
            className="rounded-xl border border-outline-variant/60 bg-merchant-bg px-3 py-2 text-sm text-on-surface disabled:opacity-50"
          >
            {HIGH_VALUE_THRESHOLD_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v === 0 ? 'ไม่ใช้ (บอทขายเองทุกราคา)' : `${v.toLocaleString()} บาท${v === DEFAULT_HIGH_VALUE_THRESHOLD ? ' (ค่าเริ่มต้น)' : ''}`}
              </option>
            ))}
          </select>
        </label>
      </section>

      {/* Business hours */}
      <section className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-on-surface font-headline-sm">🕐 เวลาทำการของบอท</h2>
            <p className="text-[11px] sm:text-xs text-on-surface-variant mt-0.5">
              กำหนดเวลาที่แอดมินอยู่ บอทจะบอกลูกค้าได้ว่าแอดมินจะตอบกลับเมื่อไร (เวลาประเทศไทย)
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={businessHours.enabled}
            aria-label="ใช้เวลาทำการ"
            onClick={() => setBusinessHours((h) => ({ ...h, enabled: !h.enabled }))}
            className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 cursor-pointer shrink-0 ${businessHours.enabled ? 'bg-electric-blue' : 'bg-slate-300'}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${businessHours.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        <div className={`space-y-4 ${businessHours.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
          <div className="space-y-2">
            <p className="text-xs font-bold text-on-surface">วันทำการ</p>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                const on = businessHours.days.includes(d)
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDay(d)}
                    className={`min-w-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      on ? 'bg-electric-blue text-white border-electric-blue' : 'bg-merchant-bg text-on-surface-variant border-outline-variant/60'
                    }`}
                  >
                    {THAI_DAY_SHORT[d]}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-sm text-on-surface-variant">
            <span className="text-xs font-bold text-on-surface">เวลา</span>
            <input
              type="time"
              value={businessHours.open}
              onChange={(e) => setBusinessHours((h) => ({ ...h, open: e.target.value }))}
              className="rounded-xl border border-outline-variant/60 bg-merchant-bg px-3 py-2 text-sm text-on-surface"
              aria-label="เวลาเปิด"
            />
            <span>ถึง</span>
            <input
              type="time"
              value={businessHours.close}
              onChange={(e) => setBusinessHours((h) => ({ ...h, close: e.target.value }))}
              className="rounded-xl border border-outline-variant/60 bg-merchant-bg px-3 py-2 text-sm text-on-surface"
              aria-label="เวลาปิด"
            />
            {businessHours.close < businessHours.open && <span className="text-[11px]">(ปิดหลังเที่ยงคืน)</span>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {([
              ['outside_hours', 'บอทตอบเฉพาะนอกเวลาทำการ', 'ในเวลาทำการ บอทจะเงียบ ข้อความลูกค้าเข้ากล่องข้อความให้แอดมินตอบเอง'],
              ['always', 'บอทตอบตลอด 24 ชั่วโมง', 'บอทตอบทุกเวลา นอกเวลาทำการจะแจ้งลูกค้าว่าแอดมินจะกลับมาตอบเมื่อไร'],
            ] as const).map(([mode, title, desc]) => {
              const on = businessHours.bot_mode === mode
              return (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setBusinessHours((h) => ({ ...h, bot_mode: mode }))}
                  className={`text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
                    on ? 'border-electric-blue bg-electric-blue/5' : 'border-outline-variant/50 bg-merchant-bg'
                  }`}
                >
                  <span className="flex items-center gap-2 text-xs sm:text-sm font-bold text-on-surface">
                    <span className={`w-4 h-4 rounded-full border-2 shrink-0 ${on ? 'border-electric-blue bg-electric-blue shadow-[inset_0_0_0_2px_white]' : 'border-slate-300'}`} />
                    {title}
                  </span>
                  <span className="block text-[11px] text-on-surface-variant mt-1 leading-relaxed">{desc}</span>
                </button>
              )
            })}
          </div>
        </div>

        <button
          type="button"
          disabled={savingHours}
          onClick={saveBusinessHours}
          className="rounded-xl bg-electric-blue px-4 py-2 text-xs sm:text-sm font-bold text-white disabled:opacity-50"
        >
          {savingHours ? 'กำลังบันทึก...' : 'บันทึกเวลาทำการ'}
        </button>
      </section>
    </div>
  )
}
