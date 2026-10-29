'use client'

import { useEffect, useState } from 'react'

type ToolStat = {
  tool_name: string
  total_calls: number
  successful_calls: number
  failed_calls: number
  avg_duration_ms: number | null
  last_used_at: string | null
}

type Summary = {
  totalCalls: number
  totalSuccess: number
  totalFailed: number
  successRate: number
}

export default function ToolAnalyticsPage() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [stats, setStats] = useState<ToolStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/shop/tool-analytics')
        if (res.ok) {
          const data = await res.json()
          setSummary(data.summary)
          setStats(data.stats ?? [])
        }
      } catch { /* ignore */ }
      setLoading(false)
    })()
  }, [])

  if (loading) return <div className="p-6 text-gray-400">กำลังโหลด...</div>

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <h1 className="text-2xl font-bold mb-2">📊 Tool Usage Analytics</h1>
      <p className="text-sm text-gray-500 mb-6">สถิติการใช้งาน tools ของบอท</p>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="border rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{summary.totalCalls}</div>
            <div className="text-xs text-gray-500">Total Calls</div>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{summary.totalSuccess}</div>
            <div className="text-xs text-gray-500">Successful</div>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-red-600">{summary.totalFailed}</div>
            <div className="text-xs text-gray-500">Failed</div>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-purple-600">{summary.successRate}%</div>
            <div className="text-xs text-gray-500">Success Rate</div>
          </div>
        </div>
      )}

      {/* Tool table */}
      {stats.length === 0 ? (
        <p className="text-gray-400">ยังไม่มีข้อมูลการใช้งาน tools</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left p-2 border">Tool</th>
                <th className="text-right p-2 border">Calls</th>
                <th className="text-right p-2 border">Success</th>
                <th className="text-right p-2 border">Failed</th>
                <th className="text-right p-2 border">Avg (ms)</th>
                <th className="text-right p-2 border">Last Used</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.tool_name} className="hover:bg-gray-50">
                  <td className="p-2 border font-mono text-xs">{s.tool_name}</td>
                  <td className="p-2 border text-right">{s.total_calls}</td>
                  <td className="p-2 border text-right text-green-600">{s.successful_calls}</td>
                  <td className="p-2 border text-right text-red-600">{s.failed_calls}</td>
                  <td className="p-2 border text-right">{s.avg_duration_ms ?? '-'}</td>
                  <td className="p-2 border text-right text-xs text-gray-400">
                    {s.last_used_at ? new Date(s.last_used_at).toLocaleDateString('th-TH') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
