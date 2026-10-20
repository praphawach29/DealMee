'use client'

import { useEffect, useState } from 'react'
import { KeyRound, Loader2, Trash2 } from 'lucide-react'
import type { ShopAiKeyStatus } from '@/lib/billing/shopAiKey'
import { clearByokKeyAction, getByokStatusAction, saveByokKeyAction } from './byokActions'

const PROVIDERS = [
  { value: 'gemini', label: 'Google Gemini (แนะนำ)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'claude', label: 'Anthropic Claude' },
]

/** Shown only on the BYOK plan: the shop's own AI key, which the bot then uses instead of DealMee's. */
export default function ByokKeyCard() {
  const [onByokPlan, setOnByokPlan] = useState(false)
  const [status, setStatus] = useState<ShopAiKeyStatus | null>(null)
  const [provider, setProvider] = useState('gemini')
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  async function load() {
    const res = await getByokStatusAction()
    if ('error' in res) return
    setOnByokPlan(res.onByokPlan)
    setStatus(res.status)
    if (res.status) setProvider(res.status.provider)
  }

  useEffect(() => {
    load()
  }, [])

  if (!onByokPlan) return null

  async function save() {
    setBusy(true)
    setNotice(null)
    const res = await saveByokKeyAction(provider, key)
    setBusy(false)
    if ('error' in res) {
      setNotice({ ok: false, text: res.error })
    } else {
      setNotice({ ok: true, text: res.success })
      setKey('')
      load()
    }
  }

  async function clear() {
    if (!confirm('ลบ API Key ของร้าน? บอทจะตอบลูกค้าไม่ได้จนกว่าจะใส่ key ใหม่ (แชทจะส่งต่อให้แอดมิน)')) return
    setBusy(true)
    const res = await clearByokKeyAction()
    setBusy(false)
    setNotice('error' in res ? { ok: false, text: res.error } : { ok: true, text: res.success })
    load()
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-amber-600" />
        <span className="text-xs sm:text-sm font-bold text-on-surface">API Key ของร้าน (แพ็กเกจ BYOK)</span>
      </div>
      <p className="text-[11px] text-on-surface-variant leading-relaxed">
        แพ็กเกจ BYOK ให้บอทใช้ key ของร้านเองเท่านั้น ค่า AI จ่ายตรงกับผู้ให้บริการ ถ้า key ใช้ไม่ได้ (หมดวงเงินหรือถูกยกเลิก) บอทจะส่งแชทต่อให้แอดมินแทน
        key ถูกเข้ารหัสก่อนเก็บ และแสดงแค่ 4 ตัวท้าย
      </p>

      {status ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          ใช้ key {PROVIDERS.find((p) => p.value === status.provider)?.label || status.provider} ลงท้าย{' '}
          <span className="font-mono">…{status.hint}</span> · บันทึกเมื่อ {new Date(status.updatedAt).toLocaleString('th-TH')}
        </p>
      ) : (
        <p className="text-xs font-semibold text-rose-600">ยังไม่ได้ใส่ key ตอนนี้บอทตอบลูกค้าไม่ได้ แชทจะถูกส่งต่อให้แอดมิน</p>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="sm:w-52 px-3 py-2 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs outline-none focus:border-electric-blue"
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <input
          type="password"
          autoComplete="off"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={status ? 'วาง key ใหม่เพื่อเปลี่ยน' : 'วาง API Key'}
          className="flex-1 px-3 py-2 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs font-mono outline-none focus:border-electric-blue"
        />
        <button
          type="button"
          onClick={save}
          disabled={busy || !key.trim()}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-electric-blue text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
          ทดสอบและบันทึก
        </button>
        {status && (
          <button
            type="button"
            onClick={clear}
            disabled={busy}
            title="ลบ key"
            className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-rose-500/30 text-rose-600 hover:bg-rose-500/10 text-xs cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {notice && <p className={`text-xs ${notice.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{notice.text}</p>}
    </div>
  )
}
