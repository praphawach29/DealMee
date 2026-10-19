'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BellRing, Check, Copy, ExternalLink, KeyRound, Loader2, RefreshCw, Send, Unlink } from 'lucide-react'
import {
  savePlatformLineChannelAction,
  sendTestPlatformAlertAction,
  unlinkPlatformLineAdminAction,
  type PlatformLineStatus,
} from '../payments/actions'

const inputClass =
  'w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500'

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
          done ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
        }`}
      >
        {done ? <Check className="h-4 w-4" /> : n}
      </div>
      <div className="flex-1 min-w-0 space-y-2.5 pb-1">
        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white pt-1">{title}</p>
        {children}
      </div>
    </div>
  )
}

export default function PlatformLineAlertsCard({ status, webhookUrl }: { status: PlatformLineStatus; webhookUrl: string }) {
  const router = useRouter()
  const [accessToken, setAccessToken] = useState('')
  const [channelSecret, setChannelSecret] = useState('')
  const [busy, setBusy] = useState<'save' | 'test' | 'unlink' | 'refresh' | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    } catch {}
  }

  const handleSave = async () => {
    setBusy('save')
    setNotice(null)
    const res = await savePlatformLineChannelAction({ accessToken, channelSecret })
    setBusy(null)
    if (res.success) {
      setAccessToken('')
      setChannelSecret('')
      setNotice({ ok: true, text: `เชื่อมต่อ LINE OA @${res.basicId} แล้ว` })
      router.refresh()
    } else {
      setNotice({ ok: false, text: res.error || 'บันทึกไม่สำเร็จ' })
    }
  }

  const handleTest = async () => {
    setBusy('test')
    setNotice(null)
    const res = await sendTestPlatformAlertAction()
    setBusy(null)
    setNotice(res.success ? { ok: true, text: 'ส่งข้อความทดสอบแล้ว ลองเปิด LINE ดูครับ' } : { ok: false, text: res.error || 'ส่งไม่สำเร็จ' })
  }

  const handleUnlink = async () => {
    setBusy('unlink')
    setNotice(null)
    await unlinkPlatformLineAdminAction()
    setBusy(null)
    router.refresh()
  }

  const refresh = () => {
    setBusy('refresh')
    router.refresh()
    setTimeout(() => setBusy(null), 1500)
  }

  return (
    <div className="max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
          <BellRing className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">LINE แจ้งเตือนการชำระเงิน</h3>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                status.linked
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {status.linked ? 'พร้อมแจ้งเตือน' : status.connected ? 'รอผูก LINE ของคุณ' : 'ยังไม่ได้เชื่อมต่อ'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            ใช้ LINE OA แยกของ DealMee ส่งแจ้งเตือนเข้า LINE ส่วนตัวของคุณ เมื่อร้านค้าเติมเงินสำเร็จหรือมีสลิปรอตรวจ
          </p>
        </div>
      </div>

      {!status.ready ? (
        <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-3">
          ยังไม่ได้รัน SQL สำหรับส่วนนี้ (migration 20261023000000_platform_line_alerts.sql) รันใน Supabase SQL Editor แล้วรีเฟรชหน้านี้
        </p>
      ) : (
        <div className="space-y-5">
          <Step n={1} title="ใส่ข้อมูลช่องทาง LINE OA (LINE Developers → Messaging API)" done={status.connected}>
            {status.connected && (
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                เชื่อมต่อ @{status.basicId} แล้ว กรอกใหม่เฉพาะเมื่อต้องการเปลี่ยน
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="password"
                autoComplete="off"
                placeholder="Channel Access Token"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                className={inputClass}
              />
              <input
                type="password"
                autoComplete="off"
                placeholder="Channel Secret"
                value={channelSecret}
                onChange={(e) => setChannelSecret(e.target.value)}
                className={inputClass}
              />
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={busy !== null || !accessToken.trim() || !channelSecret.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer min-h-[40px]"
            >
              {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              <span>บันทึกและตรวจสอบ</span>
            </button>
          </Step>

          <Step n={2} title="ใส่ Webhook URL นี้ใน LINE Developers แล้วกด Verify และเปิด Use webhook" done={status.linked}>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-3 pr-1.5 py-1.5">
              <code className="flex-1 min-w-0 break-all text-[11px] text-slate-700 dark:text-slate-300">{webhookUrl}</code>
              <button
                type="button"
                onClick={() => copy(webhookUrl, 'webhook')}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold cursor-pointer shrink-0"
              >
                {copied === 'webhook' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                คัดลอก
              </button>
            </div>
          </Step>

          <Step n={3} title="ผูก LINE ส่วนตัวของคุณ" done={status.linked}>
            {status.linked ? (
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs text-slate-700 dark:text-slate-300">
                  ผูกกับ <strong>{status.adminName || 'แอดมิน'}</strong> แล้ว
                </span>
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={busy !== null}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer min-h-[40px]"
                >
                  {busy === 'test' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  ส่งข้อความทดสอบ
                </button>
                <button
                  type="button"
                  onClick={handleUnlink}
                  disabled={busy !== null}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold disabled:opacity-50 cursor-pointer min-h-[40px]"
                >
                  <Unlink className="h-4 w-4" />
                  ยกเลิกการผูก
                </button>
              </div>
            ) : !status.connected ? (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">ทำข้อ 1 ก่อน แล้วจะมี QR Code ให้สแกนที่นี่</p>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                {status.qrDataUrl && (
                  <img
                    src={status.qrDataUrl}
                    alt="QR Code สำหรับผูก LINE แอดมิน"
                    className="w-36 h-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-white shrink-0"
                  />
                )}
                <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                  <p>สแกน QR ด้วยมือถือ หรือแตะปุ่มด้านล่าง LINE จะเปิดแชทกับ OA พร้อมข้อความยืนยัน กดส่งได้เลย (รหัสใช้ได้ 1 ชั่วโมง)</p>
                  {status.deepLink && (
                    <a
                      href={status.deepLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#06C755] hover:opacity-90 text-white font-bold min-h-[40px]"
                    >
                      เปิด LINE และยืนยัน
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => copy(`/admin-link ${status.linkCode}`, 'code')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-mono font-bold cursor-pointer"
                  >
                    {copied === 'code' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    หรือพิมพ์: /admin-link {status.linkCode}
                  </button>
                  <button
                    type="button"
                    onClick={refresh}
                    disabled={busy !== null}
                    className="flex items-center gap-1.5 text-indigo-600 font-bold cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${busy === 'refresh' ? 'animate-spin' : ''}`} />
                    ส่งแล้ว รีเฟรชสถานะ
                  </button>
                </div>
              </div>
            )}
          </Step>
        </div>
      )}

      {notice && <p className={`text-xs font-semibold ${notice.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{notice.text}</p>}
    </div>
  )
}
