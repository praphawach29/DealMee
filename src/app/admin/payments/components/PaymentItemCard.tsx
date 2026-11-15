import React from 'react'
import {
  CheckCircle2,
  XCircle,
  Eye,
  FileText,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { PaymentItem } from './VerifyConfirmModal'

interface PaymentItemCardProps {
  payment: PaymentItem
  processingId: string | null
  onOpenSlip: (url: string) => void
  onApprove: (payment: PaymentItem) => void
  onReject: (paymentId: string) => void
}

export function PaymentItemCard({
  payment: p,
  processingId,
  onOpenSlip,
  onApprove,
  onReject,
}: PaymentItemCardProps) {
  const isPending = p.status === 'pending'
  const isVerified = p.status === 'verified' || p.status === 'succeeded'
  const isRejected = p.status === 'rejected'
  const isWithholding = Number(p.withheld_amount || 0) > 0

  return (
    <div
      className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 sm:p-5 transition-all shadow-xs ${
        isPending
          ? 'border-amber-400 dark:border-amber-500/50 ring-1 ring-amber-400/30'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Shop info and Plan */}
        <div className="flex items-start gap-3.5">
          {p.slip_url ? (
            <div
              onClick={() => onOpenSlip(p.slip_url || '')}
              className="relative w-16 h-20 sm:w-20 sm:h-24 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 cursor-pointer group"
              title="คลิกเพื่อดูรูปสลิปขยาย"
            >
              <img
                src={p.slip_url}
                alt="Slip"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                <Eye className="h-5 w-5" />
              </div>
            </div>
          ) : (
            <div className="w-16 h-20 sm:w-20 sm:h-24 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400 shrink-0 text-[10px] text-center p-1">
              ไม่มีรูปสลิป
            </div>
          )}

          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                {p.shop_name}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold uppercase text-[10px]">
                {p.plan_key === 'wallet_topup' ? 'เติมเงิน' : p.plan_key}
              </span>
            </div>

            <p className="text-slate-500 dark:text-slate-400 text-[11px]">
              วันที่โอน: {new Date(p.created_at).toLocaleString('th-TH')}
            </p>

            {/* Amount details */}
            <div className="flex flex-wrap items-baseline gap-2 pt-1 font-mono">
              <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                ฿{Number(p.transferred_amount || p.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </span>
              {isWithholding && (
                <span className="text-[11px] text-amber-600 font-semibold">
                  (หัก ณ ที่จ่าย 3%: ฿{Number(p.withheld_amount).toLocaleString()} / ยอดเต็ม ฿{Number(p.billed_amount).toLocaleString()})
                </span>
              )}
            </div>

            {/* Notes / References */}
            {p.slip_reference && (
              <p className="text-[11px] text-slate-400 font-mono">
                Ref: {p.slip_reference}
              </p>
            )}
            {p.customer_notes && (
              <p className="text-[11px] text-slate-600 dark:text-slate-300 italic bg-slate-50 dark:bg-slate-800 p-1.5 rounded-lg max-w-lg">
                Note: {p.customer_notes}
              </p>
            )}
            {p.rejected_reason && (
              <p className="text-[11px] text-rose-600 font-medium">
                เหตุผลที่ปฏิเสธ: {p.rejected_reason}
              </p>
            )}
          </div>
        </div>

        {/* Right: Status and Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
          {isPending && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => onApprove(p)}
                disabled={processingId === p.id}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {processingId === p.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                <span>อนุมัติ</span>
              </button>

              <button
                onClick={() => onReject(p.id)}
                disabled={processingId === p.id}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 font-bold text-xs border border-rose-200 dark:border-rose-900 transition-all cursor-pointer disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                <span>ปฏิเสธ</span>
              </button>
            </div>
          )}

          {isVerified && (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-emerald-600 font-bold text-xs bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                <span>อนุมัติแล้ว</span>
              </span>

              <a
                href={`/dashboard/billing/receipt/${p.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 transition-all"
                title="เปิดดูใบเสร็จรับเงิน"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>ใบเสร็จ: {p.receipt_number || 'ดูเอกสาร'}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {isRejected && (
            <span className="flex items-center gap-1 text-rose-600 font-bold text-xs bg-rose-50 dark:bg-rose-950/60 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900">
              <XCircle className="h-4 w-4" />
              <span>ปฏิเสธแล้ว</span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

