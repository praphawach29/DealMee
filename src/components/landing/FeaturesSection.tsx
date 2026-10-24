'use client'

import React from 'react'
import {
  Bell,
  Brain,
  CalendarCheck,
  FileText,
  Gem,
  ImageIcon,
  LayoutDashboard,
  MapPin,
  MessageCircle,
  Receipt,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'

const features = [
  {
    icon: MessageCircle,
    title: 'ตอบคำถาม 24 ชม.',
    desc: 'บอทตอบเรื่องสินค้า ราคา สต็อก และบริการใน LINE OA ของร้าน ตอบทันทีทุกเวลา ไม่มีวันหยุด',
  },
  {
    icon: Receipt,
    title: 'รับออเดอร์ในแชท',
    desc: 'ถามชื่อ เบอร์ ที่อยู่ และรายการสินค้า แล้วบันทึกออเดอร์เลขที่ ORD- พร้อมยอดที่ระบบคำนวณเอง',
  },
  {
    icon: ShieldCheck,
    title: 'ตรวจสลิปกับข้อมูลธนาคาร',
    desc: 'ลูกค้าส่งรูปสลิปมาในแชท ระบบตรวจยอด ผู้รับ และสลิปซ้ำ ผ่านแล้วเปลี่ยนสถานะเป็นชำระแล้ว ถ้าไม่ผ่านส่งให้แอดมินดูต่อ',
  },
  {
    icon: FileText,
    title: 'ออกใบเสนอราคา',
    desc: 'สร้างใบเสนอราคา คิด VAT 7% แล้วส่งเป็นการ์ดในแชทพร้อมลิงก์เปิดเอกสารและดาวน์โหลด PDF',
  },
  {
    icon: MapPin,
    title: 'คิดค่าส่งตามโซน',
    desc: 'ใช้เรตที่ร้านตั้งไว้สำหรับกทม.และปริมณฑล ต่างจังหวัด หรือพื้นที่ห่างไกล และส่งฟรีเมื่อยอดถึงเกณฑ์ของร้าน',
  },
  {
    icon: CalendarCheck,
    title: 'จองคิว',
    desc: 'เช็คเวลาว่าง จอง เลื่อน ยกเลิก แล้วเตือนก่อนถึงเวลานัด เปิดใช้ในแพ็กเกจที่มีระบบจอง',
  },
  {
    icon: Brain,
    title: 'จำลูกค้าคนเดิม',
    desc: 'เก็บชื่อ บันทึก แท็ก จำนวนออเดอร์ และยอดซื้อสะสมของแชทนั้น แล้วนำมาใช้ตอนตอบครั้งถัดไป',
  },
  {
    icon: ImageIcon,
    title: 'ส่งการ์ดสินค้าในแชท',
    desc: 'ค้นสินค้าแล้วส่งการ์ดพร้อมรูป ราคา และสต็อกจากแคตตาล็อกของร้าน รูปที่ลูกค้าส่งมาใช้ตรวจสลิป',
  },
  {
    icon: Bell,
    title: 'แจ้งแอดมินทาง LINE',
    desc: 'ออเดอร์ใหม่ สลิปที่ตรวจผ่านหรือตรวจไม่ผ่าน และลูกค้าที่ขอคุยกับคน ส่งเข้า LINE ของแอดมิน',
  },
  {
    icon: LayoutDashboard,
    title: 'แดชบอร์ดและผู้ช่วย AI',
    desc: 'ดูยอดขาย ออเดอร์ สินค้าขายดี และสินค้าใกล้หมดจากข้อมูลร้าน และถามผู้ช่วย AI เรื่องร้านได้',
  },
  {
    icon: RefreshCw,
    title: 'สลับ AI ให้เองเมื่อตัวหลักใช้ไม่ได้',
    desc: 'แพ็กเกจทั่วไปใช้ Gemini ก่อน ถ้าเรียกไม่สำเร็จจะลอง OpenAI แล้วตามด้วย Claude เมื่อระบบมีคีย์นั้น แพ็กเกจ BYOK ใช้คีย์ของร้านเอง',
  },
  {
    icon: Gem,
    title: 'สินค้าราคาสูงให้คนปิด',
    desc: 'สินค้าที่ราคาถึงเพดานที่ร้านตั้ง บอทตอบข้อมูลได้ แล้วเก็บชื่อและเบอร์ส่งให้แอดมินปิดการขาย',
  },
]

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
            ตั้งแต่ตอบแชท รับออเดอร์ ตรวจสลิป ออกเอกสาร ไปจนถึงส่งเลขพัสดุที่ร้านใส่ให้ลูกค้า
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.title}
                className="bg-white border border-slate-200/90 rounded-[14px] p-6 shadow-card"
              >
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-[14px] bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="text-base font-bold text-slate-900 mb-1.5">{feature.title}</div>
                <div className="text-sm text-slate-600 leading-relaxed">{feature.desc}</div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
