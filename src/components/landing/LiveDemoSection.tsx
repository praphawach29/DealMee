'use client'

import React from 'react'
import { Check } from 'lucide-react'
import { TRIAL_DAYS } from '@/lib/billing/trial'
import { DEMO_SHOPS } from '@/lib/demo/shops'
import { DemoButton, SignupButton, useLandingActions } from './demo/LandingActions'

/**
 * #try: the two ways in, side by side, so a visitor knows which button signs them up and
 * which one doesn't. The demo itself opens as a chat window (demo/LandingActions.tsx).
 */
export default function LiveDemoSection() {
  const { isLoggedIn, openDemo } = useLandingActions()

  return (
    <section id="try" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50 border-y border-slate-200/70">
      <div className="max-w-5xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="text-xs font-bold tracking-[2px] uppercase text-blue-600 mb-2">เริ่มจากตรงไหนดี</div>
          <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-semibold text-slate-900 leading-tight">
            ลองคุยกับบอทก่อน <span className="text-primary">หรือสมัครใช้กับร้านคุณ</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Demo */}
          <div className="rounded-2xl border-2 border-[#06C755]/40 bg-white p-6 shadow-card flex flex-col">
            <div className="inline-flex self-start rounded-full bg-[#06C755]/10 px-3 py-1 text-xs font-bold text-[#05a347]">
              ไม่ต้องสมัคร · ไม่ต้องกรอกอะไร
            </div>
            <h3 className="mt-3 text-xl font-bold text-slate-900">ลองคุยกับบอทตัวอย่าง</h3>
            <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
              เปิดหน้าต่างแชท แล้วพิมพ์ถามเหมือนเป็นลูกค้า บอทตอบด้วยระบบเดียวกับที่ใช้ใน LINE OA จริง
            </p>
            <div className="mt-4 space-y-2">
              {DEMO_SHOPS.map((s) => (
                <button
                  key={s.persona}
                  type="button"
                  onClick={() => openDemo(s.persona)}
                  className="w-full text-left flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 hover:border-[#06C755] hover:bg-[#06C755]/5 transition-colors"
                >
                  <span className="text-xl">{s.emoji}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900">{s.label}</span>
                    <span className="block text-xs text-slate-500 truncate">{s.shows}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-auto pt-5">
              <DemoButton size="lg" className="w-full" />
            </div>
          </div>

          {/* Real trial */}
          <div className="rounded-2xl border-2 border-[#2F6BFF]/40 bg-white p-6 shadow-card flex flex-col">
            <div className="inline-flex self-start rounded-full bg-[#2F6BFF]/10 px-3 py-1 text-xs font-bold text-[#2F6BFF]">
              {isLoggedIn ? 'คุณเข้าสู่ระบบอยู่แล้ว' : `ฟรี ${TRIAL_DAYS} วัน · ไม่ต้องผูกบัตร`}
            </div>
            <h3 className="mt-3 text-xl font-bold text-slate-900">
              {isLoggedIn ? 'กลับไปที่ร้านของคุณ' : 'ทดลองใช้กับร้านของคุณ'}
            </h3>
            <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
              สมัครแล้วได้ร้านของตัวเอง ใส่สินค้าและข้อมูลร้าน ทดสอบในหน้าแชทจำลอง แล้วเชื่อม LINE OA เมื่อพร้อม
            </p>
            <ul className="mt-4 space-y-2.5">
              {[
                'บอทตอบจากสินค้าและข้อมูลของร้านคุณเอง',
                'ออเดอร์ QR พร้อมเพย์ และตรวจสลิปใช้ได้จริง',
                'แจ้งเตือนเข้า LINE ของแอดมิน',
                'หมดช่วงทดลอง ไม่ตัดเงินอัตโนมัติ',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm text-slate-700">
                  <Check className="h-4 w-4 shrink-0 mt-0.5 text-[#2F6BFF]" />
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-5">
              <SignupButton size="lg" className="w-full" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
