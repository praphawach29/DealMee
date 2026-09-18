'use client'

import React from 'react'
import Image from 'next/image'

const steps = [
  {
    num: 1,
    title: 'สร้าง LINE OA',
    desc: 'สมัคร LINE Official Account และนำ Token/Webhook มาเชื่อมต่อกับระบบ',
  },
  {
    num: 2,
    title: 'ใส่ข้อมูลสินค้า & บริการ',
    desc: 'กรอกแคตตาล็อกสินค้า ราคา สต็อก และวิธีชำระเงินในแดชบอร์ดหรือ Google Sheets',
  },
  {
    num: 3,
    title: 'เชื่อมต่อระบบใน 5 นาที',
    desc: 'ตั้งค่าโปรไฟล์บอท กำหนดเสียงพูด และเปิดระบบได้ทันทีโดยไม่ต้องเขียนโค้ด',
  },
  {
    num: 4,
    title: 'พร้อมขายอัตโนมัติ 24 ชม.',
    desc: 'บอท AI พร้อมรับลูกค้า ปิดยอดขาย ตรวจสลิป และออกใบเสร็จให้คุณทุกวัน',
  },
]

const bizTypes = [
  { icon: '🖨️', name: 'ปริ้นเตอร์/IT' },
  { icon: '✨', name: 'คลินิกความงาม' },
  { icon: '💆', name: 'สปา & นวด' },
  { icon: '🏥', name: 'คลินิก/แพทย์' },
  { icon: '🍜', name: 'ร้านอาหาร/คาเฟ่' },
  { icon: '🏋️', name: 'ฟิตเนส' },
  { icon: '🚗', name: 'อู่ซ่อมรถ' },
  { icon: '🐾', name: 'คลินิกสัตว์' },
  { icon: '🏠', name: 'อสังหาริมทรัพย์' },
  { icon: '💧', name: 'ตู้น้ำดื่ม' },
  { icon: '🛒', name: 'ร้านค้าทั่วไป' },
  { icon: '📚', name: 'สถาบันกวดวิชา' },
]

export default function HowItWorksSection() {
  return (
    <section id="howitworks" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50 border-y border-slate-200/70">
      <div className="max-w-6xl mx-auto">
        {/* Top: Image + 4 Steps */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-16">
          {/* Left: How it works artwork */}
          <div className="flex justify-center">
            <Image
              src="/landing/how-it-works.png"
              alt="ขั้นตอนการทำงานของ DealMee AI Chatbot (DealMee.app)"
              width={460}
              height={460}
              className="w-full max-w-[420px] drop-shadow-lg rounded-2xl"
            />
          </div>

          {/* Right: Steps */}
          <div>
            <div className="mb-8">
              <div className="text-xs font-bold tracking-[2px] uppercase text-blue-600 mb-2">
                วิธีทำงาน
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
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

        {/* Bottom: Supported Business Types */}
        <div className="pt-8 border-t border-slate-200/80">
          <div className="text-center mb-8">
            <div className="text-xs font-bold tracking-[2px] uppercase text-blue-600 mb-2">
              รองรับ
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
              ทุกประเภทธุรกิจ
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {bizTypes.map((b) => (
              <div
                key={b.name}
                className="bg-white border border-slate-200 rounded-xl py-4 px-3 text-center transition-all duration-200 hover:border-blue-500 hover:bg-blue-50/40 hover:-translate-y-0.5 shadow-sm"
              >
                <span className="text-2xl block mb-1.5">{b.icon}</span>
                <div className="text-xs sm:text-sm font-semibold text-slate-700">
                  {b.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
