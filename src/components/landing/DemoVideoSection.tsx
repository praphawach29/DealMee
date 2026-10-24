'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Play } from 'lucide-react'

/**
 * The landing page's demo: the promo clips, one chapter at a time.
 *
 * The chapters are cut from the clips in `video/` (same files posted on Reels/TikTok),
 * whose phone screens and LINE bubbles are drawn from this app's own wording. The shops,
 * customers and amounts in them are made up, and the section says so — these are not
 * screen recordings and nothing here should call them that.
 *
 * Each chapter is a small muted file (public/videos/demo/chNN.mp4, ~160 KB) that plays
 * while the section is on screen and moves to the next one when it ends. To re-cut them
 * after a clip changes, see video/README.md.
 */
const CHAPTERS = [
  { title: 'ตอบแชทแทนคุณ 24 ชม.', desc: 'ลูกค้าทักตอนตีสอง บอทตอบจากข้อมูลร้านจริง แล้วพาไปจนสั่งซื้อ' },
  { title: 'ปิดการขายจบในแชท', desc: 'สรุปยอดกับค่าส่ง ส่ง QR พร้อมเพย์ตามยอดจริง แล้วตรวจสลิปให้' },
  { title: 'ยอดโอนไม่ตรง', desc: 'ยอดในสลิปไม่เท่ายอดออเดอร์ ระบบไม่ยืนยันเอง แจ้งเข้า LINE แอดมิน' },
  { title: 'ขอ QR แล้วเงียบ', desc: 'ครบเวลาที่ร้านตั้งไว้ บอทส่งข้อความเตือนชำระเงินให้เอง' },
  { title: 'กันสลิปซ้ำ', desc: 'สลิปที่เคยใช้ยืนยันออเดอร์ไปแล้ว ระบบไม่ยืนยันให้ซ้ำ' },
  { title: 'สินค้าราคาสูง', desc: 'บอทตอบข้อมูลให้ก่อน เก็บชื่อกับเบอร์ แล้วส่งต่อให้แอดมินโทรปิด' },
  { title: 'แจ้งเลขพัสดุ', desc: 'ร้านใส่เลขพัสดุในหลังบ้านครั้งเดียว ลูกค้าได้รับในแชททันที' },
  { title: 'ธุรกิจบริการ', desc: 'ไม่มีสินค้าก็ใช้ได้ อัปโหลดข้อมูลร้าน บอทตอบตามคลังความรู้' },
] as const

const chapterFile = (i: number, ext: 'mp4' | 'jpg') => `/videos/demo/ch${String(i + 1).padStart(2, '0')}.${ext}`

export default function DemoVideoSection() {
  const [active, setActive] = useState(0)
  const [reduced, setReduced] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const chipsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setReduced(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  }, [])

  // Play while the video is on screen, pause once it scrolls away. Someone who asked for
  // less motion gets the poster and presses play themselves.
  useEffect(() => {
    const el = videoRef.current
    if (!el || reduced) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) el.play().catch(() => {})
        else el.pause()
      },
      { threshold: 0.4 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [active, reduced])

  // keep the chosen chapter's chip in view on phones
  useEffect(() => {
    const row = chipsRef.current
    const chip = row?.querySelector<HTMLElement>(`[data-chapter="${active}"]`)
    if (row && chip) {
      row.scrollTo({ left: chip.offsetLeft - row.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' })
    }
  }, [active])

  const current = CHAPTERS[active]

  return (
    <section id="demo" className="py-20 px-4 sm:px-6 lg:px-8 bg-white border-t border-slate-200/80">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="text-xs font-bold tracking-[2px] uppercase text-blue-600 mb-2">ดูการใช้งาน</div>
          <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-semibold text-slate-900 leading-tight mb-3">
            ดูบอททำงานจริง <span className="text-primary">ทีละเรื่อง</span>
          </h2>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            เลือกเรื่องที่อยากดู หรือปล่อยให้เล่นต่อกันไปเอง · หน้าจอและข้อความในคลิปมาจากระบบจริง
            ส่วนชื่อร้าน ชื่อลูกค้า และยอดเงินเป็นข้อมูลสมมติ
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8 lg:gap-12 items-center">
          {/* Phone-shaped player */}
          <div className="mx-auto w-full max-w-[280px] lg:max-w-none">
            <div className="relative rounded-[28px] border-[6px] border-slate-900 bg-slate-900 shadow-2xl overflow-hidden">
              <video
                ref={videoRef}
                key={active}
                className="block w-full aspect-[9/16] bg-slate-900"
                src={chapterFile(active, 'mp4')}
                poster={chapterFile(active, 'jpg')}
                muted
                playsInline
                autoPlay={!reduced}
                controls={reduced}
                preload="metadata"
                onEnded={() => setActive((i) => (i + 1) % CHAPTERS.length)}
              />
            </div>
            <div className="mt-3 text-center text-xs text-slate-500">
              ตอนที่ {active + 1} จาก {CHAPTERS.length} · ไม่มีเสียง
            </div>
          </div>

          <div>
            {/* Phones: a scrollable chip row. Desktop: the full list below carries the titles */}
            <div ref={chipsRef} className="lg:hidden -mx-4 px-4 mb-5 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {CHAPTERS.map((ch, i) => (
                <button
                  key={ch.title}
                  type="button"
                  data-chapter={i}
                  onClick={() => setActive(i)}
                  className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-semibold border transition-colors ${
                    i === active
                      ? 'bg-primary text-white border-primary'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {i + 1}. {ch.title}
                </button>
              ))}
            </div>

            <div className="lg:hidden rounded-[14px] border border-slate-200/90 bg-slate-50 p-4 mb-2">
              <div className="text-sm font-bold text-slate-900">{current.title}</div>
              <div className="text-xs text-slate-600 leading-relaxed mt-1">{current.desc}</div>
            </div>

            <div className="hidden lg:grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CHAPTERS.map((ch, i) => {
                const isActive = i === active
                return (
                  <button
                    key={ch.title}
                    type="button"
                    onClick={() => setActive(i)}
                    className={`text-left rounded-[14px] p-4 border transition-all ${
                      isActive
                        ? 'bg-primary/5 border-primary shadow-card'
                        : 'bg-white border-slate-200/90 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                          isActive ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {isActive ? <Play className="h-3 w-3 fill-current" /> : i + 1}
                      </span>
                      <span className="text-sm font-bold text-slate-900">{ch.title}</span>
                    </div>
                    <div className="text-xs text-slate-600 leading-relaxed">{ch.desc}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
