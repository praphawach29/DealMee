'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Check, KeyRound, Loader2, RotateCcw, ShieldCheck, X } from 'lucide-react'
import type { SecretLogEntry, SecretStatus } from '@/lib/platformSecrets'
import { clearSecretAction, saveSecretAction, testSecretAction } from './actions'

const TESTABLE = new Set(['GEMINI_API_KEY', 'OPENAI_API_KEY', 'CLAUDE_API_KEY', 'RAPIDAPI_KEY', 'ELEVENLABS_API_KEY'])

const GROUPS: { key: SecretStatus['group']; title: string }[] = [
  { key: 'ai', title: 'AI' },
  { key: 'slip', title: 'ตรวจสลิป' },
  { key: 'facebook', title: 'Facebook (แอป Meta ของ DealMee)' },
  { key: 'other', title: 'อื่น ๆ' },
]

const inputClass =
  'w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500'
const buttonClass =
  'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'

function SourceBadge({ source }: { source: SecretStatus['source'] }) {
  const map = {
    dashboard: ['ตั้งในหน้านี้', 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'],
    env: ['ค่าจาก Vercel', 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'],
    legacy: ['ค่าเก่าในตาราง settings', 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'],
    none: ['ยังไม่ได้ตั้ง', 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'],
  } as const
  const [label, cls] = map[source]
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
}

interface SecretInputProps {
  status: SecretStatus
  value: string
  blocked: boolean
  onChange: (val: string) => void
}

function SecretInputField({ status, value, blocked, onChange }: SecretInputProps) {
  if (status.options) {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value="">— เลือก —</option>
        {status.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    )
  }

  return (
    <input
      type={status.secret ? 'password' : 'text'}
      autoComplete="off"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={status.secret ? 'วาง key ใหม่' : status.placeholder || 'ค่าใหม่'}
      className={inputClass}
      disabled={blocked}
    />
  )
}

function SecretRow({ status, canEncrypt }: { status: SecretStatus; canEncrypt: boolean }) {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState<'test' | 'save' | 'clear' | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const blocked = status.secret && !canEncrypt

  const handleTest = async () => {
    setBusy('test')
    setNotice(null)
    try {
      const res = await testSecretAction(status.name, value)
      setNotice({ ok: res.ok, text: res.message })
    } catch (err: any) {
      setNotice({ ok: false, text: err.message })
    } finally {
      setBusy(null)
    }
  }

  const handleSave = async () => {
    if (status.secret && TESTABLE.has(status.name)) {
      setBusy('test')
      try {
        const testRes = await testSecretAction(status.name, value)
        if (!testRes.ok && !confirm(`ทดสอบไม่ผ่าน: ${testRes.message}\nบันทึกต่อหรือไม่?`)) {
          setBusy(null)
          return
        }
      } catch (err: any) {
        if (!confirm(`ทดสอบเกิดข้อผิดพลาด: ${err.message}\nบันทึกต่อหรือไม่?`)) {
          setBusy(null)
          return
        }
      }
    }

    setBusy('save')
    setNotice(null)
    try {
      const res = await saveSecretAction(status.name, value)
      if (!res.success) throw new Error(res.error)
      setValue('')
      setNotice({ ok: true, text: 'บันทึกแล้ว มีผลภายใน 1 นาที' })
      router.refresh()
    } catch (err: any) {
      setNotice({ ok: false, text: err.message })
    } finally {
      setBusy(null)
    }
  }

  const handleClear = async () => {
    if (!confirm(`ลบค่าที่ตั้งในหน้านี้ของ ${status.label}? ระบบจะกลับไปใช้ค่าจาก Vercel (ถ้ามี)`)) return
    setBusy('clear')
    setNotice(null)
    try {
      const res = await clearSecretAction(status.name)
      if (!res.success) throw new Error(res.error)
      setNotice({ ok: true, text: 'ลบแล้ว' })
      router.refresh()
    } catch (err: any) {
      setNotice({ ok: false, text: err.message })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="py-4 border-b border-slate-100 dark:border-slate-800 last:border-0 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-bold text-slate-900 dark:text-white">{status.label}</p>
        <SourceBadge source={status.source} />
        {status.display && <span className="text-xs font-mono text-slate-500">{status.display}</span>}
      </div>
      {status.help && <p className="text-[11px] text-slate-500">{status.help}</p>}
      {status.updatedAt && (
        <p className="text-[11px] text-slate-400">
          แก้ไขล่าสุด {new Date(status.updatedAt).toLocaleString('th-TH')} โดย {status.updatedBy}
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <SecretInputField
          status={status}
          value={value}
          blocked={blocked}
          onChange={setValue}
        />
        <div className="flex gap-2 shrink-0">
          {TESTABLE.has(status.name) && (
            <button
              onClick={handleTest}
              disabled={!value.trim() || busy !== null}
              className={`${buttonClass} bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200`}
            >
              {busy === 'test' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />} ทดสอบ
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!value.trim() || busy !== null || blocked}
            className={`${buttonClass} bg-indigo-600 hover:bg-indigo-700 text-white`}
          >
            {busy === 'save' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />} บันทึก
          </button>
          {status.source === 'dashboard' && (
            <button
              onClick={handleClear}
              disabled={busy !== null}
              className={`${buttonClass} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-rose-600`}
              title="ลบค่าที่ตั้งในหน้านี้ แล้วกลับไปใช้ค่าจาก Vercel"
            >
              {busy === 'clear' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>
      {notice && (
        <p className={`text-xs flex items-center gap-1.5 ${notice.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
          {notice.ok ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />} {notice.text}
        </p>
      )}
    </div>
  )
}

export default function SystemSettingsClient({
  statuses,
  log,
  canEncrypt,
}: {
  statuses: SecretStatus[]
  log: SecretLogEntry[]
  canEncrypt: boolean
}) {
  const labelOf = (name: string) => statuses.find((s) => s.name === name)?.label || name

  return (
    <>
      <div>
        <h1 className="font-heading text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white">ตั้งค่าระบบ (API Keys)</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          ค่าที่ตั้งในหน้านี้ใช้แทนค่าใน Vercel ทันที (ภายใน 1 นาที) ไม่ต้อง redeploy · key ถูกเข้ารหัสก่อนเก็บ และแสดงแค่ 4 ตัวท้าย
        </p>
      </div>

      {!canEncrypt && (
        <div className="p-4 rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-xs space-y-1">
          <p className="font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> ยังบันทึก key ไม่ได้: ไม่มี SETTINGS_ENCRYPTION_KEY
          </p>
          <p>
            เพิ่ม Environment Variable ชื่อ <span className="font-mono">SETTINGS_ENCRYPTION_KEY</span> ใน Vercel (ข้อความสุ่มยาว 32 ตัวขึ้นไป) แล้ว
            redeploy ห้ามเปลี่ยนค่านี้ภายหลัง ไม่งั้น key ที่บันทึกไว้จะอ่านไม่ได้ ค่าที่ไม่ใช่ key (ชื่อโมเดล ฯลฯ) บันทึกได้ตามปกติ
          </p>
        </div>
      )}

      {GROUPS.map((group) => (
        <div key={group.key} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
          <h2 className="font-heading text-sm font-semibold text-slate-900 dark:text-white mb-1">{group.title}</h2>
          {statuses
            .filter((s) => s.group === group.key)
            .map((s) => (
              <SecretRow key={s.name} status={s} canEncrypt={canEncrypt} />
            ))}
        </div>
      ))}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
        <h2 className="font-heading text-sm font-semibold text-slate-900 dark:text-white mb-3">ประวัติการเปลี่ยนแปลง</h2>
        {log.length === 0 ? (
          <p className="text-xs text-slate-500">ยังไม่มี</p>
        ) : (
          <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            {log.map((e, i) => (
              <li key={i}>
                {new Date(e.at).toLocaleString('th-TH')} · {e.by} · {e.action === 'set' ? 'ตั้ง' : 'ลบ'} {labelOf(e.name)}
                {e.hint ? ` (${e.hint})` : ''}
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-slate-400 mt-3">
          ยังต้องตั้งใน Vercel: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL/ANON_KEY, NEXT_PUBLIC_APP_URL, CRON_SECRET, SETTINGS_ENCRYPTION_KEY และ key ของ Stripe/Omise
        </p>
      </div>
    </>
  )
}
