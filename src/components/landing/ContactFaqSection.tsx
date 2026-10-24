'use client'

import React, { useState } from 'react'
import { DEALMEE_LINE_OA, faqs } from './data'
import {
  ChevronDown,
  MessageSquare,
  Mail,
  Clock,
  ArrowRight,
  Headphones,
} from 'lucide-react'

export default function ContactFaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const toggleAccordion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 bg-white border-t border-slate-200/80">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          {/* Left Column: Contact Support Card */}
          <div className="lg:col-span-5 space-y-6">
            <div className="space-y-2">
              <div className="text-xs font-bold tracking-[2px] uppercase text-blue-600 mb-2">
                ติดต่อทีมงาน
              </div>
              <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
                มีคำถามหรือต้องการคำแนะนำ?
              </h2>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                ทีมงานพร้อมให้คำปรึกษาและช่วยแนะนำการตั้งค่า LINE Official Account ของคุณแบบไม่มีค่าใช้จ่าย
              </p>
            </div>

            {/* Direct Contact Info Box */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-5">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#06C755]/15 text-[#06C755] flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                    LINE Official Account
                  </div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    {DEALMEE_LINE_OA.id}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    แชทสอบถาม ปรึกษาการใช้งานได้ตลอดเวลา
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3.5 pt-4 border-t border-slate-200/60">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                    Email ซัพพอร์ต
                  </div>
                  <div className="text-base font-bold text-slate-900 mt-0.5 font-mono">
                    support@dealmee.app
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    ตอบกลับภายใน 24 ชั่วโมงในวันทำการ
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3.5 pt-4 border-t border-slate-200/60">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                    เวลาทำการทีมงาน
                  </div>
                  <div className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                    จันทร์ - อาทิตย์ (09:00 - 22:00 น.)
                  </div>
                  <div className="text-xs text-emerald-600 font-medium mt-0.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    เจ้าหน้าที่พร้อมให้บริการ
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <a
                  href={DEALMEE_LINE_OA.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all duration-200 active:scale-95"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>เพิ่มเพื่อนทาง LINE</span>
                </a>
              </div>
            </div>
          </div>

          {/* Right Column: FAQ Accordion List */}
          <div className="lg:col-span-7 space-y-3">
            <div className="mb-6">
              <div className="text-xs font-bold tracking-[2px] uppercase text-blue-600 mb-2">
                FAQ
              </div>
              <h3 className="font-heading text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
                คำถามที่พบบ่อย
              </h3>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, idx) => {
                const isOpen = openIndex === idx
                return (
                  <div
                    key={faq.q}
                    className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-2xs transition-all duration-200"
                  >
                    <button
                      type="button"
                      onClick={() => toggleAccordion(idx)}
                      className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                    >
                      <span className="font-bold text-sm sm:text-base text-slate-900">
                        {faq.q}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-300 ${
                          isOpen ? 'rotate-180 text-blue-600' : ''
                        }`}
                      />
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-4 pt-1 text-sm text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/40">
                        {faq.a}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
