'use client'

import { useState } from 'react'
import { updateShopFeatures } from './actions'

interface ModulesViewProps {
  initialFeatures: Record<string, boolean>
}

export default function ModulesView({ initialFeatures }: ModulesViewProps) {
  const [featureState, setFeatureState] = useState<Record<string, boolean>>({
    auto_reply: initialFeatures?.auto_reply ?? true,
    booking_system: initialFeatures?.booking_system ?? true,
    slip_verify: initialFeatures?.slip_verify ?? false,
    product_recommend: initialFeatures?.product_recommend ?? true,
    admin_notify: initialFeatures?.admin_notify ?? true,
  })

  const [loading, setLoading] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

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
  ]

  const handleToggle = async (id: string) => {
    const nextState = {
      ...featureState,
      [id]: !featureState[id],
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
    </div>
  )
}
