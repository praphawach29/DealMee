import React from 'react'
import { CheckCircle2, FileText } from 'lucide-react'

export interface PaymentItem {
  id: string
  shop_id: string
  plan_key: string
  amount: number
  billed_amount?: number | null
  withheld_amount?: number | null
  transferred_amount?: number | null
  currency: string
  status: 'pending' | 'verified' | 'rejected' | 'succeeded' | 'failed'
  slip_url?: string | null
  slip_reference?: string | null
  receipt_number?: string | null
  verified_at?: string | null
  verified_by?: string | null
  rejected_reason?: string | null
  customer_notes?: string | null
  created_at: string
  shop_name: string
  shop_bot_name?: string | null
  shops?: {
    name?: string | null
    bot_name?: string | null
  } | null
}

interface VerifyConfirmModalProps {
  payment: PaymentItem
  onCancel: () => void
  onConfirm: () => void
}

export function VerifyConfirmModal({
  payment,
  onCancel,
  onConfirm,
}: VerifyConfirmModalProps) {
  const isTopUp = payment.plan_key === 'wallet_topup'
  const billed = Number(payment.billed_amount ?? payment.amount ?? 0)
  const transferred = Number(payment.transferred_amount ?? payment.amount ?? 0)
  const withheld = Number(payment.withheld_amount || 0)
  const baht = (n: number) => `฿${n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="verify-confirm-title"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 flex items-center gap-3 bg-gradient-to-r from-emerald-700 to-teal-600 text-white">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 id="verify-confirm-title" className="font-heading font-semibold text-base">
              อนุมัติการชำระเงิน
            </h3>
            <p className="text-[11px] text-emerald-100 truncate">
              {payment.shop_name} · {isTopUp ? 'เติมเงินเข้ากระเป๋า' : `แพ็กเกจ ${payment.plan_key.toUpperCase()}`}
            </p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex gap-4 items-center">
            {payment.slip_url && (
              <a
                href={payment.slip_url}
                target="_blank"
                rel="noreferrer"
                className="w-16 h-20 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0"
                title="เปิดดูสลิป"
              >
                <img src={payment.slip_url} alt="สลิปการโอนเงิน" className="w-full h-full object-cover" />
              </a>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 dark:text-slate-400">{isTopUp ? 'ยอดเข้ากระเป๋า' : 'ยอดชำระ'}</p>
              <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{baht(billed)}</p>
              {withheld > 0 && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  โอนจริง {baht(transferred)} · หัก ณ ที่จ่าย {baht(withheld)}
                </p>
              )}
            </div>
          </div>

          <ul className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3.5 space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
            <li className="flex gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>
                {isTopUp
                  ? `เพิ่มเงิน ${baht(billed)} เข้ากระเป๋าของร้านทันที`
                  : 'ต่ออายุแพ็กเกจให้ร้านค้าอีก 30 วัน'}
              </span>
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>ออกเลขที่ใบเสร็จรับเงินให้อัตโนมัติ</span>
            </li>
            {payment.slip_reference && (
              <li className="flex gap-2 text-slate-500 dark:text-slate-400">
                <FileText className="h-4 w-4 shrink-0" />
                <span className="font-mono truncate">Ref: {payment.slip_reference}</span>
              </li>
            )}
          </ul>

          {payment.customer_notes && (
            <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-2.5 leading-relaxed">
              {payment.customer_notes}
            </p>
          )}

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer min-h-[44px]"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={onConfirm}
              autoFocus
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer min-h-[44px]"
            >
              ยืนยันอนุมัติ
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
