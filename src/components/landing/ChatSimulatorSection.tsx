import React from 'react'
import { scenarios } from './data'
import { ChatMessage, ProductFlexData, QuotationFlexData } from './types'
import { FileText } from 'lucide-react'
import TryRealBotLink from './TryRealBotLink'

const SCENARIO_ORDER = ['search', 'order', 'slip', 'quotation', 'booking', 'memory', 'handoff'] as const

function MessageBody({ msg }: { msg: ChatMessage }) {
  return (
    <div
      className={`max-w-[85%] flex flex-col gap-1 ${
        msg.type === 'bot' ? 'self-start items-start' : 'self-end items-end'
      }`}
    >
      <div
        className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-line shadow-xs ${
          msg.type === 'bot'
            ? 'bg-white text-slate-900 rounded-bl-xs border border-slate-200/60'
            : 'bg-[#DCF8C6] text-slate-950 rounded-br-xs font-medium'
        }`}
      >
        {msg.text}
        <div className="text-[11px] text-slate-400 text-right mt-1 font-mono">{msg.time}</div>
      </div>

      {msg.flexType === 'product_carousel' && msg.flexData && (() => {
        const prod = msg.flexData as ProductFlexData
        return (
          <div className="w-full mt-1 rounded-[14px] border border-slate-200 bg-white p-3.5 shadow-card space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <span className="text-xs font-bold text-slate-500">การ์ดสินค้า LINE</span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {prod.stock}
              </span>
            </div>
            <div className="flex h-16 items-center justify-center rounded-[10px] bg-slate-50 text-xs font-semibold text-slate-500">
              รูปจากแคตตาล็อก
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">{prod.title}</h4>
              <p className="text-xs text-slate-500 line-clamp-3 mt-0.5 leading-normal">{prod.desc}</p>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <div className="text-xs text-slate-500">ราคา</div>
              <div className="text-base font-bold text-[#06C755]">{prod.price}</div>
            </div>
            <div className="w-full py-2 bg-[#06C755] text-white rounded-[10px] text-xs font-bold text-center">
              สั่งซื้อสินค้านี้
            </div>
          </div>
        )
      })()}

      {msg.flexType === 'payment_qr' && (
        <div className="w-full mt-1 rounded-[14px] border border-slate-200 bg-white p-3.5 shadow-card">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[10px] border border-dashed border-slate-300 bg-slate-50 text-center text-[11px] font-semibold leading-snug text-slate-500">
            รูป QR
            <br />
            พร้อมเพย์
          </div>
          <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-500">
            ตัวอย่างรูป ไม่ใช่ QR จริง ยอดในรูปคือยอดออเดอร์ที่บันทึกไว้
          </p>
        </div>
      )}

      {msg.flexType === 'quotation' && msg.flexData && (() => {
        const quote = msg.flexData as QuotationFlexData
        return (
          <div className="w-full mt-1 rounded-[14px] border border-slate-200 bg-white p-3.5 shadow-card space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-primary" />
                ใบเสนอราคา
              </span>
              <span className="text-[11px] font-mono text-slate-500">{quote.docNo}</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between gap-3 text-slate-600">
                <span>ลูกค้า</span>
                <span className="font-semibold text-slate-900 text-right">{quote.customer}</span>
              </div>
              <div className="flex justify-between gap-3 text-slate-600">
                <span>รายการ</span>
                <span className="font-semibold text-slate-900 text-right">{quote.items}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-1.5 text-xs font-bold">
                <span className="text-slate-800">ยอดในเอกสาร</span>
                <span className="text-primary text-sm">{quote.total}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">{quote.vatNote}</p>
            </div>
            <div className="space-y-1.5">
              <div className="w-full py-2 bg-primary text-white rounded-[10px] text-xs font-bold text-center">
                ดูใบเสนอราคา / บันทึก PDF
              </div>
              <div className="w-full py-2 bg-slate-100 text-slate-800 rounded-[10px] text-xs font-bold text-center border border-slate-200">
                ดาวน์โหลด Word (.docx)
              </div>
              <div className="w-full py-2 bg-slate-100 text-slate-800 rounded-[10px] text-xs font-bold text-center border border-slate-200">
                ดาวน์โหลด Excel (.xlsx)
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default function ChatSimulatorSection() {
  const ordered = SCENARIO_ORDER.map((key) => scenarios.find((scenario) => scenario.key === key)).filter(
    (scenario): scenario is (typeof scenarios)[number] => Boolean(scenario)
  )

  return (
    <section id="demo" className="py-20 px-4 sm:px-6 lg:px-8 bg-white relative">
      <style>{`
        .demo-switcher .demo-panel { display: none; }
        ${ordered
          .map(
            (scenario) => `
          #demo-${scenario.key}:checked ~ .demo-tabs label[for="demo-${scenario.key}"] {
            background: #2F6BFF;
            color: #fff;
            box-shadow: 0 4px 14px rgba(47, 107, 255, 0.25);
          }
          #demo-${scenario.key}:checked ~ .demo-panels .demo-panel-${scenario.key} { display: block; }
        `
          )
          .join('')}
      `}</style>
      <div className="max-w-5xl mx-auto">
        <div className="text-center max-w-xl mx-auto mb-10 space-y-2">
          <div className="text-xs font-bold tracking-[2px] uppercase text-primary mb-2">บทสนทนาจำลอง</div>
          <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
            บอททำงานเป็นขั้นแบบนี้
          </h2>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            เลือกหัวข้อเพื่อดูลำดับที่บอททำได้จริง ข้อความด้านล่างเป็นตัวอย่างการทำงาน ไม่ใช่แชท ยอดขาย หรือรีวิวของลูกค้าจริง
          </p>
        </div>

        <div className="demo-switcher max-w-xl mx-auto">
          {ordered.map((scenario, index) => (
            <input
              key={scenario.key}
              id={`demo-${scenario.key}`}
              className="sr-only"
              type="radio"
              name="demo-scenario"
              defaultChecked={index === 0}
            />
          ))}

          <div className="demo-tabs flex flex-wrap items-center justify-center gap-2 mb-8">
            {ordered.map((scenario) => (
              <label
                key={scenario.key}
                htmlFor={`demo-${scenario.key}`}
                className="cursor-pointer px-3.5 py-2 rounded-full text-xs sm:text-sm font-semibold bg-slate-100 text-slate-700 border border-slate-200"
              >
                {scenario.label}
              </label>
            ))}
          </div>

          <div className="demo-panels">
            {ordered.map((scenario) => (
              <div key={scenario.key} className={`demo-panel demo-panel-${scenario.key}`}>
                <div className="bg-white rounded-3xl shadow-xl border border-slate-200/90 overflow-hidden">
                  <div className="bg-[#06C755] px-4 py-3.5 flex items-center gap-3 shadow-sm">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl shadow-inner">
                      {scenario.botEmoji}
                    </div>
                    <div>
                      <div className="text-white font-bold text-sm tracking-tight">{scenario.botName}</div>
                      <div className="text-emerald-100 text-xs flex items-center gap-1.5 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        ออนไลน์ 24 ชม.
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-50 border-b border-slate-200/80 px-4 py-2.5 text-xs text-slate-600 font-medium">
                    <div className="mb-1">
                      <span className="text-[11px] text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                        ตัวอย่าง
                      </span>
                    </div>
                    <p className="leading-relaxed">{scenario.subtitle}</p>
                  </div>
                  <div className="bg-[#ECE5DD] p-4 flex flex-col gap-2.5 max-h-[520px] overflow-y-auto">
                    {scenario.messages.map((msg, index) => (
                      <MessageBody key={`${scenario.key}-${index}`} msg={msg} />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-[14px] border border-[#2F6BFF]/20 bg-[#F4F7FB] px-5 py-6 text-center font-sans">
            <p className="text-xs font-bold tracking-wide text-[#2F6BFF]">ตัวอย่างด้านบน ไม่ใช่บอทที่ตอบคุณ</p>
            <h3 className="font-heading mt-2 text-xl font-semibold text-slate-900">อยากคุยกับบอทจริงของร้านคุณ</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-600">
              บทสนทนาในกรอบนี้เป็นตัวอย่างลำดับการทำงาน ปุ่มด้านล่างเปิดหน้าทดสอบสนทนาในแดชบอร์ด
              บอทตอบจากสินค้าและคลังความรู้ที่คุณใส่เอง
            </p>
            <div className="mt-4 flex justify-center">
              <TryRealBotLink size="lg" className="w-full sm:w-auto" />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              ถ้ายังไม่ได้เข้าสู่ระบบ ระบบจะพาไปสมัครหรือเข้าสู่ระบบ แล้วเปิดหน้าทดสอบสนทนาให้ทันที
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
