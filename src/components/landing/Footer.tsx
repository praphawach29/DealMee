'use client'

import React from 'react'
import Link from 'next/link'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-[#040814] text-slate-400 py-14 px-4 sm:px-6 lg:px-8 border-t border-white/10 text-xs sm:text-sm">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Top Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 pb-10 border-b border-white/10">
          {/* Col 1: Brand Info (Spans 2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-cyan-500 to-emerald-400 flex items-center justify-center text-white font-bold text-base shadow-md shadow-cyan-500/20">
                D
              </div>
              <span className="font-extrabold text-2xl tracking-wider text-white">
                DEAL<span className="text-cyan-400">MEE</span>
              </span>
            </Link>
            <p className="text-sm sm:text-base text-slate-300 max-w-sm leading-relaxed">
              DealMee AI (DealMee.app) แพลตฟอร์ม AI Sales Agent อัจฉริยะสำหรับธุรกิจไทยบน LINE Official Account ช่วยตอบแชท รับออเดอร์ คำนวณค่าส่ง ตรวจสลิป และออกใบเสนอราคาตลอด 24 ชั่วโมง
            </p>
            <div className="flex items-center gap-2 pt-1 text-emerald-400 text-sm font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>ระบบทำงานปกติ 99.9% Uptime</span>
            </div>
          </div>

          {/* Col 2: Navigation Links */}
          <div className="space-y-4">
            <h4 className="font-bold text-white text-sm sm:text-base uppercase tracking-wider">
              ผลิตภัณฑ์
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a href="#demo" className="hover:text-cyan-400 transition-colors">
                  ตัวอย่างแชทจริง (Simulation)
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-cyan-400 transition-colors">
                  ฟีเจอร์การปิดการขาย
                </a>
              </li>
              <li>
                <a href="#dashboard" className="hover:text-cyan-400 transition-colors">
                  แดชบอร์ดจัดการสต็อก & ออเดอร์
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-cyan-400 transition-colors">
                  แพ็กเกจและราคา
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Integrations & Compliance */}
          <div className="space-y-4">
            <h4 className="font-bold text-white text-sm sm:text-base uppercase tracking-wider">
              เทคโนโลยี & ความปลอดภัย
            </h4>
            <ul className="space-y-2.5 text-sm text-slate-400">
              <li>LINE Official Account Messaging API</li>
              <li>Bank-Grade Slip Verification (Multi-Provider)</li>
              <li>Supabase PostgreSQL Row Level Security</li>
              <li>Gemini & Claude Multimodal AI</li>
            </ul>
          </div>

          {/* Col 4: Legal & Support */}
          <div className="space-y-4">
            <h4 className="font-bold text-white text-sm sm:text-base uppercase tracking-wider">
              ช่วยเหลือ & ติดต่อ
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a href="#faq" className="hover:text-cyan-400 transition-colors">
                  คำถามที่พบบ่อย (FAQ)
                </a>
              </li>
              <li>
                <a href="mailto:support@dealmee.app" className="hover:text-cyan-400 transition-colors">
                  ติดต่อทีมงาน (support@dealmee.app)
                </a>
              </li>
              <li>
                <Link href="/login" className="hover:text-cyan-400 transition-colors">
                  เข้าสู่ระบบแอดมิน
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs sm:text-sm text-slate-400">
          <div>
            &copy; {currentYear} DealMee.app (DealMee AI). All rights reserved. ออกแบบสำหรับร้านค้าและธุรกิจไทย
          </div>
          <div className="flex items-center gap-6">
            <Link href="/terms" className="hover:text-cyan-400 transition-colors">
              เงื่อนไขการให้บริการ
            </Link>
            <Link href="/privacy" className="hover:text-cyan-400 transition-colors">
              นโยบายความเป็นส่วนตัว
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
