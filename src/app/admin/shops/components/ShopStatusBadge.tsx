import React from 'react'

export function ShopStatusBadge({ status }: { status: string | null }) {
  const isSuspended = status === 'suspended'
  return (
    <span
      className={`text-[10px] sm:text-[11px] font-bold px-2.5 py-1 rounded-full uppercase shrink-0 ${
        isSuspended
          ? 'bg-error-red/10 text-error-red border border-error-red/20'
          : 'bg-success-green/10 text-success-green border border-success-green/20'
      }`}
    >
      {isSuspended ? 'ระงับชั่วคราว' : 'เปิดใช้งาน'}
    </span>
  )
}

