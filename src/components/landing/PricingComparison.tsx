'use client'

import React from 'react'
import { comparisonRows } from './data'
import { Check, Minus } from 'lucide-react'

export default function PricingComparison() {
  const categories = Array.from(new Set(comparisonRows.map((r) => r.category)))

  return (
    <section id="comparison" className="py-20 px-4 sm:px-6 lg:px-8 bg-white border-t border-slate-200/80">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-xl mx-auto mb-12 space-y-2">
          <div className="text-xs font-bold tracking-[2px] uppercase text-blue-600 mb-2">
            เปรียบเทียบ
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            ตารางเปรียบเทียบทุกฟีเจอร์
          </h3>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            เทียบความสามารถของแต่ละแพ็กเกจแบบชัดเจน เพื่อการตัดสินใจที่คุ้มค่าที่สุด
          </p>
        </div>

        {/* Comparison Table Container */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
          <table className="w-full text-left border-collapse min-w-[700px]">
            {/* Table Header */}
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs sm:text-sm text-slate-600 font-bold uppercase tracking-wider">
                <th className="py-4 px-6 w-2/5">ฟีเจอร์</th>
                <th className="py-4 px-4 text-center w-[15%] text-slate-900 font-bold">
                  Starter
                  <div className="text-xs font-normal text-slate-500 normal-case mt-0.5">฿599/ด.</div>
                </th>
                <th className="py-4 px-4 text-center w-[15%] text-blue-600 bg-blue-50/50 font-bold">
                  Pro ⭐
                  <div className="text-xs font-bold text-blue-600 normal-case mt-0.5">฿1,290/ด.</div>
                </th>
                <th className="py-4 px-4 text-center w-[15%] text-slate-900 font-bold">
                  Business
                  <div className="text-xs font-normal text-slate-500 normal-case mt-0.5">฿2,490/ด.</div>
                </th>
                <th className="py-4 px-4 text-center w-[15%] text-slate-900 font-bold">
                  Enterprise
                  <div className="text-xs font-normal text-slate-500 normal-case mt-0.5">฿4,990/ด.</div>
                </th>
              </tr>
            </thead>

            {/* Table Body Grouped by Category */}
            <tbody className="divide-y divide-slate-200 text-sm">
              {categories.map((cat) => {
                const rows = comparisonRows.filter((r) => r.category === cat)
                return (
                  <React.Fragment key={cat}>
                    {/* Category Header Row */}
                    <tr className="bg-slate-100/80">
                      <td
                        colSpan={5}
                        className="py-2.5 px-6 font-bold text-xs text-slate-700 uppercase tracking-wide"
                      >
                        {cat}
                      </td>
                    </tr>

                    {/* Category Items */}
                    {rows.map((row) => (
                      <tr
                        key={row.label}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="py-3.5 px-6">
                          <div className="font-semibold text-slate-900 text-sm">{row.label}</div>
                          {row.description && (
                            <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                              {row.description}
                            </div>
                          )}
                        </td>

                        {/* Starter */}
                        <td className="py-3.5 px-4 text-center font-medium text-slate-700">
                          {renderCellValue(row.starter)}
                        </td>

                        {/* Pro (Highlighted) */}
                        <td className="py-3.5 px-4 text-center font-medium text-slate-900 bg-blue-50/30">
                          {renderCellValue(row.standard)}
                        </td>

                        {/* Business */}
                        <td className="py-3.5 px-4 text-center font-medium text-slate-700">
                          {renderCellValue(row.elite)}
                        </td>

                        {/* Enterprise */}
                        <td className="py-3.5 px-4 text-center font-medium text-slate-700">
                          {renderCellValue(row.enterprise)}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function renderCellValue(val: string | boolean) {
  if (typeof val === 'boolean') {
    return val ? (
      <div className="flex justify-center text-emerald-600">
        <Check className="w-4 h-4 stroke-[2.5]" />
      </div>
    ) : (
      <div className="flex justify-center text-slate-300">
        <Minus className="w-4 h-4" />
      </div>
    )
  }
  return <span className="font-mono text-xs sm:text-sm font-semibold text-slate-800">{val}</span>
}
