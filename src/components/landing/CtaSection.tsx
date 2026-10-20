'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { TRIAL_DAYS } from '@/lib/billing/trial'
import { DEALMEE_LINE_OA } from './data'

const items = [
  { num: `${TRIAL_DAYS} วัน`, label: 'ทดลองใช้งานฟรี' },
  { num: '5 นาที', label: 'ติดตั้งเชื่อมต่อเสร็จ' },
  { num: '0 บาท', label: 'ไม่มีค่าธรรมเนียมแอบแฝง' },
]

export default function CtaSection() {
  return (
    <section className="bg-gradient-to-r from-[#0a1532] via-[#0d224d] to-[#0a1532] py-20 px-4 sm:px-6 lg:px-8 overflow-hidden text-white border-t border-white/10">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-10 items-center">
        <div className="text-center lg:text-left">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3">
            พร้อมให้บอท AI ดูแลลูกค้าแทนคุณ?
          </h2>
          <p className="text-white/70 text-sm sm:text-base mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
            เริ่มต้นง่าย ติดตั้งเร็ว พร้อมตอบลูกค้าและสร้างยอดขายอัตโนมัติได้ตลอด 24 ชั่วโมง
          </p>

          <div className="flex gap-4 justify-center lg:justify-start flex-wrap mb-8">
            {items.map((it) => (
              <div
                key={it.label}
                className="bg-white/[0.08] border border-white/15 rounded-2xl px-5 py-4 text-center min-w-[130px]"
              >
                <div className="text-2xl font-bold text-cyan-400 mb-0.5">{it.num}</div>
                <div className="text-xs text-white/60">{it.label}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-3.5 justify-center lg:justify-start flex-wrap">
            <Link
              href="/login"
              className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-7 py-3 rounded-full font-bold text-sm sm:text-base inline-flex items-center gap-2 hover:opacity-95 shadow-lg shadow-cyan-500/25 transition-all duration-200 active:scale-95"
            >
              🚀 ทดลองใช้ฟรี {TRIAL_DAYS} วัน
            </Link>
            <a
              href={DEALMEE_LINE_OA.url}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-white/30 text-white px-7 py-3 rounded-full font-semibold text-sm sm:text-base hover:bg-white/10 transition-all duration-200 active:scale-95"
            >
              💬 แชทปรึกษาทีมงาน
            </a>
          </div>
        </div>

        {/* Robot Image */}
        <div className="flex justify-center order-first lg:order-last">
          <div className="relative">
            <div className="absolute inset-0 bg-cyan-500/20 blur-2xl rounded-full scale-90" />
            <Image
              src="/landing/cta-robot.png"
              alt="DealMee AI Robot Assistant"
              width={260}
              height={260}
              className="relative w-36 sm:w-48 lg:w-60 drop-shadow-[0_16px_40px_rgba(6,182,212,0.3)] animate-float-slow"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
