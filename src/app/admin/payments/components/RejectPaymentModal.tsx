import React from 'react'

interface RejectPaymentModalProps {
  rejectReason: string
  onReasonChange: (reason: string) => void
  onCancel: () => void
  onConfirm: () => void
}

export function RejectPaymentModal({
  rejectReason,
  onReasonChange,
  onCancel,
  onConfirm,
}: RejectPaymentModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-dialog-title"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="reject-dialog-title" className="font-heading font-semibold text-base text-slate-900 dark:text-white">
          ระบุเหตุผลการปฏิเสธสลิป
        </h3>
        <p className="text-xs text-slate-500">
          ข้อความนี้จะแสดงให้ร้านค้าเห็นในหน้าบิลเพื่อให้อัปโหลดสลิปใหม่
        </p>

        <textarea
          value={rejectReason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="เช่น ยอดเงินไม่ตรงกับแพ็กเกจ, สลิปซ้ำ, สลิปไม่ชัดเจน..."
          className="w-full h-24 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
        />

        <div className="flex gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!rejectReason.trim()}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
          >
            ยืนยันปฏิเสธ
          </button>
        </div>
      </div>
    </div>
  )
}

