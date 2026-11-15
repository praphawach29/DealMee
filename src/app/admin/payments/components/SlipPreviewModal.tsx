import React from 'react'

interface SlipPreviewModalProps {
  slipUrl: string
  onClose: () => void
}

export function SlipPreviewModal({ slipUrl, onClose }: SlipPreviewModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-lg w-full bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl p-4 border border-slate-200 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
          <span className="font-heading font-semibold text-sm text-slate-800 dark:text-slate-200">
            หลักฐานการโอนเงิน (สลิป)
          </span>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold px-2 py-1"
          >
            ✕ ปิด
          </button>
        </div>
        <div className="mt-4 flex items-center justify-center max-h-[70vh] overflow-auto rounded-2xl bg-slate-100 dark:bg-slate-950/50 p-2">
          <img
            src={slipUrl}
            alt="หลักฐานการชำระเงิน"
            className="max-h-[65vh] object-contain rounded-xl"
          />
        </div>
      </div>
    </div>
  )
}

