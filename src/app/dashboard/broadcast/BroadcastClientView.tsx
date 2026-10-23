'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { getAudienceCount, sendBroadcast, type BroadcastItem, type AudienceCountResult } from './actions'
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
  const searchParams = useSearchParams()
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['line', 'facebook'])
  const [targetTag, setTargetTag] = useState('')
  const [prefKey, setPrefKey] = useState('')
  const [prefValue, setPrefValue] = useState('')
  const [title, setTitle] = useState(searchParams?.get('title') || '')
  const [message, setMessage] = useState(searchParams?.get('message') || '')
  const [previewTab, setPreviewTab] = useState<'line' | 'facebook'>('line')
  const [audienceData, setAudienceData] = useState<AudienceCountResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>(initialBroadcasts)

  useEffect(() => {
    const qTitle = searchParams?.get('title')
    const qMsg = searchParams?.get('message')
    if (qTitle) setTitle(qTitle)
    if (qMsg) setMessage(qMsg)
  }, [searchParams])

  const usedPercentage = Math.min(100, Math.round((pushQuotaInfo.usedCount / pushQuotaInfo.totalQuota) * 100))
  const remainingPercentage = 100 - usedPercentage

  useEffect(() => {
    let active = true
    getAudienceCount(targetTag, prefKey, prefValue, selectedChannels).then((res) => {
      if (active) setAudienceData(res)
    })
    return () => {
      active = false
    }
  }, [targetTag, prefKey, prefValue, selectedChannels])

  const toggleChannel = (channel: string) => {
    setSelectedChannels((prev) => {
      if (prev.includes(channel)) {
        if (prev.length === 1) return prev // keep at least 1
        return prev.filter((c) => c !== channel)
      } else {
        return [...prev, channel]
      }
    })
  }

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
    formData.append('channels', selectedChannels.join(','))

    const res = await sendBroadcast(formData)
    setLoading(false)

    if (res?.error) {
      alert(res.error)
    } else {
      const lineText = res.lineCount ? `LINE: ${res.lineCount} คน` : ''
      const fbText = res.facebookCount ? `Facebook: ${res.facebookCount} คน` : ''
      const breakdown = [lineText, fbText].filter(Boolean).join(', ')
      alert(`🎉 ส่งการบรอดแคสต์สำเร็จ!\nเข้าถึงลูกค้ารวม: ${res.count || 0} คน ${breakdown ? `(${breakdown})` : ''}`)
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
      {/* Omnichannel Quota & Status Banner */}
      <div className="bg-surface/90 backdrop-blur-xl rounded-2xl p-4 sm:p-5 shadow-sm border border-outline-variant/30 text-on-surface space-y-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-electric-blue/10 border border-electric-blue/20 flex items-center justify-center text-electric-blue shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-[20px] sm:text-[22px]">campaign</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-bold text-sm sm:text-base text-on-surface font-headline-md">
                  Omnichannel Broadcast Hub
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-electric-blue/10 text-electric-blue text-[10px] sm:text-xs font-semibold border border-electric-blue/20">
                  LINE OA & Facebook Messenger
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-on-surface-variant font-medium">
                บรอดแคสต์โปรโมชันตรงกลุ่มเป้าหมาย พร้อมรองรับมัลติแชนแนลในครั้งเดียว
              </p>
            </div>
          </div>

          {/* Quota Badge */}
          <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-right shrink-0">
            <div className="text-[11px] text-emerald-600 font-bold">โควต้า LINE Push</div>
            <div className="text-sm sm:text-base font-extrabold text-on-surface font-mono">
              {pushQuotaInfo.remainingCount.toLocaleString()}{' '}
              <span className="text-xs font-medium text-on-surface-variant">/ {pushQuotaInfo.totalQuota.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Quota Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs sm:text-sm font-semibold">
            <span className="text-on-surface-variant">
              LINE Push ใช้ไปแล้ว <span className="text-on-surface font-bold font-mono">{pushQuotaInfo.usedCount.toLocaleString()}</span> ข้อความ ({usedPercentage}%)
            </span>
            <span className="text-electric-blue font-bold">
              Facebook Messenger: <span className="text-blue-600 font-semibold">ไม่จำกัดโควต้า</span>
            </span>
          </div>
          <div className="w-full bg-surface-container-highest rounded-full h-2 overflow-hidden border border-outline-variant/40">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-electric-blue rounded-full transition-all duration-500"
              style={{ width: `${Math.max(3, remainingPercentage)}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Panel */}
        <div className="lg:col-span-2 p-5 sm:p-6 bg-surface rounded-2xl border border-outline-variant/40 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-on-surface flex items-center gap-2 font-headline-sm">
              <span className="material-symbols-outlined text-electric-blue">send</span>
              สร้างแคมเปญบรอดแคสต์มัลติแชนแนล
            </h2>
            <span className="text-[11px] text-outline font-medium">Step 3 Multi-Channel</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 text-xs">
            {/* 1. Channel Selector */}
            <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/30 space-y-2.5">
              <label className="block font-bold text-on-surface text-xs flex items-center justify-between">
                <span>เลือกช่องทางที่ต้องการส่ง (Channels):</span>
                <span className="text-[10px] text-on-surface-variant font-normal">คลิกเพื่อเลือกหรือยกเลิก</span>
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {/* LINE OA Button */}
                <button
                  type="button"
                  onClick={() => toggleChannel('line')}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all cursor-pointer ${
                    selectedChannels.includes('line')
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20'
                      : 'bg-surface border-outline-variant/50 text-outline opacity-60 hover:opacity-100'
                  }`}
                >
                  <span className="w-6 h-6 rounded-lg bg-[#06C755] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                    L
                  </span>
                  <div className="text-left min-w-0">
                    <p className="font-bold text-xs truncate">LINE OA</p>
                    <p className="text-[10px] text-outline truncate">Push API</p>
                  </div>
                  {selectedChannels.includes('line') && (
                    <span className="material-symbols-outlined text-[16px] text-emerald-600 ml-auto shrink-0">check_circle</span>
                  )}
                </button>

                {/* Facebook Messenger Button */}
                <button
                  type="button"
                  onClick={() => toggleChannel('facebook')}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all cursor-pointer ${
                    selectedChannels.includes('facebook')
                      ? 'bg-blue-500/10 border-blue-500/40 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/20'
                      : 'bg-surface border-outline-variant/50 text-outline opacity-60 hover:opacity-100'
                  }`}
                >
                  <span className="w-6 h-6 rounded-lg bg-[#1877F2] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                    FB
                  </span>
                  <div className="text-left min-w-0">
                    <p className="font-bold text-xs truncate">Facebook Page</p>
                    <p className="text-[10px] text-outline truncate">Messenger API</p>
                  </div>
                  {selectedChannels.includes('facebook') && (
                    <span className="material-symbols-outlined text-[16px] text-blue-600 ml-auto shrink-0">check_circle</span>
                  )}
                </button>

                {/* Omnichannel Combo indicator */}
                <div className="col-span-2 sm:col-span-1 p-3 rounded-xl bg-surface border border-outline-variant/30 flex items-center gap-2 text-xs">
                  <span className="material-symbols-outlined text-electric-blue text-[18px]">hub</span>
                  <div>
                    <p className="font-bold text-[11px] text-on-surface">โหมดส่งมัลติ</p>
                    <p className="text-[10px] text-outline">
                      {selectedChannels.length === 2 ? 'ครอบคลุมทุกช่องทาง' : selectedChannels[0]?.toUpperCase()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Target Audience Filters */}
            <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/30 space-y-3">
              <h3 className="font-heading font-semibold text-on-surface flex items-center gap-1.5 text-xs">
                <span className="material-symbols-outlined text-sm text-electric-blue">filter_alt</span>
                กรองกลุ่มเป้าหมาย (AI Memory Targeting)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-on-surface-variant mb-1">
                    Tag ประจำตัว (เช่น VIP, สนใจคอร์ส)
                  </label>
                  <input
                    type="text"
                    value={targetTag}
                    onChange={(e) => setTargetTag(e.target.value)}
                    placeholder="เว้นว่าง = ส่งหาลูกค้าทุกคน"
                    className="w-full px-3 py-2 border border-outline-variant rounded-xl bg-surface text-on-surface outline-none focus:border-electric-blue"
                  />
                </div>

                <div>
                  <label className="block font-medium text-on-surface-variant mb-1">
                    หัวข้อความชอบ (Pref Key)
                  </label>
                  <input
                    type="text"
                    value={prefKey}
                    onChange={(e) => setPrefKey(e.target.value)}
                    placeholder="เช่น employee_count"
                    className="w-full px-3 py-2 border border-outline-variant rounded-xl bg-surface text-on-surface outline-none focus:border-electric-blue"
                  />
                </div>

                <div>
                  <label className="block font-medium text-on-surface-variant mb-1">
                    ค่าความชอบ (Pref Value)
                  </label>
                  <input
                    type="text"
                    value={prefValue}
                    onChange={(e) => setPrefValue(e.target.value)}
                    placeholder="เช่น 10, กรุงเทพ"
                    className="w-full px-3 py-2 border border-outline-variant rounded-xl bg-surface text-on-surface outline-none focus:border-electric-blue"
                  />
                </div>
              </div>

              {/* Audience Breakdown Counter */}
              <div className="p-3 bg-electric-blue/10 rounded-xl border border-electric-blue/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-electric-blue text-[18px]">groups</span>
                  <span className="text-on-surface font-semibold text-xs">
                    ผู้รับข้อความคาดการณ์รวม:
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-extrabold text-electric-blue text-sm">
                    {audienceData !== null ? `${audienceData.total} คน` : 'กำลังคำนวณ...'}
                  </span>
                  {audienceData && (
                    <div className="text-[10px] text-on-surface-variant font-medium flex items-center gap-2 border-l border-electric-blue/30 pl-3">
                      <span className="text-emerald-600 font-bold">🟢 LINE: {audienceData.lineCount}</span>
                      <span className="text-blue-600 font-bold">🔵 FB: {audienceData.facebookCount}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Campaign Details */}
            <div className="space-y-3">
              <div>
                <label className="block font-bold text-on-surface mb-1">
                  ชื่อแคมเปญบรอดแคสต์
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="เช่น โปรโมชันลดพิเศษ 20% เฉพาะลูกค้า CheckMee ต้อนรับสิ้นเดือน"
                  className="w-full px-3 py-2 border border-outline-variant rounded-xl bg-surface text-on-surface outline-none focus:border-electric-blue"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-on-surface">
                    ข้อความที่ต้องการส่ง
                  </label>
                  <span className="text-[10px] text-outline">
                    {message.length} ตัวอักษร
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="พิมพ์ข้อความโปรโมชันหรือประกาศที่ต้องการส่งหาลูกค้า..."
                  className="w-full px-3 py-2 border border-outline-variant rounded-xl bg-surface text-on-surface outline-none focus:border-electric-blue leading-relaxed"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || selectedChannels.length === 0}
              className="w-full py-3 bg-electric-blue hover:bg-primary text-white font-bold rounded-xl transition-all shadow-md shadow-electric-blue/20 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <span className="material-symbols-outlined text-base">send</span>
              <span>
                {loading
                  ? 'กำลังส่งบรอดแคสต์สู่ช่องทาง...'
                  : `ส่งแคมเปญบรอดแคสต์ทันที (${selectedChannels.map((c) => c.toUpperCase()).join(' + ')})`}
              </span>
            </button>
          </form>
        </div>

        {/* Right Side: Interactive Preview & History */}
        <div className="space-y-6">
          {/* Live Message Preview Card */}
          <div className="p-4 sm:p-5 bg-surface rounded-2xl border border-outline-variant/40 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-semibold text-on-surface text-xs flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-electric-blue">visibility</span>
                ตัวอย่างข้อความแชท
              </h3>
              <div className="flex bg-surface-container rounded-lg p-0.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => setPreviewTab('line')}
                  className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                    previewTab === 'line' ? 'bg-[#06C755] text-white shadow-xs' : 'text-outline'
                  }`}
                >
                  LINE
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('facebook')}
                  className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                    previewTab === 'facebook' ? 'bg-[#1877F2] text-white shadow-xs' : 'text-outline'
                  }`}
                >
                  FB
                </button>
              </div>
            </div>

            {/* Mock Chat Bubble Container */}
            <div
              className={`p-3.5 rounded-xl border text-xs min-h-[140px] flex flex-col justify-end transition-all ${
                previewTab === 'line'
                  ? 'bg-[#8cabd9]/20 border-emerald-500/20'
                  : 'bg-blue-50/30 border-blue-500/20'
              }`}
            >
              <div className="flex items-end gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 shadow-xs"
                  style={{ backgroundColor: previewTab === 'line' ? '#06C755' : '#1877F2' }}
                >
                  {previewTab === 'line' ? 'L' : 'FB'}
                </div>
                <div
                  className={`p-3 rounded-2xl max-w-[85%] text-xs leading-relaxed shadow-xs whitespace-pre-wrap ${
                    previewTab === 'line'
                      ? 'bg-surface text-on-surface rounded-bl-xs border border-outline-variant/30'
                      : 'bg-[#1877F2] text-white rounded-bl-xs'
                  }`}
                >
                  {message.trim() || 'พิมพ์ข้อความในแบบฟอร์มเพื่อดูตัวอย่างข้อความที่ลูกค้าจะได้รับ...'}
                </div>
              </div>
              <div className="text-[9px] text-outline text-right mt-1.5">
                {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          {/* History Panel */}
          <div className="p-4 sm:p-5 bg-surface rounded-2xl border border-outline-variant/40 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-on-surface flex items-center gap-2 font-headline-sm">
              <span className="material-symbols-outlined text-outline">history</span>
              ประวัติการบรอดแคสต์
            </h2>

            {broadcasts.length > 0 ? (
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1 text-xs">
                {broadcasts.map((b) => {
                  const channels = b.channels || ['line']
                  return (
                    <div
                      key={b.id}
                      className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/30 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="font-bold text-on-surface truncate text-xs">{b.title}</h4>
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-500/10 text-emerald-600 rounded shrink-0">
                          {b.status}
                        </span>
                      </div>

                      <p className="text-[11px] text-on-surface-variant line-clamp-2 leading-relaxed">
                        {b.message}
                      </p>

                      {/* Channels & Stats footer */}
                      <div className="flex items-center justify-between text-[10px] text-outline pt-1.5 border-t border-outline-variant/20">
                        <div className="flex items-center gap-1">
                          {channels.includes('line') && (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-[#06C755]/10 text-[#06C755] border border-[#06C755]/20">
                              LINE
                            </span>
                          )}
                          {channels.includes('facebook') && (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-[#1877F2]/10 text-[#1877F2] border border-[#1877F2]/20">
                              FB
                            </span>
                          )}
                        </div>
                        <span>
                          ผู้รับ {b.success_count || b.recipient_count || 0} คน •{' '}
                          {new Date(b.created_at).toLocaleDateString('th-TH')}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-outline text-xs">
                <span className="material-symbols-outlined text-3xl mb-2">campaign</span>
                <p>ยังไม่มีประวัติการส่งบรอดแคสต์</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
