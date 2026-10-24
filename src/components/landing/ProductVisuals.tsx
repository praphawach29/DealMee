'use client'

import React from 'react'

/** Channels the sales bot actually replies on. */
const CHANNELS = [
  { name: 'LINE OA', color: '#06C755' },
  { name: 'Facebook Messenger', color: '#1877F2' },
  { name: 'Instagram', color: '#E4405F' },
] as const

function ChannelPill({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 shadow-card">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </span>
  )
}

function SampleNote({ children, tone = 'light' }: { children: React.ReactNode; tone?: 'light' | 'dark' }) {
  return (
    <p className={`text-center text-[11px] leading-relaxed ${tone === 'dark' ? 'text-white/55' : 'text-slate-500'}`}>
      {children}
    </p>
  )
}

/** Phone mock of a LINE OA thread. Copy is labeled as a sample, with no names, balances, or account numbers. */
export function HeroChatMock() {
  return (
    <div className="relative mx-auto w-full max-w-[400px]">
      <div className="rounded-[28px] border border-white/15 bg-[#0c1730]/80 p-2.5 shadow-card sm:p-3">
        <div className="overflow-hidden rounded-[22px] bg-white">
          <div className="flex items-center gap-2.5 bg-[#06C755] px-3 py-2.5 text-white">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-bold">บ</div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">บอทของร้าน</div>
              <div className="text-[11px] text-white/85">LINE OA · ตัวอย่างการทำงาน</div>
            </div>
          </div>
          <div className="space-y-2 bg-[#ECE5DD] px-3 py-3 text-[13px] leading-relaxed">
            <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-[#DCF8C6] px-3 py-2 text-slate-900">
              มีเสื้อตัวนี้ไหมครับ
            </div>
            <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-slate-800 shadow-sm">
              เจอในแคตตาล็อกของร้านค่ะ ส่งการ์ดสินค้าให้ดูราคาและสต็อกที่ร้านใส่ไว้
            </div>
            <div className="max-w-[92%] rounded-[14px] border border-slate-200 bg-white p-3 shadow-card">
              <div className="mb-2 flex h-16 items-center justify-center rounded-[10px] bg-primary/10 text-xs font-semibold text-primary">
                รูปสินค้าจากแคตตาล็อก
              </div>
              <div className="text-sm font-semibold text-slate-900">สินค้าในร้าน</div>
              <div className="mt-0.5 text-[11px] text-slate-500">ราคาและจำนวนคงเหลือ อ่านจากหน้ารายการสินค้า</div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-500">สต็อกในระบบ</span>
                <span className="font-semibold text-primary">ราคาตามที่ร้านตั้ง</span>
              </div>
              <div className="mt-2 rounded-[10px] bg-[#06C755] py-1.5 text-center text-xs font-semibold text-white">
                สั่งซื้อสินค้านี้
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-1.5">
        {CHANNELS.map((channel) => (
          <ChannelPill key={channel.name} name={channel.name} color={channel.color} />
        ))}
      </div>
      <div className="mt-3">
        <SampleNote tone="dark">ภาพจำลองแชทบน LINE ไม่ใช่บทสนทนาหรือยอดขายของลูกค้าจริง</SampleNote>
      </div>
    </div>
  )
}

const SETUP_STEPS = [
  {
    title: 'เชื่อมช่องทางแชท',
    body: 'ใส่ Token ของ LINE OA หรือเชื่อม Facebook Page ข้อความจาก Instagram เข้าทางแอป Meta เดียวกัน',
  },
  {
    title: 'ใส่ข้อมูลร้าน',
    body: 'แคตตาล็อกสินค้า คลังความรู้ เลขพร้อมเพย์ และเรตค่าส่งตามโซน',
  },
  {
    title: 'เปิดให้บอทตอบ',
    body: 'ตั้งชื่อบอทกับน้ำเสียงการตอบ แล้วบอทรับออเดอร์ ตรวจสลิป และออกใบเสนอราคาได้',
  },
]

/** Replaces the stock “connect every social app” illustration with the channels and setup that exist. */
export function SetupFlowMock() {
  return (
    <div className="w-full max-w-[440px] space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {CHANNELS.map((channel) => (
          <ChannelPill key={channel.name} name={channel.name} color={channel.color} />
        ))}
      </div>
      {SETUP_STEPS.map((step, index) => (
        <div key={step.title} className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-card">
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
              {index + 1}
            </span>
            <span className="text-sm font-semibold text-slate-900">{step.title}</span>
          </div>
          <p className="text-sm leading-relaxed text-slate-600">{step.body}</p>
        </div>
      ))}
      <SampleNote>ช่องทางที่บอทตอบได้วันนี้ คือ LINE, Facebook Messenger และ Instagram</SampleNote>
    </div>
  )
}

