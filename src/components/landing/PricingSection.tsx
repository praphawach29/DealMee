'use client'

import React from 'react'
import Link from 'next/link'
import { Check, X, Wallet } from 'lucide-react'
import { packagesData, addonPacks, freePlan } from './data'

const formatTHB = (n: number) => n.toLocaleString('th-TH')
const messagePacks = addonPacks.filter((a) => a.kind === 'messages')
const slipPacks = addonPacks.filter((a) => a.kind === 'slips')

export default function PricingSection() {
  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#091124] text-white">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="text-xs font-bold tracking-[2px] uppercase text-cyan-400 mb-2">
            ราคาแพ็กเกจ
          </div>
          <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-semibold text-white mb-3">
            แผนราคาที่เหมาะกับทุกธุรกิจ
          </h2>
          <p className="text-white/60 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
            เริ่มต้นง่าย คุ้มค่า คืนทุนเร็ว ขยายได้ตามการเติบโตของร้านคุณ
          </p>
          <div className="mt-5 inline-flex items-start sm:items-center gap-2 text-left bg-white/[0.06] border border-white/10 rounded-2xl sm:rounded-full px-4 py-2 text-xs sm:text-sm text-white/80">
            <Wallet className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5 sm:mt-0" />
            <span>เติมเงินเข้ากระเป๋า (Wallet) ผ่าน PromptPay แล้วซื้อแพ็กเกจจากยอดคงเหลือ ต่ออายุอัตโนมัติทุก 30 วัน</span>
          </div>
        </div>

        {/* 4 Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {packagesData.map((p) => (
            <div
              key={p.key}
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
                ฿{formatTHB(p.price)}
                <span className="text-xs text-white/40 font-normal font-sans ml-1">/30 วัน</span>
              </div>

              <div className="text-xs text-white/50 mb-5 pb-4 border-b border-white/[0.08] min-h-[2.5rem] leading-relaxed">
                {p.description}
              </div>

              {/* Feature Checklist */}
              <ul className="space-y-2.5 mb-6 flex-1 text-xs sm:text-sm">
                <li className="flex items-center gap-2 text-white/80">
                  <span className="text-cyan-400">💬</span>
                  <span>
                    {p.msgLimit === -1
                      ? 'ข้อความไม่จำกัด (ใช้ Key ของร้าน)'
                      : `${formatTHB(p.msgLimit)} ข้อความ/เดือน`}
                  </span>
                </li>
                <li className="flex items-center gap-2 text-white/80">
                  <span className="text-cyan-400">🧾</span>
                  <span>ตรวจสลิปอัตโนมัติ {formatTHB(p.slipLimit)} ครั้ง/เดือน</span>
                </li>
                <PlanFeature on={p.features.order_taking} label="รับออเดอร์ & PromptPay QR" />
                <PlanFeature on={p.features.quotation_b2b} label="ออกใบเสนอราคา B2B PDF" />
                <PlanFeature on={p.features.booking_system} label="ระบบจองคิว & แจ้งเตือนลูกค้า" />
                {p.features.own_api_key ? (
                  <PlanFeature on label="ใช้ Gemini API Key ของร้าน" />
                ) : (
                  <PlanFeature on={p.features.priority_support} label="ซัพพอร์ตแบบเร่งด่วน" />
                )}
              </ul>

              <Link
                href="/login"
                className={`block text-center py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 border active:scale-95 ${
                  p.featured
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-transparent shadow-md hover:opacity-95'
                    : 'bg-white/[0.08] text-white/90 border-white/15 hover:bg-blue-600 hover:border-blue-600'
                }`}
              >
                เลือกแผนนี้
              </Link>
            </div>
          ))}
        </div>

        {/* Add-on packs */}
        <div className="max-w-3xl mx-auto rounded-2xl bg-white/[0.04] border border-white/10 p-4 sm:p-5 mb-6 text-xs sm:text-sm text-white/70 leading-relaxed">
          <div className="font-bold text-white mb-1.5">➕ แพ็กเสริม (ใช้ได้ 90 วัน เมื่อโควตาประจำเดือนหมด)</div>
          <div>
            ข้อความ AI:{' '}
            {messagePacks.map((a) => `${formatTHB(a.quantity)} ข้อความ ฿${formatTHB(a.price)}`).join(' · ')}
          </div>
          <div>
            ตรวจสลิป:{' '}
            {slipPacks.map((a) => `${formatTHB(a.quantity)} ครั้ง ฿${formatTHB(a.price)}`).join(' · ')}
          </div>
        </div>

        {/* Footnote */}
        <p className="text-center text-white/40 text-xs leading-relaxed">
          * เริ่มต้นฟรี {formatTHB(freePlan.msgLimit)} ข้อความ AI/เดือน (ไม่มีตรวจสลิปอัตโนมัติ) | ชำระด้วยการเติมเงิน PromptPay เข้ากระเป๋า | เปลี่ยนแพ็กเกจได้ทุกเมื่อ คืนเครดิตวันที่เหลือ
        </p>
      </div>
    </section>
  )
}

function PlanFeature({ on, label }: { on: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-2 ${on ? 'text-white/80' : 'text-white/30'}`}>
      {on ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-white/20" />}
      <span>{label}</span>
    </li>
  )
}
