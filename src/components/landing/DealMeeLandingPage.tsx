'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  Bot,
  FileSpreadsheet,
  CheckCircle2,
  ShieldCheck,
  CalendarCheck,
  Zap,
  ArrowRight,
  ChevronDown,
  MessageSquare,
  QrCode,
  TrendingUp,
  Store,
  Layers,
  Check,
  ExternalLink,
} from 'lucide-react'

export default function DealMeeLandingPage() {
  const [appUrl, setAppUrl] = useState('/login')
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  useEffect(() => {
    // If the visitor is on dealmee.app or www.dealmee.app in production, route CTA to app.dealmee.app
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname
      if (hostname === 'dealmee.app' || hostname === 'www.dealmee.app') {
        setAppUrl('https://app.dealmee.app/login')
      } else {
        setAppUrl('/login')
      }
    }
  }, [])

  const faqs = [
    {
      q: 'DealMee AI ทำงานร่วมกับ LINE Official Account (LINE OA) อย่างไร?',
      a: 'เพียงนำ Webhook URL จากหน้าตั้งค่า DealMee ไปวางใน LINE Developers Console เพียงครั้งเดียว น้อง DealMee จะเริ่มเรียนรู้ข้อมูลสินค้า บริการ และตอบลูกค้าในแชทให้คุณตลอด 24 ชั่วโมงทันทีโดยไม่ต้องลงโปรแกรมเพิ่ม',
    },
    {
      q: 'การออกใบเสนอราคา (Quotation) ทาง LINE สะดวกอย่างไร?',
      a: 'เมื่อลูกค้าสนใจสั่งซื้อหรือขอใบเสนอราคา DealMee AI สามารถดึงข้อมูลสินค้า คำนวณยอดเงินพร้อมส่วนลด และส่งเป็นการ์ด LINE Flex Message สุดหรูเข้าแชทลูกค้าได้ทันที ลูกค้าสามารถกดดูใบเสนอราคาแบบ Responsive และสั่งพิมพ์ A4 หรือสแกนจ่ายผ่าน QR PromptPay ได้เลย',
    },
    {
      q: 'ระบบตรวจสลิปแม่นยำแค่ไหน จับสลิปปลอมได้ไหม?',
      a: 'DealMee เชื่อมต่อกับระบบ EasySlip ตรวจสอบสลิปผ่าน QR Code กับระบบธนาคารโดยตรง ตรวจจับสลิปปลอม สลิปซ้ำ สลิปแก้ไขตัวเลข และตัดสต็อกสินค้าทันทีเมื่อยอดเงินเข้าบัญชีจริง 100%',
    },
    {
      q: 'DealMee มีความเกี่ยวข้องกับ CheckMee (checkmee.app) อย่างไร?',
      a: 'DealMee และ CheckMee เป็นผลิตผลในตระกูลซอฟต์แวร์ "Mee Ecosystem" ที่พัฒนาขึ้นเพื่อตอบโจทย์ผู้ประกอบการไทย โดย CheckMee ดูแลงานลงเวลาพนักงานผ่าน LINE และ DealMee ดูแลระบบปิดการขายและลูกค้าอัตโนมัติบน LINE',
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-600 selection:text-white">
      {/* ── 1. Top Announcement Bar ── */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white text-xs sm:text-sm py-2 px-4 text-center font-medium flex items-center justify-center gap-2">
        <span className="bg-white/20 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider">
          Mee Family
        </span>
        <span>
          ยินดีต้อนรับสู่ <strong>DealMee.app</strong> ระบบ AI ปิดการขายอัจฉริยะ (เครือเดียวกับ CheckMee.app)
        </span>
      </div>

      {/* ── 2. Navigation Header ── */}
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-slate-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              D
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                  DealMee<span className="text-blue-600">.ai</span>
                </span>
                <span className="text-[10px] uppercase font-extrabold tracking-wider bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md border border-blue-200/60 hidden sm:inline-block">
                  Sales Closer
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium -mt-1 hidden sm:block">
                AI พนักงานขาย 24 ชม. บน LINE OA
              </p>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a href="#features" className="hover:text-blue-600 transition-colors">
              ฟีเจอร์เด่น
            </a>
            <a href="#flex-quotation" className="hover:text-blue-600 transition-colors">
              ใบเสนอราคา Flex
            </a>
            <a href="#easyslip" className="hover:text-blue-600 transition-colors">
              ตรวจสลิปออโต้
            </a>
            <a href="#pricing" className="hover:text-blue-600 transition-colors">
              แพ็กเกจราคา
            </a>
            <a href="#faq" className="hover:text-blue-600 transition-colors">
              คำถามพบบ่อย
            </a>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <a
              href={appUrl}
              className="text-xs sm:text-sm font-bold text-slate-700 hover:text-blue-600 px-3.5 py-2 rounded-xl hover:bg-slate-100 transition-all min-h-[40px] inline-flex items-center"
            >
              เข้าสู่ระบบ
            </a>
            <a
              href={appUrl}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold px-4 sm:px-5 py-2.5 rounded-xl shadow-md shadow-blue-600/25 hover:shadow-lg hover:shadow-blue-600/30 hover:-translate-y-0.5 active:scale-[0.98] transition-all min-h-[40px] inline-flex items-center gap-1.5"
            >
              <span>ทดลองใช้ฟรี</span>
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      {/* ── 3. Hero Section ── */}
      <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 overflow-hidden">
        {/* Glow gradients */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-blue-400/20 via-indigo-400/20 to-purple-400/10 blur-[120px] pointer-events-none -z-10 rounded-full" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            {/* Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-bold shadow-xs">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              <span>DealMee Brain Engine™ โมเดล AI ขายของที่ปิดยอดได้จริง</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.15]">
              ปิดทุกดีล ปิดทุกการขาย <br />
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                ด้วย AI พนักงานขายบน LINE OA
              </span>
            </h1>

            {/* Subhead */}
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
              เปลี่ยน LINE OA ร้านคุณให้เป็นเครื่องจักรทำเงิน 24 ชม. น้อง DealMee AI
              แนะนำสินค้าอย่างมีจิตวิทยาการขาย ออกใบเสนอราคา Flex ทรงพลัง และตรวจสลิปยอดเข้าจริงแบบอัตโนมัติ
            </p>

            {/* CTA Buttons */}
            <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <a
                href={appUrl}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm sm:text-base px-8 py-4 rounded-2xl shadow-xl shadow-blue-600/30 hover:shadow-2xl hover:shadow-blue-600/40 hover:-translate-y-0.5 active:scale-[0.98] transition-all flex items-center justify-center gap-2 min-h-[52px]"
              >
                <span>เริ่มใช้งานฟรีวันนี้ (ไม่ต้องกรอกบัตร)</span>
                <ArrowRight className="h-5 w-5" />
              </a>
              <a
                href="#flex-quotation"
                className="w-full sm:w-auto bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-sm sm:text-base px-6 py-4 rounded-2xl transition-all shadow-xs flex items-center justify-center gap-2 min-h-[52px]"
              >
                <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                <span>ดูตัวอย่างใบเสนอราคา Flex</span>
              </a>
            </div>

            {/* Trust points */}
            <div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> สมัครง่าย เชื่อมต่อ LINE ใน 1 นาที
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> รองรับสลิปทุกธนาคารชั้นนำ
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> ปลอดภัยตามมาตรฐานสากล
              </span>
            </div>
          </div>

          {/* ── Hero Live Preview / Chat Showcase ── */}
          <div className="mt-14 max-w-4xl mx-auto">
            <div className="bg-slate-900 rounded-3xl p-3 sm:p-5 shadow-2xl shadow-slate-900/30 border border-slate-800 relative">
              {/* Window Header */}
              <div className="flex items-center justify-between pb-3 px-2 border-b border-slate-800 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                  <span className="ml-2 font-mono text-[11px] text-slate-400">
                    LINE OA Simulation — DealMee AI Active
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>AI ตอบกลับใน 1.2 วินาที</span>
                </div>
              </div>

              {/* Chat Simulation Area */}
              <div className="pt-4 px-2 sm:px-4 space-y-4 font-sans text-xs sm:text-sm">
                {/* User message 1 */}
                <div className="flex justify-end">
                  <div className="bg-emerald-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-xs max-w-[85%] sm:max-w-md shadow-xs">
                    สวัสดีครับ สนใจสั่งซื้อเสื้อโปโลพรีเมียม 2 ตัว กับร่มพกพา 1 คัน ขอใบเสนอราคาด้วยครับ
                  </div>
                </div>

                {/* Bot message 1 (Consultative Close) */}
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs mt-0.5">
                    D
                  </div>
                  <div className="space-y-2 max-w-[90%] sm:max-w-lg">
                    <div className="bg-slate-800 text-slate-100 p-3.5 rounded-2xl rounded-tl-xs border border-slate-700 leading-relaxed shadow-xs">
                      สวัสดีค่ะ <strong>น้อง DealMee</strong> ยินดีให้บริการค่ะ! จัดชุดให้เรียบร้อยแล้วค่ะ ทางร้านมีโปรโมชั่นส่งฟรีรอบตัดบ่ายสองวันนี้พอดีค่ะ 🌟
                    </div>

                    {/* LINE Flex Quotation Card Representation */}
                    <div className="bg-gradient-to-b from-white to-slate-50 text-slate-900 rounded-2xl p-4 sm:p-5 border-2 border-blue-500/40 shadow-xl space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                            D
                          </div>
                          <div>
                            <p className="font-extrabold text-xs text-slate-900">ใบเสนอราคา (Quotation)</p>
                            <p className="text-[10px] text-slate-500">เลขที่: QT-202609-0042</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                          รอชำระเงิน
                        </span>
                      </div>

                      {/* Items */}
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between text-slate-700">
                          <span>• เสื้อโปโล DealMee Edition x 2 ตัว</span>
                          <span className="font-mono font-bold">฿1,180.00</span>
                        </div>
                        <div className="flex justify-between text-slate-700">
                          <span>• ร่มกัน UV พรีเมียม x 1 คัน</span>
                          <span className="font-mono font-bold">฿350.00</span>
                        </div>
                        <div className="flex justify-between text-emerald-600 font-medium">
                          <span>• ค่าจัดส่ง Flash Express</span>
                          <span>ฟรี (โปรโมชั่น)</span>
                        </div>
                      </div>

                      {/* Net Total */}
                      <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                        <span className="text-xs font-bold text-slate-800">ยอดชำระสุทธิ (Net Total):</span>
                        <span className="text-base sm:text-lg font-black font-mono text-blue-600">฿1,530.00</span>
                      </div>

                      {/* Payment info snippet */}
                      <div className="bg-slate-100 p-2.5 rounded-xl text-[11px] text-slate-600 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-800">ธ.กสิกรไทย (KBANK) • 123-4-56789-0</p>
                          <p className="text-[10px] text-slate-500">หรือสแกน QR พร้อมเพย์ผ่านลิงก์เอกสาร</p>
                        </div>
                        <QrCode className="h-6 w-6 text-slate-700" />
                      </div>

                      {/* Action buttons on flex */}
                      <div className="pt-1 flex gap-2">
                        <a
                          href={appUrl}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-center py-2.5 rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-1.5"
                        >
                          <span>กดดูใบเสนอราคาตัวจริง</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* User sends slip */}
                <div className="flex justify-end pt-2">
                  <div className="bg-emerald-600 text-white px-4 py-2 rounded-2xl rounded-tr-xs text-xs flex items-center gap-2">
                    <span>[ส่งรูปภาพสลิปโอนเงิน ฿1,530.00]</span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-200" />
                  </div>
                </div>

                {/* Bot Instant Verify */}
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs mt-0.5">
                    D
                  </div>
                  <div className="bg-slate-800 border border-emerald-500/40 text-slate-100 p-3.5 rounded-2xl rounded-tl-xs max-w-[90%] sm:max-w-md shadow-xs space-y-1">
                    <p className="text-emerald-400 font-bold flex items-center gap-1.5 text-xs">
                      <ShieldCheck className="h-4 w-4" /> ตรวจสอบสลิปผ่าน EasySlip เรียบร้อย!
                    </p>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      ยอดเงินเข้าบัญชีจริง <strong>฿1,530.00</strong> ทางร้านกำลังแพ็คสินค้าและจะส่งเลขพัสดุให้ทันทีค่ะ ขอบพระคุณค่ะ 🙏
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Core Superpowers Bento Grid ── */}
      <section id="features" className="py-20 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-blue-600">
              Why DealMee AI
            </h2>
            <h3 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              ครบทุกเครื่องมือปิดการขาย ที่ร้านค้าออนไลน์ต้องการ
            </h3>
            <p className="text-slate-600 text-sm sm:text-base">
              ไม่ได้มีแค่ระบบตอบกลับอัตโนมัติทั่วไป แต่น้อง DealMee คือพนักงานขายและผู้จัดการร้าน AI แบบ All-in-One
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200 hover:border-blue-400 hover:shadow-xl transition-all duration-300 group">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center mb-6 shadow-md shadow-blue-500/30 group-hover:scale-110 transition-transform">
                <Bot className="h-6 w-6" />
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">
                AI Sales Closer ปิดการขายไว
              </h4>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                ใช้หลักจิตวิทยา Consultative Closing ไม่ตอบคำถามแบบทื่อๆ รู้จักถามต่อเพื่อคุมเกม (Bridge Question) เสนอทางเลือกปิดดีล และชูคุณค่าสินค้าจนลูกค้าตกลงซื้อ
              </p>
              <ul className="space-y-2 text-xs font-semibold text-slate-700">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500" /> วิเคราะห์ข้อกังวล 4 ด้าน (ราคา, คุณภาพ, ส่ง, ไซส์)
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500" /> ปิดการขายด้วยทางเลือก (Alternative Close)
                </li>
              </ul>
            </div>

            {/* Feature 2 (Quotation) */}
            <div id="flex-quotation" className="bg-slate-50 rounded-3xl p-8 border border-slate-200 hover:border-blue-400 hover:shadow-xl transition-all duration-300 group">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mb-6 shadow-md shadow-indigo-500/30 group-hover:scale-110 transition-transform">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">
                ออกใบเสนอราคา LINE Flex สวยหรู
              </h4>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                ออกบิลและใบเสนอราคาทางการได้ใน 3 วินาที ส่งเป็นการ์ด Flex สวยงามใน LINE พร้อมปุ่มเปิดดูบิลหน้าเว็บ Responsive และสั่งพิมพ์ A4 / บันทึก PDF ได้ทันที
              </p>
              <ul className="space-y-2 text-xs font-semibold text-slate-700">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500" /> สร้าง Dynamic PromptPay QR ยอดเงินตรงเป๊ะ
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500" /> หน้าเว็บสาธารณะเปิดดูได้เลยไม่ต้องล็อกอิน
                </li>
              </ul>
            </div>

            {/* Feature 3 (EasySlip) */}
            <div id="easyslip" className="bg-slate-50 rounded-3xl p-8 border border-slate-200 hover:border-blue-400 hover:shadow-xl transition-all duration-300 group">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mb-6 shadow-md shadow-emerald-500/30 group-hover:scale-110 transition-transform">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">
                ตรวจสลิป EasySlip ยอดเข้าจริง 100%
              </h4>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                ไม่ต้องคอยนั่งเพ่งสลิปเอง AI สแกน QR ตรวจสอบข้อมูลตรงกับระบบธนาคาร ยอดเงินตรง บัญชีตรง ป้องกันสลิปปลอมหรือสลิปวน พร้อมตัดสต็อกอัตโนมัติ
              </p>
              <ul className="space-y-2 text-xs font-semibold text-slate-700">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500" /> ตรวจสอบสลิปใน 1 วินาทีหลังส่งรูป
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500" /> ซิงค์ยอดชำระเงินและอัปเดตสถานะออเดอร์ทันที
                </li>
              </ul>
            </div>

            {/* Feature 4 (Booking) */}
            <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200 hover:border-blue-400 hover:shadow-xl transition-all duration-300 group">
              <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center mb-6 shadow-md shadow-purple-500/30 group-hover:scale-110 transition-transform">
                <CalendarCheck className="h-6 w-6" />
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">
                ระบบนัดหมาย & จองคิวอัตโนมัติ
              </h4>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                เหมาะสำหรับคลินิก ร้านทำผม สปา คลาสเรียน ร้านอาหาร และศูนย์บริการ ตรวจรอบเวลาว่าง บันทึกคิวจอง และแจ้งเตือนลูกค้าล่วงหน้า
              </p>
              <ul className="space-y-2 text-xs font-semibold text-slate-700">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500" /> ล็อกคิวและจัดการตารางเวลาแม่นยำ
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500" /> ลดปัญหาการจองซ้ำ (Overbooking)
                </li>
              </ul>
            </div>

            {/* Feature 5 (Copilot) */}
            <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200 hover:border-blue-400 hover:shadow-xl transition-all duration-300 group">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center mb-6 shadow-md shadow-amber-500/30 group-hover:scale-110 transition-transform">
                <TrendingUp className="h-6 w-6" />
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">
                DealMee Copilot วิเคราะห์ร้านค้า
              </h4>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                เสมือนมีที่ปรึกษาธุรกิจและผู้จัดการร้านส่วนตัวในหลังบ้าน ถามยอดขาย สต็อกใกล้หมด ลูกค้าค้างจ่าย หรือขอไอเดียเพิ่มยอดขายได้ตลอดเวลา
              </p>
              <ul className="space-y-2 text-xs font-semibold text-slate-700">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500" /> สรุปยอดขายและลูกค้ารายวัน-รายเดือน
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500" /> แจ้งเตือนสินค้าขายดีและสต็อกที่ต้องเติม
                </li>
              </ul>
            </div>

            {/* Feature 6 (Zero Push Quota Architecture) */}
            <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200 hover:border-blue-400 hover:shadow-xl transition-all duration-300 group">
              <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center mb-6 shadow-md shadow-rose-500/30 group-hover:scale-110 transition-transform">
                <Zap className="h-6 w-6" />
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">
                Zero Push Quota ประหยัดโควตา LINE
              </h4>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                ออกแบบสถาปัตยกรรมให้ส่ง Flex Message ผ่าน Reply Token ของลูกค้า ช่วยร้านค้าประหยัดโควตา Push Message รายเดือนของ LINE OA ได้อย่างมหาศาล
              </p>
              <ul className="space-y-2 text-xs font-semibold text-slate-700">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500" /> ตอบกลับลูกค้าฟรีในรอบสนทนา
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500" /> คุมต้นทุนค่าส่งข้อความ LINE OA ได้อยู่หมัด
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Mee Ecosystem Synergy Section ── */}
      <section className="py-16 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 text-indigo-200 text-xs font-bold border border-white/15">
                <Layers className="h-3.5 w-3.5 text-indigo-400" />
                <span>Mee Software Family • ครบเครื่องเรื่องธุรกิจบน LINE</span>
              </div>
              <h3 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
                เชื่อมต่อธุรกิจของคุณ <br />
                ด้วยตระกูลซอฟต์แวร์ "Mee"
              </h3>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                เราตั้งใจสร้าง Ecosystem เครื่องมือสำหรับธุรกิจไทยที่ใช้งานง่ายผ่าน LINE ทั้งระบบดูแลพนักงานและระบบดูแลลูกค้า
              </p>
              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
                    C
                  </div>
                  <div>
                    <h5 className="font-bold text-white text-base">CheckMee (checkmee.app)</h5>
                    <p className="text-xs text-slate-400 mt-1">
                      ระบบลงชื่อเข้า-ออกงาน บันทึกเวลาทำงาน ขอลา และคำนวณเบี้ยเลี้ยงพนักงานผ่าน LINE ได้อย่างแม่นยำ
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/10 border border-blue-400/30">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/30 text-blue-400 flex items-center justify-center font-bold text-sm shrink-0">
                    D
                  </div>
                  <div>
                    <h5 className="font-bold text-white text-base">DealMee (dealmee.app)</h5>
                    <p className="text-xs text-slate-300 mt-1">
                      ระบบ AI พนักงานขายและปิดการขายอัจฉริยะ ออกใบเสนอราคา Flex ตรวจสลิปยอดเข้าจริง และดูแลลูกค้า 24 ชม.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/5 p-8 rounded-3xl border border-white/10 text-center space-y-6">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-blue-500 to-indigo-500 text-white flex items-center justify-center mx-auto shadow-xl shadow-blue-500/30 font-black text-2xl">
                🤝
              </div>
              <h4 className="text-2xl font-bold">พร้อมขับเคลื่อนธุรกิจของคุณให้ก้าวกระโดด</h4>
              <p className="text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
                เริ่มต้นใช้งาน DealMee วันนี้เพื่อเพิ่มยอดขายและลดเวลาการตอบแชทของแอดมินได้ทันที
              </p>
              <a
                href={appUrl}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3.5 rounded-xl shadow-lg shadow-blue-600/30 transition-all min-h-[46px]"
              >
                <span>เปิดใช้งาน DealMee ทันที</span>
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. Pricing Plans ── */}
      <section id="pricing" className="py-20 bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-blue-600">
              Transparent Pricing
            </h2>
            <h3 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              แพ็กเกจที่คุ้มค่า ลงทุนหลักร้อย ยอดขายหลักล้าน
            </h3>
            <p className="text-slate-600 text-sm sm:text-base">
              เลือกแพ็กเกจที่เหมาะกับขนาดธุรกิจของคุณ อัปเกรดหรือยกเลิกได้ทุกเมื่อ
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Free Starter */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-lg font-bold text-slate-900">Starter Trial</h4>
                    <p className="text-xs text-slate-500">สำหรับร้านค้าเริ่มต้นทดสอบระบบ</p>
                  </div>
                </div>
                <div className="my-6">
                  <span className="text-4xl font-black text-slate-900">฿0</span>
                  <span className="text-xs text-slate-500 font-medium"> / ทดลองใช้ฟรี</span>
                </div>
                <ul className="space-y-3 text-xs text-slate-600">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" /> เชื่อมต่อ 1 LINE Official Account
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" /> AI ตอบแชท 100 ข้อความ/เดือน
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" /> ระบบสินค้าและสต็อกพื้นฐาน
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" /> ระบบแจ้งเตือนใน Dashboard
                  </li>
                </ul>
              </div>
              <div className="pt-8">
                <a
                  href={appUrl}
                  className="w-full block text-center bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 rounded-xl text-xs transition-all min-h-[44px] flex items-center justify-center"
                >
                  เริ่มทดลองใช้ฟรี
                </a>
              </div>
            </div>

            {/* Pro Plan (Popular) */}
            <div className="bg-white rounded-3xl p-8 border-2 border-blue-600 shadow-xl shadow-blue-600/10 flex flex-col justify-between relative">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[11px] font-extrabold uppercase tracking-wider px-3.5 py-1 rounded-full shadow-sm">
                ยอดนิยมที่สุด 🔥
              </div>
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-lg font-bold text-slate-900">Pro Merchant</h4>
                    <p className="text-xs text-slate-500">สำหรับร้านค้าที่ต้องการยอดขายจริง</p>
                  </div>
                </div>
                <div className="my-6">
                  <span className="text-4xl font-black text-blue-600">฿590</span>
                  <span className="text-xs text-slate-500 font-medium"> / เดือน</span>
                </div>
                <ul className="space-y-3 text-xs text-slate-600">
                  <li className="flex items-center gap-2 font-semibold text-slate-900">
                    <Check className="h-4 w-4 text-blue-600" /> ข้อความแชท AI ไม่จำกัด
                  </li>
                  <li className="flex items-center gap-2 font-semibold text-slate-900">
                    <Check className="h-4 w-4 text-blue-600" /> ออกใบเสนอราคา LINE Flex สวยหรู
                  </li>
                  <li className="flex items-center gap-2 font-semibold text-slate-900">
                    <Check className="h-4 w-4 text-blue-600" /> ตรวจสลิปโอนเงิน EasySlip 100%
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" /> ปิดการขายอัตโนมัติ (Alternative Close)
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" /> ระบบนัดหมาย & จองคิวอัตโนมัติ
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" /> DealMee Copilot วิเคราะห์ร้านค้า
                  </li>
                </ul>
              </div>
              <div className="pt-8">
                <a
                  href={appUrl}
                  className="w-full block text-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl text-xs transition-all shadow-md shadow-blue-600/30 min-h-[44px] flex items-center justify-center"
                >
                  สมัครใช้งาน Pro Plan
                </a>
              </div>
            </div>

            {/* Business / Enterprise */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-lg font-bold text-slate-900">Business Growth</h4>
                    <p className="text-xs text-slate-500">สำหรับแบรนด์และธุรกิจขนาดใหญ่</p>
                  </div>
                </div>
                <div className="my-6">
                  <span className="text-4xl font-black text-slate-900">฿1,890</span>
                  <span className="text-xs text-slate-500 font-medium"> / เดือน</span>
                </div>
                <ul className="space-y-3 text-xs text-slate-600">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" /> รวมทุกฟังก์ชันของ Pro Plan
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" /> รองรับหลายสาขา / แอดมินหลายคน
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" /> ปรับแต่ง Prompt & Persona พิเศษ
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" /> SLA Response & Dedicated Support
                  </li>
                </ul>
              </div>
              <div className="pt-8">
                <a
                  href={appUrl}
                  className="w-full block text-center bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 rounded-xl text-xs transition-all min-h-[44px] flex items-center justify-center"
                >
                  ติดต่อสอบถามเพิ่มเติม
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. FAQ Section ── */}
      <section id="faq" className="py-20 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14 space-y-2">
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              คำถามที่พบบ่อย (FAQ)
            </h3>
            <p className="text-slate-500 text-sm">
              ทุกข้อสงสัยเกี่ยวกับการใช้งาน DealMee AI
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx
              return (
                <div
                  key={idx}
                  className="border border-slate-200 rounded-2xl overflow-hidden transition-all bg-slate-50/50"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 font-bold text-slate-900 text-sm sm:text-base cursor-pointer hover:bg-slate-100/60 transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`h-5 w-5 text-slate-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-blue-600' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── 8. Bottom CTA Banner ── */}
      <section className="py-16 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <h3 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
            พร้อมเปลี่ยน LINE OA ให้เป็นพนักงานขายยอดเยี่ยมแล้วหรือยัง?
          </h3>
          <p className="text-blue-100 text-sm sm:text-base max-w-xl mx-auto">
            เริ่มใช้งาน DealMee วันนี้เพื่อเพิ่มยอดขาย ลดเวลาแอดมิน และดูแลลูกค้าได้ทันที 24 ชั่วโมง
          </p>
          <div className="pt-2">
            <a
              href={appUrl}
              className="inline-flex items-center gap-2 bg-white text-blue-600 hover:bg-blue-50 font-black px-8 py-4 rounded-2xl shadow-xl hover:shadow-2xl transition-all text-sm sm:text-base min-h-[50px]"
            >
              <span>สมัครสมาชิก & เริ่มต้นใช้งานฟรี</span>
              <ArrowRight className="h-5 w-5" />
            </a>
          </div>
        </div>
      </section>

      {/* ── 9. Footer ── */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm">
              D
            </div>
            <div>
              <p className="text-white font-bold text-sm">DealMee AI Platform</p>
              <p className="text-[11px] text-slate-500">
                Official Domain: <strong>dealmee.app</strong> | App: <strong>app.dealmee.app</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-slate-400">
            <a href="https://checkmee.app" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              CheckMee.app
            </a>
            <a href={appUrl} className="hover:text-white transition-colors">
              เข้าสู่ระบบร้านค้า
            </a>
            <a href="mailto:billing@dealmee.app" className="hover:text-white transition-colors">
              ติดต่อเรา (billing@dealmee.app)
            </a>
          </div>

          <div className="text-center sm:text-right text-[11px] text-slate-500">
            © 2026 DealMee Co., Ltd. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
