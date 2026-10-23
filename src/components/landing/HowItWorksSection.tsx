'use client'

import React from 'react'
import { TEMPLATES } from '@/app/onboarding/templates'
import { SetupFlowMock } from './ProductVisuals'

const steps = [
  {
    num: 1,
    title: 'สร้าง LINE OA',
    desc: 'สมัคร LINE Official Account และนำ Token/Webhook มาเชื่อมต่อกับระบบ',
  },
  {
    num: 2,
    title: 'ใส่ข้อมูลสินค้า & บริการ',
    desc: 'กรอกแคตตาล็อกสินค้า ราคา สต็อก และวิธีชำระเงินในแดชบอร์ด พร้อมคลังความรู้ของร้าน',
  },
  {
    num: 3,
    title: 'ตั้งค่าบอทแล้วเปิดใช้',
    desc: 'ตั้งชื่อบอท เลือกน้ำเสียงการตอบ แล้วเปิดใช้ได้โดยไม่ต้องเขียนโค้ด',
  },
  {
    num: 4,
    title: 'พร้อมขายอัตโนมัติ 24 ชม.',
    desc: 'บอท AI พร้อมรับลูกค้า ปิดยอดขาย ตรวจสลิป และออกใบเสนอราคาให้คุณทุกวัน',
  },
]


export default function HowItWorksSection() {
  return (
    <section id="howitworks" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50 border-y border-slate-200/70">
      <div className="max-w-6xl mx-auto">
        {/* Top: Image + 4 Steps */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-16">
          <div className="flex justify-center">
            <SetupFlowMock />
          </div>

          {/* Right: Steps */}
          <div>
            <div className="mb-8">
              <div className="text-xs font-bold tracking-[2px] uppercase text-blue-600 mb-2">
                วิธีทำงาน
              </div>
              <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-slate-900 mb-2">
                ง่าย ไม่ซับซ้อน
              </h2>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                ตั้งค่าครั้งเดียว บอททำงานตอบลูกค้าและรับออเดอร์ให้ทุกวัน
              </p>
            </div>

            <div className="flex flex-col gap-5">
              {steps.map((s) => (
                <div key={s.num} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm shadow-blue-500/20">
                    {s.num}
                  </div>
                  <div>
                    <div className="text-base font-bold text-slate-900 mb-0.5">
                      {s.title}
                    </div>
                    <div className="text-sm text-slate-600 leading-relaxed">
                      {s.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-200/80">
          <div className="text-center mb-8">
            <div className="text-xs font-bold tracking-[2px] uppercase text-blue-600 mb-2">
              ตอนสมัคร
            </div>
            <h3 className="font-heading text-xl sm:text-2xl font-semibold text-slate-900">
              เทมเพลต {TEMPLATES.length} แบบ
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              เลือกแบบร้านตอนเริ่มใช้งาน ระบบจะเปิดหน้าสินค้าหรือหน้าจองให้ตรงกับประเภทนั้น
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3">
            {TEMPLATES.map((template) => (
              <div
                key={template.id}
                className="bg-white border border-slate-200 rounded-[14px] py-4 px-3 text-center shadow-card"
              >
                <span className="text-2xl block mb-1.5" aria-hidden="true">{template.emoji}</span>
                <div className="text-xs sm:text-sm font-semibold text-slate-700">
                  {template.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
