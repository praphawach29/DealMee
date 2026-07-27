'use client'

import { useState } from 'react'

interface UpgradeButtonProps {
  planKey: string
  provider: 'stripe' | 'omise'
  label: string
  className?: string
  onQrReady: (qrImageUrl: string) => void
}

export default function UpgradeButton({ planKey, provider, label, className, onQrReady }: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey, provider }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
        setLoading(false)
        return
      }

      if (data.url) {
        window.location.href = data.url
        return
      }

      if (data.qrImageUrl) {
        onQrReady(data.qrImageUrl)
        setLoading(false)
        return
      }

      setError('ไม่สามารถเริ่มการชำระเงินได้')
      setLoading(false)
    } catch {
      setError('เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={className}
      >
        {loading ? 'กำลังดำเนินการ...' : label}
      </button>
      {error && <p className="text-[11px] text-error-red">{error}</p>}
    </div>
  )
}