const ORDER_ROWS = [
  { status: 'รอชำระเงิน', tone: 'bg-amber-50 text-amber-700', detail: 'ออเดอร์ที่บอทสร้าง รอรูปสลิป' },
  { status: 'ชำระแล้ว', tone: 'bg-emerald-50 text-emerald-700', detail: 'สลิปตรวจผ่าน ระบบเปลี่ยนสถานะให้' },
  { status: 'จัดส่งแล้ว', tone: 'bg-sky-50 text-sky-700', detail: 'ร้านใส่เลขพัสดุ แล้วบอทส่งให้ลูกค้า' },
]

/** Layout of the merchant overview, without sample revenue, names, or percentages. */
export function DashboardMock() {
  return (
    <div className="w-full max-w-[520px] overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <div className="font-heading text-sm font-semibold text-slate-900">ภาพรวมร้านค้า</div>
          <div className="text-[11px] text-slate-500">แดชบอร์ดของร้าน · โครงตัวอย่าง</div>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">ผู้ช่วย AI</span>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2 rounded-[14px] border border-slate-200 px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-semibold text-slate-800">พนักงาน AI กำลังทำงาน</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {['คำสั่งซื้อ', 'ยอดขายรวม', 'อัตราชำระเงิน', 'สินค้าใกล้หมด'].map((label) => (
            <div key={label} className="rounded-[14px] border border-slate-200 px-3 py-2">
              <div className="text-[11px] text-slate-500">{label}</div>
              <div className="font-heading text-lg font-semibold text-slate-300">—</div>
            </div>
          ))}
        </div>
        <div className="rounded-[14px] border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center">
          <div className="text-xs font-semibold text-slate-800">กราฟยอดขาย</div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            เทียบออเดอร์ที่ชำระแล้วหรือจัดส่งแล้ว กับช่วงก่อนหน้า เส้นกราฟมาจากออเดอร์ของร้านนั้น
          </p>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-800">คำสั่งซื้อล่าสุด</div>
          {ORDER_ROWS.map((row) => (
            <div key={row.status} className="flex items-center justify-between gap-2 rounded-[12px] bg-slate-50 px-3 py-2">
              <span className="text-[11px] text-slate-600">{row.detail}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${row.tone}`}>{row.status}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-slate-200 bg-slate-50 px-4 py-2">
        <SampleNote>ไม่ใส่ตัวเลข ชื่อลูกค้า หรือยอดขายตัวอย่าง ข้อมูลจริงอยู่ที่ร้านของแต่ละคน</SampleNote>
      </div>
    </div>
  )
}

/** The LINE push the shop admin actually receives, with the fields and none of the values. */
export function AdminAlertMock() {
  return (
    <div className="w-full max-w-[280px]">
      <div className="overflow-hidden rounded-[14px] border border-white/15 bg-white text-slate-900 shadow-card">
        <div className="bg-[#06C755] px-3 py-2 text-xs font-semibold text-white">LINE ของแอดมิน</div>
        <div className="space-y-2 p-3 text-[13px] leading-relaxed">
          <div className="rounded-2xl rounded-tl-sm bg-slate-100 px-3 py-2">
            <div className="font-semibold">มีออเดอร์ใหม่เข้ามา</div>
            <div className="mt-1 text-[12px] text-slate-600">
              เลขที่ออเดอร์
              <br />
              ชื่อและเบอร์จากแชท
              <br />
              รายการสินค้า
              <br />
              ยอดที่ระบบคำนวณ
            </div>
          </div>
          <div className="rounded-2xl rounded-tl-sm bg-slate-100 px-3 py-2">
            <div className="font-semibold">ลูกค้าชำระเงินแล้ว</div>
            <div className="mt-1 text-[12px] text-slate-600">หลังสลิปตรวจผ่านกับผู้ให้บริการตรวจสลิป</div>
          </div>
          <div className="rounded-2xl rounded-tl-sm bg-slate-100 px-3 py-2">
            <div className="font-semibold">มีลูกค้าขอคุยกับคน</div>
            <div className="mt-1 text-[12px] text-slate-600">บอทหยุดตอบในแชทนั้น และเปิดลิงก์กล่องข้อความ</div>
          </div>
        </div>
      </div>
      <div className="mt-3">
        <SampleNote tone="dark">รูปแบบข้อความที่ระบบส่งเข้า LINE ของแอดมิน ไม่ใช่รายการออเดอร์จริง</SampleNote>
      </div>
    </div>
  )
}
