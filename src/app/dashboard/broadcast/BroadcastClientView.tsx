'use client'

import { useState, useEffect } from 'react'
import { getAudienceCount, sendBroadcast, type BroadcastItem } from './actions'

import { PushQuotaInfo } from '@/lib/billing/pushQuota'

interface BroadcastClientViewProps {
  initialBroadcasts: BroadcastItem[]
  pushQuotaInfo?: PushQuotaInfo
}

export default function BroadcastClientView({
  initialBroadcasts,
  pushQuotaInfo = {
    totalQuota: 300,
    usedCount: 0,
    remainingCount: 300,
    period: new Date().toISOString().slice(0, 7),
    planName: 'PRO',
  },
}: BroadcastClientViewProps) {
  const [targetTag, setTargetTag] = useState('')
  const [prefKey, setPrefKey] = useState('')
  const [prefValue, setPrefValue] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [audienceCount, setAudienceCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>(initialBroadcasts)

  const usedPercentage = Math.min(100, Math.round((pushQuotaInfo.usedCount / pushQuotaInfo.totalQuota) * 100))
  const remainingPercentage = 100 - usedPercentage

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
    <div className="space-y-6">
      {/* LINE Push Quota Status Banner (Mobile Perfect) */}
      <div className="bg-gradient-to-br from-emerald-950/90 via-slate-900/95 to-slate-900 backdrop-blur-xl rounded-2xl p-4 sm:p-5 shadow-md border border-emerald-500/30 text-white space-y-3.5">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-md shadow-emerald-500/10">
              <span className="material-symbols-outlined text-[20px] sm:text-[22px]">send</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-bold text-sm sm:text-base text-white">
                  โควต้า LINE Push
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] sm:text-xs font-medium border border-slate-700">
                  {pushQuotaInfo.period}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 font-medium">
                แพ็กเกจ {pushQuotaInfo.planName}
              </p>
            </div>
          </div>

          {/* Quota Badge */}
          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-right shrink-0">
            <div className="text-[10px] text-emerald-400 font-medium">คงเหลือ</div>
            <div className="text-xs sm:text-sm font-extrabold text-emerald-300">
              {pushQuotaInfo.remainingCount.toLocaleString()} <span className="text-[10px] font-normal text-emerald-400/80">/ {pushQuotaInfo.totalQuota.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Description & Note */}
        <div className="text-[11px] sm:text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 sm:p-3 rounded-xl border border-slate-800/80">
          โควต้าข้อความสำหรับยิงบรอดแคสต์โปรโมชัน{' '}
          <span className="text-emerald-400 font-semibold block sm:inline mt-0.5 sm:mt-0">
            (ตอบแชท AI ปกติใช้ Reply API ฟรี 100% ไม่ถูกหักโควต้านี้)
          </span>
        </div>

        {/* Quota Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[10px] sm:text-xs text-slate-400">
            <span>ใช้ไปแล้ว {pushQuotaInfo.usedCount.toLocaleString()} ข้อความ ({usedPercentage}%)</span>
            <span>คงเหลือ {remainingPercentage}%</span>
          </div>
          <div className="w-full bg-slate-800/90 rounded-full h-2 overflow-hidden border border-slate-700/60">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                remainingPercentage > 50
                  ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                  : remainingPercentage > 15
                  ? 'bg-amber-400 shadow-sm shadow-amber-400/50'
                  : 'bg-red-500 shadow-sm shadow-red-500/50'
              }`}
              style={{ width: `${Math.max(2, remainingPercentage)}%` }}
            ></div>
          </div>
        </div>
      </div>

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
  </div>
)
}
