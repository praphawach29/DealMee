import React from 'react'
import { PlanItem } from '@/app/admin/actions'

interface PlanCardProps {
  plan: PlanItem
  shopCount: number
  onEdit: (plan: PlanItem) => void
}

export function PlanCard({ plan, shopCount, onEdit }: PlanCardProps) {
  const isUnlimitedMsg = plan.messages < 0
  const isUnlimitedSlips = plan.slips < 0

  return (
    <div className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-all">
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
              plan.badge_color || 'bg-surface-container-high text-on-surface'
            }`}
          >
            {plan.name}
          </span>
          <span className="text-xs font-bold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
            {shopCount} ร้านค้า
          </span>
        </div>

        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-on-surface font-headline-md">
              ฿{plan.price.toLocaleString()}
            </span>
            <span className="text-xs text-outline font-medium">/ เดือน</span>
          </div>
          <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
            {plan.description}
          </p>
        </div>

        <div className="pt-3 border-t border-outline-variant/30 space-y-2 text-xs text-on-surface">
          <div className="flex items-center justify-between">
            <span className="text-on-surface-variant">โควต้าข้อความ:</span>
            <strong className="font-mono">
              {isUnlimitedMsg ? 'ไม่จำกัด' : `${plan.messages.toLocaleString()} ข้อความ`}
            </strong>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-on-surface-variant">ตรวจสลิปอัตโนมัติ:</span>
            <strong className="font-mono">
              {isUnlimitedSlips ? 'ไม่จำกัด' : `${plan.slips.toLocaleString()} ครั้ง`}
            </strong>
          </div>
        </div>

        {/* Features List */}
        {plan.features && plan.features.length > 0 && (
          <div className="pt-3 border-t border-outline-variant/30 space-y-1.5">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
              ฟีเจอร์เด่น:
            </span>
            <ul className="space-y-1">
              {plan.features.map((feat: string, idx: number) => (
                <li key={idx} className="flex items-center gap-2 text-xs text-on-surface">
                  <span className="material-symbols-outlined text-[16px] text-success-green shrink-0">
                    check_circle
                  </span>
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => onEdit(plan)}
        className="w-full py-2.5 px-4 bg-surface-container-high hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/30 text-on-surface font-bold text-xs rounded-xl transition-all border border-outline-variant/40 cursor-pointer flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined text-[16px]">edit</span>
        <span>แก้ไขรายละเอียดแพ็กเกจ</span>
      </button>
    </div>
  )
}

