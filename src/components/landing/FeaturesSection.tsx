'use client'

import React from 'react'

interface Feature {
  icon: string
  title: string
  desc: string
  color: 'blue' | 'cyan' | 'emerald' | 'amber' | 'purple' | 'indigo'
}

const features: Feature[] = [
  {
    icon: '🤖',
    title: 'ตอบคำถาม 24/7',
    desc: 'บอทตอบเรื่องสินค้า ราคา สต็อก และบริการตลอดเวลา ปิดการขายได้ไม่ต้องรอพนักงาน',
    color: 'blue',
  },
  {
    icon: '📋',
    title: 'รับออเดอร์ครบในรอบเดียว',
    desc: 'ถามชื่อ เบอร์ ที่อยู่ สินค้า วิธีชำระเงิน ครบถ้วนพร้อมออก Order ID อัตโนมัติ',
    color: 'cyan',
  },
  {
    icon: '💳',
    title: 'ตรวจสลิปกับธนาคารอัตโนมัติ',
    desc: 'สแกน QR ตรวจสอบชื่อบัญชี ยอดเงิน วันเวลา และตรวจจับสลิปปลอมทันที',
    color: 'emerald',
  },
  {
    icon: '🧾',
    title: 'ออกใบเสนอราคา B2B PDF',
    desc: 'ลูกค้าขอราคา บอทรวบรวมข้อมูลและออกเอกสารใบเสนอราคาพร้อมลิงก์ PDF ให้ทันที',
    color: 'amber',
  },
  {
    icon: '📍',
    title: 'คำนวณค่าส่งตามพื้นที่จริง',
    desc: 'คิดค่าจัดส่งตามระยะทาง จังหวัด พื้นที่ห่างไกล หรือน้ำหนักสินค้าอัตโนมัติ',
    color: 'purple',
  },
  {
    icon: '📅',
    title: 'ระบบจองคิวนัดหมาย',
    desc: 'รับจองผ่าน LINE เช็คคิวว่างแบบ Real-time พร้อมส่งข้อความแจ้งเตือนก่อนวันนัด',
    color: 'indigo',
  },
  {
    icon: '🧠',
    title: 'จดจำข้อมูลลูกค้าเก่า',
    desc: 'สั่งซื้อรอบสอง บอทดึงที่อยู่เดิมมาให้ยืนยันทันที ลูกค้าไม่ต้องพิมพ์ใหม่ สะดวกสบาย',
    color: 'blue',
  },
  {
    icon: '📸',
    title: 'ส่งรูปสินค้า + AI Vision',
    desc: 'ส่งรูปสินค้าอัตโนมัติ และอ่านภาพสินค้าที่ลูกค้าส่งมาเพื่อค้นหาแคตตาล็อกที่ตรงกัน',
    color: 'cyan',
  },
  {
    icon: '🔔',
    title: 'แจ้งเตือนแอดมินทาง LINE',
    desc: 'ออเดอร์ใหม่ ลูกค้าจ่ายเงิน สลิปผิดปกติ หรือลูกค้าขอคุยกับคน แจ้งเข้า LINE ส่วนตัวของแอดมินทันที พร้อมชื่อและเบอร์ลูกค้า',
    color: 'emerald',
  },
  {
    icon: '📊',
    title: 'รายงานยอดขาย & Analytics',
    desc: 'ส่งสรุปยอดขาย ออเดอร์ สินค้าขายดี ให้เจ้าของร้าน พร้อมแดชบอร์ดดูได้แบบ Real-time',
    color: 'amber',
  },
  {
    icon: '🌐',
    title: 'AI สำรองอัตโนมัติ',
    desc: 'ใช้ Google Gemini เป็นหลัก ถ้าระบบหลักขัดข้องจะสลับไปใช้ AI สำรองให้เอง ร้านไม่ต้องตั้งค่าอะไร',
    color: 'purple',
  },
  {
    icon: '💎',
    title: 'สินค้าราคาสูงส่งต่อคนปิด',
    desc: 'สินค้าที่ราคาถึงเพดานที่ร้านตั้ง บอทตอบข้อมูลให้ แล้วเก็บชื่อและเบอร์ลูกค้าส่งต่อให้แอดมินปิดการขายเอง',
    color: 'indigo',
  },
]

const colorMap = {
  blue: 'border-t-blue-600 hover:border-blue-600 hover:shadow-blue-500/10',
  cyan: 'border-t-cyan-500 hover:border-cyan-500 hover:shadow-cyan-500/10',
  emerald: 'border-t-emerald-500 hover:border-emerald-500 hover:shadow-emerald-500/10',
  amber: 'border-t-amber-500 hover:border-amber-500 hover:shadow-amber-500/10',
  purple: 'border-t-purple-600 hover:border-purple-600 hover:shadow-purple-500/10',
  indigo: 'border-t-indigo-600 hover:border-indigo-600 hover:shadow-indigo-500/10',
}

export default function FeaturesSection() {
  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <div className="text-xs font-bold tracking-[2px] uppercase text-blue-600 mb-2">
            ฟีเจอร์หลัก
          </div>
          <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-semibold text-slate-900 leading-tight mb-3">
            ทุกอย่างที่ธุรกิจคุณต้องการ
          </h2>
          <p className="text-slate-600 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            ระบบครบวงจรที่จัดการตั้งแต่ตอบแชท รับออเดอร์ ตรวจสลิป ออกเอกสาร ไปจนถึงแจ้งพัสดุ
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className={`bg-white border border-slate-200/90 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg border-t-[3px] shadow-sm ${colorMap[f.color]}`}
            >
              <span className="text-3xl mb-3 block">{f.icon}</span>
              <div className="text-base font-bold text-slate-900 mb-1.5">{f.title}</div>
              <div className="text-sm text-slate-600 leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
