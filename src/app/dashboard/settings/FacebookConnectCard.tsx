'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Loader2, Unlink } from 'lucide-react'
import {
  cancelFacebookChoice,
  connectFacebookPage,
  disconnectFacebookPage,
  getFacebookConnectState,
  type FacebookConnectState,
} from './facebookActions'

const RETURN_MESSAGES: Record<string, string> = {
  cancelled: 'ยกเลิกการเชื่อมกับ Facebook แล้ว',
  expired: 'หมดเวลาหรือเปิดลิงก์ผิดหน้าต่าง กรุณากดเชื่อมใหม่อีกครั้ง',
  no_pages: 'บัญชี Facebook นี้ไม่มีเพจที่ดูแลอยู่ หรือไม่ได้อนุญาตให้ DealMee เข้าถึงเพจ',
  not_configured: 'ระบบยังไม่พร้อมเชื่อมเพจ กรุณาติดต่อทีมงาน DealMee',
  error: 'เชื่อมกับ Facebook ไม่สำเร็จ กรุณาลองใหม่ ถ้ายังไม่ได้ ติดต่อทีมงาน',
}

/** "เชื่อมเพจด้วย Facebook": shown once DealMee's Meta app is set up in the Super Admin settings */
export default function FacebookConnectCard() {
  const searchParams = useSearchParams()
  const [state, setState] = useState<FacebookConnectState | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(() => {
    const fb = searchParams.get('fb')
    return fb && RETURN_MESSAGES[fb] ? { ok: false, text: RETURN_MESSAGES[fb] } : null
  })

  async function load() {
    const res = await getFacebookConnectState()
    if (!('error' in res)) setState(res)
  }

  useEffect(() => {
    load()
  }, [])

  if (!state?.appConfigured) return null

  async function choose(pageId: string) {
    setBusy(pageId)
    setNotice(null)
    const res = await connectFacebookPage(pageId)
    setBusy(null)
    setNotice('error' in res ? { ok: false, text: res.error } : { ok: true, text: res.success })
    load()
  }

  async function disconnect() {
    if (!confirm('ตัดการเชื่อมเพจนี้? บอทจะหยุดตอบแชท Messenger ของเพจนี้')) return
    setBusy('disconnect')
    const res = await disconnectFacebookPage()
    setBusy(null)
    setNotice('error' in res ? { ok: false, text: res.error } : { ok: true, text: res.success })
    load()
  }

  const viaOauth = state.connected?.via === 'oauth'

  return (
    <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3.5 space-y-3">
      {viaOauth && state.connected ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <p className="text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
            เชื่อมกับเพจ <strong>{state.connected.pageName}</strong> แล้ว
          </p>
          <button
            type="button"
            onClick={disconnect}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-600 text-xs font-semibold hover:bg-rose-500/10 cursor-pointer disabled:opacity-50"
          >
            {busy === 'disconnect' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
            ตัดการเชื่อม
          </button>
        </div>
      ) : state.choices.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">เลือกเพจที่จะให้บอทตอบแชท</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {state.choices.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => choose(p.id)}
                disabled={busy !== null}
                className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-left text-sm hover:border-blue-500 cursor-pointer disabled:opacity-50"
              >
                <span className="font-semibold text-slate-900 dark:text-white truncate">{p.name}</span>
                {busy === p.id && <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={async () => {
              await cancelFacebookChoice()
              load()
            }}
            className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
          >
            ยกเลิก
          </button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            ล็อกอิน Facebook แล้วเลือกเพจ ไม่ต้องสร้างแอปหรือคัดลอก token เอง
            {state.connected && !viaOauth && ' (จะใช้แทนการตั้งค่าแบบเดิมด้านล่าง)'}
          </p>
          <a
            href="/api/facebook/connect"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white text-sm font-bold shrink-0"
          >
            เชื่อมเพจด้วย Facebook
          </a>
        </div>
      )}
      {notice && <p className={`text-xs ${notice.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{notice.text}</p>}
    </div>
  )
}
