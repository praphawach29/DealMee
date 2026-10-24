'use client'

import React from 'react'
import {
  ShoppingBag,
  ShieldCheck,
  CalendarCheck,
  BrainCircuit,
  FileCheck2,
  ClockAlert,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'

export default function FeaturesBento() {
  return (
    <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-white border-t border-slate-200/70">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-800 text-sm font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-cyan-600" />
            <span>ความสามารถที่ใช้งานได้จริงวันนี้</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight">
            ครบทุกมิติงานขายและการบริการบน LINE OA
          </h2>
          <p className="text-slate-600 text-lg sm:text-xl leading-relaxed">
            ระบบอัจฉริยะที่ออกแบบมาเพื่อร้านค้าไทยโดยเฉพาะ ปิดการขายได้รวดเร็ว
            ดูแลลูกค้าอย่างแม่นยำ ช่วยลดภาระงานของทีมแอดมินได้อย่างแท้จริง
          </p>
        </div>

        {/* Bento Grid Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Large Span - Order Taking & Shipping */}
          <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 via-[#0a1428] to-slate-900 text-white rounded-3xl p-8 sm:p-10 border border-slate-800 shadow-xl relative overflow-hidden flex flex-col justify-between group hover:border-cyan-500/40 transition-all duration-300">
            <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="space-y-4 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <ShoppingBag className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <span className="text-cyan-400 text-sm font-bold uppercase tracking-wider">
                  Core Sales Engine
                </span>
                <h3 className="font-heading text-2xl sm:text-3xl font-semibold text-white">
                  ปิดการขาย รับออเดอร์ & คำนวณค่าส่งอัตโนมัติ
                </h3>
              </div>
              <p className="text-slate-200 text-base sm:text-lg leading-relaxed max-w-2xl">
                บอทจะสอบถามชื่อ เบอร์โทรศัพท์ ที่อยู่จัดส่ง และสรุปคำสั่งซื้อให้อัตโนมัติ พร้อมระบบแยกโซนคำนวณค่าจัดส่งตามพื้นที่จริง (กรุงเทพฯ, ปริมณฑล, ต่างจังหวัด หรือพื้นที่ห่างไกล) และสร้างรูปภาพ PromptPay QR ระบุยอดเงินตรงตามออเดอร์ทันที
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
              <div className="bg-slate-800/70 p-3.5 rounded-xl border border-slate-700/60">
                <div className="text-xs sm:text-sm text-slate-400">เลขที่ออเดอร์</div>
                <div className="text-base font-bold text-cyan-300 font-mono mt-0.5">ORD-2026-XXXX</div>
              </div>
              <div className="bg-slate-800/70 p-3.5 rounded-xl border border-slate-700/60">
                <div className="text-xs sm:text-sm text-slate-400">ค่าส่งตามโซนจริง</div>
                <div className="text-base font-bold text-emerald-400 mt-0.5">กทม. / ตจว. / เกาะ</div>
              </div>
              <div className="bg-slate-800/70 p-3.5 rounded-xl border border-slate-700/60">
                <div className="text-xs sm:text-sm text-slate-400">PromptPay QR</div>
                <div className="text-base font-bold text-amber-300 mt-0.5">ระบุยอดเงินทันที</div>
              </div>
            </div>
          </div>

          {/* Card 2: EasySlip Verification */}
          <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-blue-300 transition-all duration-300">
            <div className="space-y-4">
              <div className="w-13 h-13 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600 p-3">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <span className="text-emerald-700 text-xs sm:text-sm font-bold uppercase tracking-wider">
                  Bank-Grade Verification
                </span>
                <h3 className="font-heading text-xl sm:text-2xl font-semibold text-slate-900">
                  ตรวจสลิปโอนเงินอัตโนมัติ
                </h3>
              </div>
              <p className="text-slate-600 text-base leading-relaxed">
                เมื่อลูกค้าส่งรูปสลิปเข้ามาใน LINE ระบบจะตรวจสอบตรงกับฐานข้อมูลธนาคารทันที ยืนยันยอดเงิน วันเวลา และบัญชีผู้รับ ป้องกันสลิปปลอม สลิปแต่งรูป และสลิปที่ใช้ซ้ำ สลิปที่ตรวจไม่ผ่านจะส่งให้แอดมินดูต่อ
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="w-4.5 h-4.5 shrink-0" />
              <span>อัปเดตสถานะ &ldquo;ชำระแล้ว&rdquo; ตัดสต็อกทันที</span>
            </div>
          </div>

          {/* Card 3: B2B Quotation Generator */}
          <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-blue-300 transition-all duration-300">
            <div className="space-y-4">
              <div className="w-13 h-13 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 p-3">
                <FileCheck2 className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <span className="text-amber-700 text-xs sm:text-sm font-bold uppercase tracking-wider">
                  Enterprise & B2B
                </span>
                <h3 className="font-heading text-xl sm:text-2xl font-semibold text-slate-900">
                  ออกใบเสนอราคา B2B (PDF)
                </h3>
              </div>
              <p className="text-slate-600 text-base leading-relaxed">
                สร้างใบเสนอราคาพร้อมเลขที่เอกสารทางการ คำนวณ VAT 7% ส่งเป็นการ์ด LINE Flex ในแชท พร้อมปุ่มกดเปิดดูเอกสารฉบับเต็มและดาวน์โหลดไฟล์ PDF ได้ทันที
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 flex items-center gap-2 text-sm font-semibold text-amber-800">
              <CheckCircle2 className="w-4.5 h-4.5 shrink-0" />
              <span>ยืนราคา 30 วัน • รองรับงานลูกค้านิติบุคคล</span>
            </div>
          </div>

          {/* Card 4: Intelligent Booking System */}
          <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-blue-300 transition-all duration-300">
            <div className="space-y-4">
              <div className="w-13 h-13 rounded-2xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600 p-3">
                <CalendarCheck className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <span className="text-blue-700 text-xs sm:text-sm font-bold uppercase tracking-wider">
                  Service & Appointments
                </span>
                <h3 className="font-heading text-xl sm:text-2xl font-semibold text-slate-900">
                  ระบบจองคิวบริการอัตโนมัติ
                </h3>
              </div>
              <p className="text-slate-600 text-base leading-relaxed">
                เช็ควันและรอบเวลาว่างแบบ Real-time บันทึกคิวนัดหมาย เลื่อน หรือยกเลิก พร้อมระบบส่งข้อความแจ้งเตือนลูกค้าล่วงหน้าอัตโนมัติทาง LINE
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 flex items-center gap-2 text-sm font-semibold text-blue-700">
              <CheckCircle2 className="w-4.5 h-4.5 shrink-0" />
              <span>เหมาะสำหรับคลินิก สปา อู่ซ่อม และร้านบริการ</span>
            </div>
          </div>

          {/* Card 5: Customer Memory Graph */}
          <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-blue-300 transition-all duration-300">
            <div className="space-y-4">
              <div className="w-13 h-13 rounded-2xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-600 p-3">
                <BrainCircuit className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <span className="text-purple-700 text-xs sm:text-sm font-bold uppercase tracking-wider">
                  Personalization Memory
                </span>
                <h3 className="font-heading text-xl sm:text-2xl font-semibold text-slate-900">
                  Customer Memory Graph
                </h3>
              </div>
              <p className="text-slate-600 text-base leading-relaxed">
                จดจำชื่อลูกค้า ยอดซื้อสะสม ที่อยู่เดิม และความชอบส่วนบุคคล (เช่น สูตรที่เคยสั่ง ข้อมูลแพ้) นำมาวิเคราะห์ร่วมในการตอบ ทำให้ลูกค้าประทับใจเสมือนมีผู้ช่วยส่วนตัว
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 flex items-center gap-2 text-sm font-semibold text-purple-700">
              <CheckCircle2 className="w-4.5 h-4.5 shrink-0" />
              <span>เพิ่มโอกาสปิดการขายและสร้างยอดซื้อซ้ำ</span>
            </div>
          </div>

          {/* Card 6: Proactive Auto Follow-up */}
          <div className="lg:col-span-3 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-8 sm:p-10 border border-blue-800/80 shadow-xl relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-400/20 text-cyan-300 text-xs sm:text-sm font-bold">
                <ClockAlert className="w-4 h-4" />
                <span>Proactive Sales Follow-up</span>
              </div>
              <h3 className="font-heading text-2xl sm:text-3xl font-semibold text-white">
                ระบบติดตามยอดค้างชำระ & ทักทายชวนซื้อซ้ำอัตโนมัติ
              </h3>
              <p className="text-slate-200 text-base sm:text-lg leading-relaxed">
                ไม่ปล่อยให้ออเดอร์หลุดมือ! AI จะช่วยติดตามลูกค้าที่ยังไม่ชำระเงินตามช่วงเวลาที่เหมาะสม พร้อมทักทายลูกค้าเก่าเมื่อถึงรอบที่สินค้าควรสั่งซื้อใหม่อัตโนมัติ
              </p>
            </div>

            <div className="shrink-0">
              <a
                href="#pricing"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-bold px-7 py-4 rounded-xl shadow-lg transition-all duration-200 active:scale-95 text-base"
              >
                <span>ดูแพ็กเกจที่รองรับ</span>
                <ArrowRight className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
