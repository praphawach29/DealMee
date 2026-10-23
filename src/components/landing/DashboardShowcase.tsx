'use client'

import React from 'react'
import Image from 'next/image'

const sheets = [
  {
    icon: '📋',
    name: 'Orders (คำสั่งซื้อ)',
    desc: 'บันทึกออเดอร์ทุกรายการ สถานะชำระเงิน และ Tracking ขนส่งอัตโนมัติ',
    color: 'border-l-blue-600',
  },
  {
    icon: '📅',
    name: 'Bookings (การจอง)',
    desc: 'ระบบนัดหมายบริการ เช็คคิวว่างแบบ Real-time พร้อมแจ้งเตือนล่วงหน้า',
    color: 'border-l-cyan-500',
  },
  {
    icon: '👥',
    name: 'Customers (ลูกค้า)',
    desc: 'ชื่อ เบอร์โทร ที่อยู่จัดส่ง และประวัติการสั่งซื้อของลูกค้าทุกคน',
    color: 'border-l-emerald-500',
  },
  {
    icon: '🛍️',
    name: 'Products (สินค้า)',
    desc: 'แคตตาล็อกสินค้า ราคา รูปภาพ และจำนวนสต็อกคงเหลือ',
    color: 'border-l-amber-500',
  },
  {
    icon: '📣',
    name: 'Promotions (บรอดแคสต์)',
    desc: 'ส่งโปรโมชั่น ข่าวสาร และข้อความแจ้งเตือนหาลูกค้าผ่าน LINE OA',
    color: 'border-l-purple-600',
  },
  {
    icon: '📊',
    name: 'Analytics (รายงาน)',
    desc: 'สรุปยอดขาย ออเดอร์ประจำวัน และ Log บทสนทนาทั้งหมดตรวจสอบได้',
    color: 'border-l-indigo-600',
  },
]

export default function DashboardShowcase() {
  return (
    <section id="dashboard" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50 border-y border-slate-200/70">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: Text & 6 Feature Cards */}
          <div>
            <div className="mb-8">
              <div className="text-xs font-bold tracking-[2px] uppercase text-blue-600 mb-2">
                แดชบอร์ดจัดการร้าน
              </div>
              <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-slate-900 leading-tight mb-3">
                จัดการทุกอย่างง่าย ครบในที่เดียว
              </h2>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-lg">
                ไม่ต้องเรียนรู้ระบบใหม่ที่ซับซ้อน — บอท AI ซิงก์ข้อมูลออเดอร์ ลูกค้า สินค้า และการเงินลงแดชบอร์ดแบบ Real-time
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sheets.map((s) => (
                <div
                  key={s.name}
                  className={`bg-white rounded-xl p-4 border border-slate-200/90 border-l-4 shadow-sm hover:shadow-md transition-all duration-200 ${s.color}`}
                >
                  <div className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                    <span>{s.icon}</span>
                    <span>{s.name}</span>
                  </div>
                  <div className="text-xs text-slate-500 leading-relaxed">
                    {s.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Dashboard Preview Image */}
          <div className="flex justify-center">
            <div className="relative">
              <Image
                src="/landing/dashboard-preview.png"
                alt="แดชบอร์ดจัดการออเดอร์และข้อมูลลูกค้า DealMee.app"
                width={560}
                height={380}
                className="w-full max-w-[520px] drop-shadow-xl rounded-xl border border-slate-200/80 bg-white"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
