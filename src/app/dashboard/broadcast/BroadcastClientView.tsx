'use client'

import { useState, useEffect } from 'react'
import { getAudienceCount, sendBroadcast, type BroadcastItem } from './actions'

interface BroadcastClientViewProps {
  initialBroadcasts: BroadcastItem[]
}

export default function BroadcastClientView({ initialBroadcasts }: BroadcastClientViewProps) {
  const [targetTag, setTargetTag] = useState('')
  const [prefKey, setPrefKey] = useState('')
  const [prefValue, setPrefValue] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [audienceCount, setAudienceCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>(initialBroadcasts)

  useEffect(() => {
    let active = true
    getAudienceCount(targetTag, prefKey, prefValue).then((count) => {
      if (active) setAudienceCount(count)
    })
    return () => {
      active = false
    }
  }, [targetTag, prefKey, prefValue])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !message.trim() || loading) return

    setLoading(true)
    const formData = new FormData()
    formData.append('title', title)
    formData.append('message', message)
    formData.append('targetTag', targetTag)
    formData.append('prefKey', prefKey)
    formData.append('prefValue', prefValue)

    const res = await sendBroadcast(formData)
    setLoading(false)

    if (res?.error) {
      alert(res.error)
    } else {
      alert(`ส่งการบรอดแคสต์สำเร็จ! เข้าถึงลูกค้า ${res.count} ราย`)
      setTitle('')
      setMessage('')
      setTargetTag('')
      setPrefKey('')
      setPrefValue('')
      window.location.reload()
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Form Panel */}
      <div className="lg:col-span-2 p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <span className="material-symbols-outlined text-electric-blue">campaign</span>
          สร้างแคมเปญบรอดแคสต์ใหม่
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Target Audience Filters */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
            <h3 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-indigo-500">filter_alt</span>
              กรองกลุ่มเป้าหมาย (Audience Targeting)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Tag ประจำตัว (เช่น VIP)
                </label>
                <input
                  type="text"
                  value={targetTag}
                  onChange={(e) => setTargetTag(e.target.value)}
                  placeholder="เช่น VIP, เสื้อผ้า"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  หัวข้อความชอบ (Pref Key)
                </label>
                <input
                  type="text"
                  value={prefKey}
                  onChange={(e) => setPrefKey(e.target.value)}
                  placeholder="เช่น shirt_size"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  ค่าความชอบ (Pref Value)
                </label>
                <input
                  type="text"
                  value={prefValue}
                  onChange={(e) => setPrefValue(e.target.value)}
                  placeholder="เช่น XL, สีดำ"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Audience Counter */}
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-900 flex items-center justify-between">
              <span className="text-blue-700 dark:text-blue-300 font-medium">
                จำนวนผู้รับข้อความคาดการณ์:
              </span>
              <span className="font-bold text-blue-900 dark:text-blue-100 text-sm">
                {audienceCount !== null ? `${audienceCount} คน` : 'กำลังคำนวณ...'}
              </span>
            </div>
          </div>

          {/* Campaign Details */}
          <div className="space-y-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                ชื่อแคมเปญบรอดแคสต์
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="เช่น โปรโมชันพิเศษเฉพาะลูกค้า VIP ต้อนรับเดือนนี้"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                ข้อความที่ต้องการส่ง (LINE Text Message)
              </label>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="พิมพ์ข้อความโปรโมชันที่ต้องการส่งหาลูกค้า..."
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || audienceCount === 0}
            className="w-full py-3 bg-electric-blue hover:bg-primary text-white font-bold rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed text-xs flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-base">send</span>
            <span>{loading ? 'กำลังส่งบรอดแคสต์...' : 'ส่งแคมเปญบรอดแคสต์ทันที'}</span>
          </button>
        </form>
      </div>

      {/* History Panel */}
      <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <span className="material-symbols-outlined text-slate-500">history</span>
          ประวัติการบรอดแคสต์
        </h2>

        {broadcasts.length > 0 ? (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 text-xs">
            {broadcasts.map((b) => (
              <div
                key={b.id}
                className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 truncate">{b.title}</h4>
                  <span className="px-2 py-0.5 text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded">
                    {b.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">{b.message}</p>
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                  <span>ผู้รับ {b.recipient_count} คน</span>
                  <span>{new Date(b.created_at).toLocaleDateString('th-TH')}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs">
            <span className="material-symbols-outlined text-3xl mb-2">campaign</span>
            <p>ยังไม่มีประวัติการส่งบรอดแคสต์</p>
          </div>
        )}
      </div>
    </div>
  )
}
