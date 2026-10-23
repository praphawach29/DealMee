'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { scenarios } from './data'
import { ChatMessage, ProductFlexData, QuotationFlexData } from './types'
import {
  RotateCcw,
  Sparkles,
  ExternalLink,
  FileText,
  ShoppingBag,
  Wrench,
} from 'lucide-react'

function TypingIndicator() {
  return (
    <div className="bg-white self-start rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex gap-1.5 items-center shadow-sm border border-slate-200/50">
      <span className="w-2 h-2 rounded-full bg-slate-400 animate-typing-dot" style={{ animationDelay: '0s' }} />
      <span className="w-2 h-2 rounded-full bg-slate-400 animate-typing-dot" style={{ animationDelay: '0.2s' }} />
      <span className="w-2 h-2 rounded-full bg-slate-400 animate-typing-dot" style={{ animationDelay: '0.4s' }} />
    </div>
  )
}

type TimelineItem =
  | { kind: 'msg'; msg: ChatMessage; index: number }
  | { kind: 'typing'; id: number }
  | { kind: 'options'; options: string[]; selected?: string; index: number }

export default function ChatSimulatorSection() {
  const [activeTab, setActiveTab] = useState(0)
  const currentScenario = scenarios[activeTab]
  const [elapsed, setElapsed] = useState(0)
  const [runKey, setRunKey] = useState(0)

  // Build timeline for staggered reveal
  const { entries, totalDuration } = useMemo(() => {
    const list: { item: TimelineItem; showAt: number; hideAt?: number }[] = []
    let t = 200
    let typingCount = 0

    currentScenario.messages.forEach((msg, idx) => {
      if (msg.type === 'bot') {
        list.push({
          item: { kind: 'typing', id: typingCount++ },
          showAt: t,
          hideAt: t + 900,
        })
        t += 900

        list.push({
          item: { kind: 'msg', msg, index: idx },
          showAt: t,
        })
        t += 350

        if (msg.options && msg.options.length > 0) {
          const nextUser = currentScenario.messages.slice(idx + 1).find((m) => m.type === 'user')
          const selected = msg.options.find((opt) => nextUser?.text.includes(opt))
          list.push({
            item: { kind: 'options', options: msg.options, selected, index: idx },
            showAt: t,
          })
          t += 800
        }
      } else {
        list.push({
          item: { kind: 'msg', msg, index: idx },
          showAt: t,
        })
        t += 400
      }
    })

    return { entries: list, totalDuration: t + 500 }
  }, [currentScenario])

  const selectTab = (idx: number) => {
    setActiveTab(idx)
    setElapsed(0)
    setRunKey((k) => k + 1)
  }

  const restartSimulation = () => {
    setElapsed(0)
    setRunKey((k) => k + 1)
  }

  const chatContainerRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (elapsed >= totalDuration) return
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 50)
    }, 50)
    return () => clearInterval(timer)
  }, [elapsed, totalDuration])

  // Auto-scroll to latest message
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [elapsed, activeTab])

  return (
    <section id="demo" className="py-20 px-4 sm:px-6 lg:px-8 bg-white relative">
      <div className="max-w-5xl mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-xl mx-auto mb-10 space-y-2">
          <div className="text-xs font-bold tracking-[2px] uppercase text-blue-600 mb-2">
            บทสนทนาจำลอง
          </div>
          <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
            บอททำงานเป็นขั้นแบบนี้
          </h2>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            เลือกหัวข้อเพื่อดูลำดับที่บอททำได้จริง ข้อความด้านล่างเป็นตัวอย่างการทำงาน ไม่ใช่แชท ยอดขาย หรือรีวิวของลูกค้าจริง
          </p>
        </div>

        {/* Scenario Selection Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
          {scenarios.map((sc, i) => (
            <button
              key={sc.key}
              onClick={() => selectTab(i)}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 active:scale-95 flex items-center gap-1.5 ${
                activeTab === i
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-400/40'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 border border-slate-200'
              }`}
            >
              <span>{sc.label}</span>
            </button>
          ))}
        </div>

        {/* Simulator Frame Container */}
        <div className="max-w-xl mx-auto bg-white rounded-3xl shadow-xl border border-slate-200/90 overflow-hidden">
          {/* Top Bar / App Header */}
          <div className="bg-[#06C755] px-4 py-3.5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl shadow-inner">
                {currentScenario.botEmoji}
              </div>
              <div>
                <div className="text-white font-bold text-sm tracking-tight flex items-center gap-2">
                  <span>{currentScenario.botName}</span>
                </div>
                <div className="text-emerald-100 text-xs flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  ออนไลน์ 24 ชม.
                </div>
              </div>
            </div>

            <button
              onClick={restartSimulation}
              title="เริ่มจำลองใหม่"
              className="p-2 text-white/90 hover:text-white hover:bg-white/15 rounded-full transition-all duration-200"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Subtitle Information Bar */}
          <div className="bg-slate-50 border-b border-slate-200/80 px-4 py-2 text-xs text-slate-600 flex items-center justify-between font-medium">
            <span className="truncate">{currentScenario.subtitle}</span>
            <span className="text-[11px] text-blue-600 font-bold ml-2 shrink-0 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/60">
              AI Powered
            </span>
          </div>

          {/* Chat Bubble Area */}
          <div
            ref={chatContainerRef}
            key={`${currentScenario.key}-${runKey}`}
            className="bg-[#ECE5DD] p-4 flex flex-col gap-2.5 min-h-[420px] max-h-[500px] overflow-y-auto no-scrollbar"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {entries.map((entry) => {
              // Typing Indicator
              if (entry.item.kind === 'typing') {
                const isVisible =
                  elapsed >= entry.showAt && elapsed < (entry.hideAt ?? Infinity)
                if (!isVisible) return null
                return <TypingIndicator key={`typing-${entry.item.id}-${runKey}`} />
              }

              // Option Chips
              if (entry.item.kind === 'options') {
                if (elapsed < entry.showAt) return null
                const { options, selected, index: optIndex } = entry.item
                return (
                  <div
                    key={`opts-${optIndex}-${runKey}`}
                    className="self-start flex flex-wrap gap-2 max-w-[95%] mt-1"
                  >
                    {options.map((opt, optIdx) => {
                      const isSelected = selected === opt
                      return (
                        <div
                          key={`${opt}-${optIdx}`}
                          className={`animate-chip-in px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50'
                          }`}
                        >
                          {opt}
                        </div>
                      )
                    })}
                  </div>
                )
              }

              // Chat Message
              const msg = entry.item.msg
              if (elapsed < entry.showAt) return null

              return (
                <div
                  key={`${currentScenario.key}-${entry.item.index}-${runKey}`}
                  className={`animate-chat-msg max-w-[85%] flex flex-col gap-1 ${
                    msg.type === 'bot' ? 'self-start items-start' : 'self-end items-end'
                  }`}
                >
                  {/* Tool Call Tag */}
                  {msg.tool && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-100 border border-blue-200 text-xs font-mono font-medium text-blue-700 shadow-2xs">
                      <Wrench className="w-3 h-3 text-blue-600" />
                      <span>{msg.tool}()</span>
                    </div>
                  )}

                  {/* Standard Message Bubble */}
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-line shadow-xs ${
                      msg.type === 'bot'
                        ? 'bg-white text-slate-900 rounded-bl-xs border border-slate-200/60'
                        : 'bg-[#DCF8C6] text-slate-950 rounded-br-xs font-medium'
                    }`}
                  >
                    {msg.text}
                    <div className="text-[11px] text-slate-400 text-right mt-1 font-mono">
                      {msg.time}
                    </div>
                  </div>

                  {/* LINE Flex Product Card */}
                  {msg.flexType === 'product_carousel' && msg.flexData && (() => {
                    const prod = msg.flexData as ProductFlexData
                    return (
                      <div className="w-full mt-1 bg-white rounded-xl p-3.5 border border-slate-200 shadow-sm space-y-2.5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                            LINE Flex Card
                          </span>
                          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            {prod.stock}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{prod.title}</h4>
                          <p className="text-xs text-slate-500 line-clamp-2 mt-0.5 leading-normal">
                            {prod.desc}
                          </p>
                        </div>
                        <div className="flex items-baseline justify-between pt-1">
                          <div className="text-xs text-slate-500">ราคาสุทธิ</div>
                          <div className="text-base font-bold text-blue-600">
                            {prod.price}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>สั่งซื้อรายการนี้</span>
                        </button>
                      </div>
                    )
                  })()}

                  {/* LINE Flex Quotation Card */}
                  {msg.flexType === 'quotation' && msg.flexData && (() => {
                    const quote = msg.flexData as QuotationFlexData
                    return (
                      <div className="w-full mt-1 bg-white rounded-xl p-3.5 border border-amber-200 shadow-sm space-y-2.5 bg-gradient-to-b from-amber-50/20 to-white">
                        <div className="flex items-center justify-between border-b border-amber-100 pb-1.5">
                          <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" />
                            ใบเสนอราคา (Quotation)
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            {quote.docNo}
                          </span>
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between text-slate-600">
                            <span>ลูกค้า:</span>
                            <span className="font-semibold text-slate-900">{quote.company}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>รายการ:</span>
                            <span className="font-semibold text-slate-900">{quote.items}</span>
                          </div>
                          <div className="flex justify-between border-t border-slate-100 pt-1.5 text-xs font-bold">
                            <span className="text-slate-800">ยอดรวมทั้งสิ้น:</span>
                            <span className="text-amber-600 text-sm">
                              {quote.total}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>ดาวน์โหลด PDF ใบเสนอราคา</span>
                        </button>
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
