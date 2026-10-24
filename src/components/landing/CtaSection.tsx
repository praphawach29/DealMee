'use client'

import React from 'react'
import Link from 'next/link'
import { TRIAL_DAYS } from '@/lib/billing/trial'
import { DEALMEE_LINE_OA } from './data'
import { AdminAlertMock } from './ProductVisuals'

const items = [
  { num: `${TRIAL_DAYS} วัน`, label: 'ทดลองใช้งานฟรี' },
  { num: 'LINE OA', label: 'เชื่อมของร้านที่มีอยู่แล้ว' },
  { num: 'แดชบอร์ด', label: 'ตั้งค่าเองได้ ไม่ต้องเขียนโค้ด' },
]

export default function CtaSection() {
  return (
    <section className="bg-gradient-to-r from-[#0a1532] via-[#0d224d] to-[#0a1532] py-20 px-4 sm:px-6 lg:px-8 overflow-hidden text-white border-t border-white/10">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-10 items-center">
        <div className="text-center lg:text-left">
          <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-semibold text-white mb-3">
            พร้อมให้บอท AI ดูแลลูกค้าแทนคุณ?
          </h2>
          <p className="text-white/70 text-sm sm:text-base mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
            เชื่อม LINE OA ของร้านแล้วเปิดใช้ได้เลย บอทตอบลูกค้า รับออเดอร์ และตรวจสลิปให้ตลอดเวลา
          </p>

          <div className="flex gap-4 justify-center lg:justify-start flex-wrap mb-8">
            {items.map((it) => (
              <div
                key={it.label}
                className="bg-white/[0.08] border border-white/15 rounded-2xl px-5 py-4 text-center min-w-[130px]"
              >
                <div className="font-heading text-2xl font-semibold text-cyan-400 mb-0.5">{it.num}</div>
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

        <div className="flex justify-center order-first lg:order-last">
          <AdminAlertMock />
        </div>
      </div>
    </section>
  )
}
