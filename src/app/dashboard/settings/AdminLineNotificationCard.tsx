'use client'

import { useState, useEffect } from 'react'
import {
  Bell,
  CheckCircle2,
  QrCode,
  Smartphone,
  ExternalLink,
  RefreshCw,
  Send,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import {
  getAdminLinkDataAction,
  unlinkAdminAction,
  sendTestAdminNotificationAction,
  saveManualAdminLineIdAction,
} from './actions'

interface AdminLineNotificationCardProps {
  initialIsLinked?: boolean
  initialAdminName?: string | null
  initialAdminUserId?: string | null
  lineToken?: string | null
}

export default function AdminLineNotificationCard({
  initialIsLinked = false,
  initialAdminName = null,
  initialAdminUserId = null,
  lineToken,
}: AdminLineNotificationCardProps) {
  const [loading, setLoading] = useState(false)
  const [isLinked, setIsLinked] = useState(initialIsLinked)
  const [adminName, setAdminName] = useState(initialAdminName)
  const [adminUserId, setAdminUserId] = useState(initialAdminUserId)
  const [code, setCode] = useState<string>('')
  const [deepLink, setDeepLink] = useState<string>('')
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [basicId, setBasicId] = useState<string>('')
  const [oaName, setOaName] = useState<string>('')
  const [copiedCode, setCopiedCode] = useState(false)
  const [testResult, setTestResult] = useState<{ success?: string; error?: string } | null>(null)
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualId, setManualId] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  async function loadData() {
    setIsRefreshing(true)
    const res = await getAdminLinkDataAction()
    setIsRefreshing(false)
    if (res?.success) {
      setIsLinked(res.isLinked || false)
      setAdminName(res.adminName || null)
      setAdminUserId(res.adminUserId || null)
      setCode(res.code || '')
      setDeepLink(res.deepLink || '')
      setQrDataUrl(res.qrDataUrl || '')
      setBasicId(res.basicId || '')
      setOaName(res.oaName || '')
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleSendTest() {
    setLoading(true)
    setTestResult(null)
    const res = await sendTestAdminNotificationAction()
    setLoading(false)
    if (res?.error) {
      setTestResult({ error: res.error })
    } else {
      setTestResult({ success: 'ส่งแจ้งเตือนทดสอบเข้า LINE เรียบร้อยแล้ว!' })
    }
  }

  async function handleUnlink() {
    if (!confirm('คุณต้องการยกเลิกการเชื่อมต่อบัญชีแอดมินนี้ใช่หรือไม่? บอทจะไม่สามารถส่งแจ้งเตือนเข้า LINE แอดมินได้จนกว่าจะเชื่อมต่อใหม่')) {
      return
    }
    setLoading(true)
    setTestResult(null)
    const res = await unlinkAdminAction()
    setLoading(false)
    if (res?.success) {
      setIsLinked(false)
      setAdminName(null)
      setAdminUserId(null)
      loadData()
    }
  }

  async function handleSaveManual() {
    if (!manualId.trim()) return
    setLoading(true)
    setTestResult(null)
    const res = await saveManualAdminLineIdAction(manualId)
    setLoading(false)
    if (res?.error) {
      setTestResult({ error: res.error })
    } else {
      setTestResult({ success: res.success || 'บันทึกสำเร็จ' })
      setManualId('')
      setShowManualInput(false)
      loadData()
    }
  }

  function handleCopyCode() {
    if (!code) return
    navigator.clipboard.writeText(`/admin-link ${code}`)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  if (!lineToken) {
    return (
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2.5">
        <Bell className="w-4 h-4 shrink-0 text-amber-500" />
        <span>กรุณากรอกและบันทึก <b>LINE Channel Token</b> ด้านบนก่อน จึงจะสามารถเปิดใช้งานระบบแจ้งเตือนแอดมินได้</span>
      </div>
    )
  }

  return (
    <div className="bg-surface-container-low/70 border border-outline-variant/60 rounded-xl sm:rounded-2xl p-4 sm:p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant/30 pb-3.5">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isLinked ? 'bg-emerald-500/10 text-emerald-600' : 'bg-electric-blue/10 text-electric-blue'
          }`}>
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-on-surface font-headline-sm">
                การแจ้งเตือนแอดมินผ่าน LINE (Admin Push Alerts)
              </h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                isLinked
                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
              }`}>
                {isLinked ? '● เชื่อมต่อแล้ว' : 'รอเชื่อมต่อแอดมิน'}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-on-surface-variant mt-0.5">
              รับข้อความเตือนเมื่อมีออเดอร์ใหม่ สลิปโอนเงิน หรือลูกค้าขอคุยกับคนจริง ส่งตรงเข้า LINE ส่วนตัว
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={isRefreshing}
          className="self-start sm:self-auto text-xs text-on-surface-variant hover:text-on-surface flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-outline-variant/40 bg-surface hover:bg-surface-container transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>รีเฟรชสถานะ</span>
        </button>
      </div>

      {testResult && (
        <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
          testResult.error
            ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
            : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
        }`}>
          {testResult.error ? <span>⚠️ {testResult.error}</span> : <span>✅ {testResult.success}</span>}
        </div>
      )}

      {/* STATE 1: Already Linked */}
      {isLinked ? (
        <div className="space-y-4">
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-on-surface">{adminName || 'แอดมินร้านค้า'}</span>
                  <span className="text-[11px] text-emerald-600 font-semibold bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                    แอดมินผู้รับแจ้งเตือน
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant font-mono mt-0.5">
                  ID: {adminUserId ? `${adminUserId.slice(0, 10)}••••••••${adminUserId.slice(-6)}` : 'เชื่อมต่อเรียบร้อย'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={loading}
                onClick={handleSendTest}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-electric-blue hover:bg-electric-blue/90 text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{loading ? 'กำลังส่ง...' : 'ทดสอบส่งแจ้งเตือน'}</span>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={handleUnlink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/30 hover:bg-rose-500/10 text-rose-600 text-xs font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ยกเลิก</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-surface border border-outline-variant/30 text-xs">
              <span className="block font-bold text-on-surface">🛒 ออเดอร์ใหม่</span>
              <span className="text-[10px] text-emerald-600 font-semibold">แจ้งเตือนทันที</span>
            </div>
            <div className="p-2.5 rounded-xl bg-surface border border-outline-variant/30 text-xs">
              <span className="block font-bold text-on-surface">💰 สลิปโอนเงิน</span>
              <span className="text-[10px] text-emerald-600 font-semibold">แจ้งเตือนทันที</span>
            </div>
            <div className="p-2.5 rounded-xl bg-surface border border-outline-variant/30 text-xs">
              <span className="block font-bold text-on-surface">⚠️ สลิปยอดไม่ตรง</span>
              <span className="text-[10px] text-emerald-600 font-semibold">แจ้งเตือนทันที</span>
            </div>
            <div className="p-2.5 rounded-xl bg-surface border border-outline-variant/30 text-xs">
              <span className="block font-bold text-on-surface">🔔 ขอคุยกับคน</span>
              <span className="text-[10px] text-emerald-600 font-semibold">แจ้งเตือนทันที</span>
            </div>
          </div>
        </div>
      ) : (
        /* STATE 2: Not Linked -> Easy 1-Click / QR Code Binding */
        <div className="space-y-4">
          <div className="bg-surface border border-outline-variant/40 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row items-center gap-5">
            {/* Left: QR Code for Desktop */}
            {qrDataUrl && (
              <div className="flex flex-col items-center shrink-0 p-3 bg-white rounded-2xl border border-outline-variant/40 shadow-xs">
                <img
                  src={qrDataUrl}
                  alt="Scan to link admin"
                  className="w-36 h-36 sm:w-40 sm:h-40 rounded-lg object-contain"
                />
                <span className="text-[11px] text-slate-500 font-bold mt-2 flex items-center gap-1">
                  <QrCode className="w-3.5 h-3.5 text-[#06C755]" />
                  <span>สแกนด้วยกล้องมือถือ</span>
                </span>
              </div>
            )}

            {/* Right: Steps & 1-Click Mobile Button */}
            <div className="space-y-3 flex-1 text-center md:text-left">
              <div>
                <h4 className="text-sm sm:text-base font-bold text-on-surface">
                  วิธีผูกบัญชีแอดมินใน 1 วินาที (ง่ายสุดๆ ไม่ต้องหา ID)
                </h4>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                  สแกนด้วย LINE ส่วนตัวของแอดมิน QR จะเปิดแชทกับ LINE OA ของร้านพร้อมคำสั่งยืนยัน กดส่งครั้งเดียวก็เสร็จ
                  หลังจากนั้นแจ้งเตือนจะเข้ามาในแชทนี้ของ LINE ส่วนตัว
                </p>
              </div>

              {basicId ? (
                <p className="text-xs text-on-surface bg-[#06C755]/10 border border-[#06C755]/30 rounded-lg px-3 py-2">
                  QR นี้เปิดแชทกับ <b>{oaName || 'LINE OA ของร้าน'}</b> <span className="font-mono">@{basicId}</span>
                  {' '}ถ้าไม่ใช่ OA ของร้านนี้ ให้ตรวจ LINE Channel Token ด้านบน
                </p>
              ) : (
                <p className="text-xs text-rose-600 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  อ่านข้อมูล LINE OA จาก Channel Token ไม่ได้ (token ผิดหรือหมดอายุ) จึงสร้าง QR ไม่ได้ ตรวจ token ด้านบนแล้วกดรีเฟรชสถานะ
                </p>
              )}

              {/* 1-Click Action for Mobile */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5">
                {deepLink && (
                  <a
                    href={deepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-[#06C755]/20 active:scale-95"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>แตะเพื่อเปิด LINE และยืนยันแอดมินทันที</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}

                {code && (
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-surface hover:bg-surface-container border border-outline-variant rounded-xl text-xs font-semibold text-on-surface transition-all active:scale-95 cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'คัดลอกคำสั่งแล้ว' : `หรือพิมพ์: /admin-link ${code}`}</span>
                  </button>
                )}
              </div>

              <div className="text-[11px] text-on-surface-variant/80 bg-surface-container-low px-3 py-2 rounded-lg border border-outline-variant/30">
                💡 <b>คำแนะนำ:</b> เมื่อส่งข้อความใน LINE OA แล้ว บอทจะตอบกลับยืนยันและเริ่มส่งแจ้งเตือนออเดอร์ทันที
              </div>
            </div>
          </div>

          {/* Advanced Manual Input Dropdown */}
          <div className="border-t border-outline-variant/30 pt-2">
            <button
              type="button"
              onClick={() => setShowManualInput(!showManualInput)}
              className="text-xs text-on-surface-variant hover:text-on-surface flex items-center gap-1 transition-all cursor-pointer"
            >
              <span>ระบุ LINE User ID เองโดยตรง (สำหรับ Developer / ขั้นสูง)</span>
              {showManualInput ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showManualInput && (
              <div className="mt-2.5 flex items-center gap-2 max-w-lg">
                <input
                  type="text"
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  placeholder="เช่น Ueb339bc8a11b9707e733785002a9ca3e"
                  className="flex-1 px-3 py-2 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs font-mono outline-none focus:border-electric-blue focus:ring-1 focus:ring-electric-blue"
                />
                <button
                  type="button"
                  disabled={loading || !manualId.trim()}
                  onClick={handleSaveManual}
                  className="px-4 py-2 rounded-xl bg-electric-blue hover:bg-primary text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'กำลังบันทึก...' : 'บันทึก ID'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
