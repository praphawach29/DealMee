'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

type Usage = {
  byok: { enabled: boolean; provider: string | null; keyHint: string | null }
  usage: { month: string; aiCalls: number; estimatedCostUsd: number; estimatedCostThb: number }
}

export default function CostMonitor({ shopId }: { shopId?: string; enabled?: boolean }) {
  const [data, setData] = useState<Usage | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/shop/byok/usage')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="animate-spin" size={16} /> กำลังโหลด</div>

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Cost Monitor</h1>
        <p className="mt-1 text-sm text-slate-600">ต้นทุน AI และการใช้งานรายเดือน</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">AI Calls (เดือนนี้)</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{data?.usage.aiCalls ?? 0}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">ต้นทุนโดยประมาณ (THB)</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{data?.usage.estimatedCostThb ?? 0}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">BYOK</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{data?.byok.enabled ? '✅ เปิด' : '❌ ปิด'}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Provider</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{data?.byok.provider || 'Platform'}</div>
        </div>
      </div>

      {data?.byok.enabled && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          BYOK เปิดใช้งาน — ใช้ {data.byok.provider} (key: ...{data.byok.keyHint})
          ต้นทุน AI จ่ายโดยตรงกับ provider ไม่ผ่าน DealMee
        </div>
      )}
    </div>
  )
}
