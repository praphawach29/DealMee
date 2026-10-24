'use client'

import React from 'react'
import { HeroChatMock } from './ProductVisuals'
import { TEMPLATES } from '@/app/onboarding/templates'

const stats = [
  { num: '24 ชม.', label: 'บอทตอบแชท' },
  { num: 'LINE OA', label: 'ใช้ของร้านที่มีอยู่แล้ว' },
  { num: String(TEMPLATES.length), label: 'เทมเพลตตอนสมัคร' },
  { num: 'ตรวจสลิป', label: 'กับข้อมูลธนาคาร' },
]

export default function HeroSection() {
  return (
    <section className="relative bg-hero-navy min-h-screen pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden flex items-center">
      {/* Ambient background glow orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[350px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-[400px] h-[300px] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[350px] h-[250px] bg-indigo-500/10 rounded-full blur-[90px] pointer-events-none" />

      {/* Subtle grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left Column: Headline & Value Proposition */}
        <div className="text-center lg:text-left space-y-6">
          {/* Top Pill Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-xs font-semibold tracking-wide">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>🤖 AI Chatbot สำหรับธุรกิจไทย บน LINE OA</span>
          </div>

          {/* Main Headline */}
          <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-semibold text-white leading-[1.2] tracking-tight">
            พนักงานขาย AI
            <br />
            <span className="text-gradient-cyan">
              ที่ไม่เคยหยุดพัก ตลอด 24 ชม.
            </span>
          </h1>

          {/* Sub-headline: Balanced, natural Thai phrasing */}
          <p className="text-white/70 text-sm sm:text-base max-w-xl mx-auto lg:mx-0 leading-relaxed font-normal">
            เชื่อมต่อ LINE OA ของร้านคุณ ให้บอท AI ตอบลูกค้า รับออเดอร์
            คำนวณค่าส่งตามพื้นที่จริง ออกใบเสนอราคา B2B และตรวจสลิปโอนเงินอัตโนมัติ
            ช่วยปิดการขายได้ตลอดเวลา ไม่ต้องคอยเฝ้าหน้าจอ
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-1">
            <a
              href="#pricing"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-sm sm:text-base px-7 py-3 rounded-full shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/35 transition-all duration-200 active:scale-95"
            >
              <span>🚀 เริ่มต้นใช้งานฟรี</span>
            </a>
            <a
              href="#demo"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-white/30 hover:border-white/60 text-white font-semibold text-sm sm:text-base px-7 py-3 rounded-full hover:bg-white/[0.08] transition-all duration-200 active:scale-95"
            >
              <span>ดูตัวอย่างการทำงาน</span>
            </a>
          </div>

          {/* Stats Bar */}
          <div className="pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center lg:text-left">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="font-heading text-2xl sm:text-3xl font-semibold text-cyan-400">{s.num}</div>
                <div className="text-xs text-white/50 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center items-center order-first lg:order-last">
          <HeroChatMock />
        </div>
      </div>
    </section>
  )
}
