'use client'

import React from 'react'
import { DashboardMock } from './ProductVisuals'

const modules = [
  {
    name: 'ออเดอร์',
    desc: 'บอทบันทึกเลขที่ออเดอร์ รายการสินค้า สถานะชำระเงิน และที่อยู่ ร้านใส่เลขพัสดุแล้วบอทส่งให้ลูกค้าในแชท',
  },
  {
    name: 'การจอง',
    desc: 'เช็คเวลาว่าง จอง เลื่อน และยกเลิกคิว แล้วเตือนลูกค้าก่อนถึงเวลานัด ใช้ได้เมื่อเปิดระบบจอง',
  },
  {
    name: 'สินค้า',
    desc: 'แคตตาล็อก ราคา รูป และสต็อก บอทค้นจากรายการนี้แล้วส่งเป็นการ์ดในแชท',
  },
  {
    name: 'กล่องข้อความ',
    desc: 'ดูแชทจาก LINE OA ทุกห้องในที่เดียว พร้อมโปรไฟล์ลูกค้า บันทึก แท็ก และยอดซื้อสะสม แอดมินพิมพ์ตอบเองได้',
  },
  {
    name: 'บรอดแคสต์',
    desc: 'ส่งข้อความหาลูกค้าใน LINE OA ของร้านจากหน้าบรอดแคสต์',
  },
  {
    name: 'คลังความรู้',
    desc: 'ใส่คำถามที่พบบ่อยหรือไฟล์ของร้าน บอทค้นจากคลังนี้ตอนตอบลูกค้า',
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
                ออเดอร์ สินค้า การจอง และแชทอยู่ในแดชบอร์ดของร้าน เปิดดูได้จากหน้านี้เลย
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {modules.map((item) => (
                <div
                  key={item.name}
                  className="bg-white rounded-[14px] p-4 border border-slate-200/90 border-l-4 border-l-primary shadow-card"
                >
                  <div className="text-sm font-bold text-slate-900 mb-1">
                    {item.name}
                  </div>
                  <div className="text-xs text-slate-500 leading-relaxed">
                    {item.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center">
            <DashboardMock />
          </div>
        </div>
      </div>
    </section>
  )
}
