'use client'

import type { MarginReport } from './actions'

function formatThb(n: number): string {
  return n.toLocaleString('th-TH', { maximumFractionDigits: 0 })
}

function MarginBadge({ value }: { value: number }) {
  const isPositive = value >= 0
  return (
    <span
      className={`font-mono font-bold ${
        isPositive ? 'text-success-green' : 'text-error-red'
      }`}
    >
      {isPositive ? '+' : ''}
      {formatThb(value)}
    </span>
  )
}

export default function MarginManagement({ report }: { report: MarginReport }) {
  return (
    <div className="space-y-5 sm:space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-on-surface font-headline-md leading-tight">
          DealMee Margin Dashboard
        </h1>
        <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5 font-body-md">
          ต้นทุน AI ประมาณการเทียบกับรายได้แพ็กเกจ DealMee AI — เดือน {report.period}
        </p>
        <p className="text-[11px] text-outline mt-1">
          หมายเหตุ: ไม่มีข้อมูลย้อนหลังก่อนวันที่เริ่มเก็บ ai_provider_usage และเป็นตัวเลขประมาณการจากราคาต่อ token ที่ตั้งไว้ใน src/lib/billing/aiPricing.ts (ไม่ใช่ invoice จริงจาก provider)
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-surface border border-outline-variant/40 rounded-2xl p-4">
          <p className="text-[11px] text-on-surface-variant font-bold uppercase">รายได้รวม</p>
          <p className="text-lg font-bold text-on-surface font-mono mt-1">฿{formatThb(report.totals.revenueThb)}</p>
        </div>
        <div className="bg-surface border border-outline-variant/40 rounded-2xl p-4">
          <p className="text-[11px] text-on-surface-variant font-bold uppercase">ต้นทุน AI ประมาณการ</p>
          <p className="text-lg font-bold text-on-surface font-mono mt-1">฿{formatThb(report.totals.costThb)}</p>
        </div>
        <div className="bg-surface border border-outline-variant/40 rounded-2xl p-4">
          <p className="text-[11px] text-on-surface-variant font-bold uppercase">กำไร/ขาดทุนรวม</p>
          <p className="text-lg mt-1"><MarginBadge value={report.totals.marginThb} /></p>
        </div>
        <div className="bg-surface border border-outline-variant/40 rounded-2xl p-4">
          <p className="text-[11px] text-on-surface-variant font-bold uppercase">Margin %</p>
          <p className={`text-lg font-bold font-mono mt-1 ${report.totals.marginPct >= 0 ? 'text-success-green' : 'text-error-red'}`}>
            {report.totals.marginPct.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Per-Plan Table */}
      <div className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-5 shadow-sm">
        <h2 className="text-sm font-bold text-on-surface mb-3">สรุปตามแพ็กเกจ</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-on-surface-variant text-left border-b border-outline-variant/30">
                <th className="py-2 pr-4">แพ็กเกจ</th>
                <th className="py-2 pr-4">ราคา/เดือน</th>
                <th className="py-2 pr-4">จำนวนร้าน</th>
                <th className="py-2 pr-4">ข้อความที่ใช้</th>
                <th className="py-2 pr-4">ต้นทุน AI</th>
                <th className="py-2 pr-4">รายได้</th>
                <th className="py-2 pr-4">กำไร/ขาดทุน</th>
                <th className="py-2 pr-4">Margin %</th>
              </tr>
            </thead>
            <tbody>
              {report.plans.map((p) => (
                <tr key={p.planKey} className="border-b border-outline-variant/10">
                  <td className="py-2 pr-4 font-bold">{p.planName}</td>
                  <td className="py-2 pr-4 font-mono">฿{formatThb(p.price)}</td>
                  <td className="py-2 pr-4">{p.shopCount}</td>
                  <td className="py-2 pr-4 font-mono">{p.messages.toLocaleString()}</td>
                  <td className="py-2 pr-4 font-mono">฿{formatThb(p.costThb)}</td>
                  <td className="py-2 pr-4 font-mono">฿{formatThb(p.revenueThb)}</td>
                  <td className="py-2 pr-4"><MarginBadge value={p.marginThb} /></td>
                  <td className={`py-2 pr-4 font-mono ${p.marginPct >= 0 ? 'text-success-green' : 'text-error-red'}`}>
                    {p.marginPct.toFixed(1)}%
                  </td>
                </tr>
              ))}
              {report.plans.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-on-surface-variant">ยังไม่มีข้อมูลการใช้งานในเดือนนี้</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-Shop Drill-down */}
      <div className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-5 shadow-sm">
        <h2 className="text-sm font-bold text-on-surface mb-3">รายร้านค้า (เรียงจากขาดทุนมากสุด)</h2>
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-on-surface-variant text-left border-b border-outline-variant/30 sticky top-0 bg-surface">
                <th className="py-2 pr-4">ร้านค้า</th>
                <th className="py-2 pr-4">แพ็กเกจ</th>
                <th className="py-2 pr-4">ข้อความที่ใช้</th>
                <th className="py-2 pr-4">ต้นทุน AI</th>
                <th className="py-2 pr-4">รายได้</th>
                <th className="py-2 pr-4">กำไร/ขาดทุน</th>
              </tr>
            </thead>
            <tbody>
              {report.shops.map((s) => (
                <tr key={s.shopId} className="border-b border-outline-variant/10">
                  <td className="py-2 pr-4">{s.shopName}</td>
                  <td className="py-2 pr-4">{s.planKey}</td>
                  <td className="py-2 pr-4 font-mono">{s.messages.toLocaleString()}</td>
                  <td className="py-2 pr-4 font-mono">฿{formatThb(s.costThb)}</td>
                  <td className="py-2 pr-4 font-mono">฿{formatThb(s.revenueThb)}</td>
                  <td className="py-2 pr-4"><MarginBadge value={s.marginThb} /></td>
                </tr>
              ))}
              {report.shops.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-on-surface-variant">ยังไม่มีร้านค้า</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
