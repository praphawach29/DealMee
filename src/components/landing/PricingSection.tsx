'use client'

import React from 'react'
import Link from 'next/link'
import { Check, X } from 'lucide-react'

interface PricingPlan {
  id: string
  name: string
  price: number
  description: string
  featured?: boolean
  msgLimit: number
  productLimit: number
  aiCredits: number
  broadcast: boolean
  analytics: boolean
  slipCheck: boolean
  quotation: boolean
}

const pricingPlans: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 599,
    description: 'เหมาะสำหรับร้านค้าเริ่มต้น เริ่มขายผ่าน LINE OA',
    featured: false,
    msgLimit: 1000,
    productLimit: 50,
    aiCredits: 500,
    broadcast: false,
    analytics: false,
    slipCheck: true,
    quotation: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 1290,
    description: 'ยอดนิยมสำหรับร้านค้าที่มียอดสั่งซื้อต่อเนื่องทุกวัน',
    featured: true,
    msgLimit: 5000,
    productLimit: 200,
    aiCredits: 2500,
    broadcast: true,
    analytics: true,
    slipCheck: true,
    quotation: true,
  },
  {
    id: 'business',
    name: 'Business',
    price: 2490,
    description: 'สำหรับธุรกิจที่เติบโต แชทเยอะ และมีทีมงานช่วยดูแล',
    featured: false,
    msgLimit: 15000,
    productLimit: 1000,
    aiCredits: 8000,
    broadcast: true,
    analytics: true,
    slipCheck: true,
    quotation: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 4990,
    description: 'โซลูชันองค์กร ไม่จำกัดข้อความ และซัพพอร์ตแบบ VIP',
    featured: false,
    msgLimit: -1,
    productLimit: -1,
    aiCredits: 25000,
    broadcast: true,
    analytics: true,
    slipCheck: true,
    quotation: true,
  },
]

export default function PricingSection() {
  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#091124] text-white">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="text-xs font-bold tracking-[2px] uppercase text-cyan-400 mb-2">
            ราคาแพ็กเกจ
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3">
            แผนราคาที่เหมาะกับทุกธุรกิจ
          </h2>
          <p className="text-white/60 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
            เริ่มต้นง่าย คุ้มค่า คืนทุนเร็ว ขยายได้ตามการเติบโตของร้านคุณ
          </p>
        </div>

        {/* 4 Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {pricingPlans.map((p) => (
            <div
              key={p.id}
              className={`rounded-2xl p-6 border transition-all duration-300 relative flex flex-col ${
                p.featured
                  ? 'bg-blue-950/40 border-cyan-400 lg:scale-[1.03] z-10 shadow-xl shadow-cyan-500/10'
                  : 'bg-white/[0.04] border-white/10 hover:border-white/20'
              }`}
            >
              {p.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-500 to-cyan-400 text-slate-950 px-4 py-0.5 rounded-full text-xs font-bold whitespace-nowrap shadow-md">
                  ⭐ แนะนำ
                </div>
              )}

              <div className="text-sm font-bold text-white/70 mb-2">{p.name}</div>
              
              <div className="text-3xl sm:text-4xl font-bold text-amber-400 mb-0.5 font-mono">
                ฿{p.price.toLocaleString('th-TH')}
                <span className="text-xs text-white/40 font-normal font-sans ml-1">/เดือน</span>
              </div>

              <div className="text-xs text-white/50 mb-5 pb-4 border-b border-white/[0.08] min-h-[2.5rem] leading-relaxed">
                {p.description}
              </div>

              {/* Feature Checklist */}
              <ul className="space-y-2.5 mb-6 flex-1 text-xs sm:text-sm">
                <li className="flex items-center gap-2 text-white/80">
                  <span className="text-cyan-400">💬</span>
                  <span>
                    {p.msgLimit === -1 ? 'ไม่จำกัดข้อความ' : `${p.msgLimit.toLocaleString()} ข้อความ/เดือน`}
                  </span>
                </li>
                <li className="flex items-center gap-2 text-white/80">
                  <span className="text-cyan-400">📦</span>
                  <span>
                    {p.productLimit === -1 ? 'สินค้าไม่จำกัด' : `สินค้า ${p.productLimit.toLocaleString()} รายการ`}
                  </span>
                </li>
                <li className="flex items-center gap-2 text-white/80">
                  <span className="text-cyan-400">⚡</span>
                  <span>เครดิต AI {p.aiCredits.toLocaleString('th-TH')}/เดือน</span>
                </li>
                <li className={`flex items-center gap-2 ${p.slipCheck ? 'text-white/80' : 'text-white/30'}`}>
                  {p.slipCheck ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-white/20" />}
                  <span>ตรวจสลิปอัตโนมัติ 100%</span>
                </li>
                <li className={`flex items-center gap-2 ${p.broadcast ? 'text-white/80' : 'text-white/30'}`}>
                  {p.broadcast ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-white/20" />}
                  <span>Broadcast ข้อความหาลูกค้า</span>
                </li>
                <li className={`flex items-center gap-2 ${p.analytics ? 'text-white/80' : 'text-white/30'}`}>
                  {p.analytics ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-white/20" />}
                  <span>รายงาน & Analytics ยอดขาย</span>
                </li>
                <li className={`flex items-center gap-2 ${p.quotation ? 'text-white/80' : 'text-white/30'}`}>
                  {p.quotation ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-white/20" />}
                  <span>ออกใบเสนอราคา B2B PDF</span>
                </li>
              </ul>

              <Link
                href="/login"
                className={`block text-center py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 border active:scale-95 ${
                  p.featured
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-transparent shadow-md hover:opacity-95'
                    : 'bg-white/[0.08] text-white/90 border-white/15 hover:bg-blue-600 hover:border-blue-600'
                }`}
              >
                {p.id === 'enterprise' ? 'ติดต่อสอบถาม' : 'เลือกแผนนี้'}
              </Link>
            </div>
          ))}
        </div>

        {/* Footnote */}
        <p className="text-center text-white/40 text-xs">
          * ราคา API แยกตามการใช้งานจริง (~175-500 บาท/เดือน) | สัญญาขั้นต่ำ 3 เดือน | ปรับเปลี่ยนหรือยกเลิกได้ทุกเมื่อ
        </p>
      </div>
    </section>
  )
}
