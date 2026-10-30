'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Settings = { enabled: boolean; qaOnly: boolean; globalAvailable: boolean }
const endpoint = '/api/shop/skills/settings'

async function readSettings(response: Response): Promise<Settings> {
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : `ดำเนินการไม่สำเร็จ (${response.status})`)
  }
  if (!payload || typeof payload.enabled !== 'boolean' || typeof payload.qaOnly !== 'boolean' || typeof payload.globalAvailable !== 'boolean') {
    throw new Error('ข้อมูลการตั้งค่าจากเซิร์ฟเวอร์ไม่ถูกต้อง กรุณาโหลดใหม่')
  }
  return { enabled: payload.enabled, qaOnly: payload.qaOnly, globalAvailable: payload.globalAvailable }
}

export default function SkillRuntimeSettings() {
  const router = useRouter()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      setSettings(await readSettings(await fetch(endpoint, { cache: 'no-store' })))
    } catch (cause) {
      setSettings(null)
      setError(cause instanceof Error ? cause.message : 'โหลดการตั้งค่าไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => void load(), 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function save() {
    if (!settings) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const saved = await readSettings(await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: settings.enabled, qaOnly: settings.qaOnly }),
      }))
      setSettings(saved)
      setSuccess(saved.enabled && !saved.globalAvailable
        ? 'บันทึกการตั้งค่าแล้ว แต่ระบบส่วนกลางยังปิดการดึง Skill มาใช้ตอบ'
        : 'บันทึกและตรวจสอบการตั้งค่าแล้ว การตอบครั้งถัดไปจะใช้ค่าที่บันทึก')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกไม่สำเร็จ กรุณาโหลดใหม่เพื่อตรวจสอบ')
    } finally {
      setSaving(false)
    }
  }

  function change(key: 'enabled' | 'qaOnly', value: boolean) {
    setSettings(current => current ? { ...current, [key]: value } : current)
    setSuccess('')
    setError('')
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5" aria-label="การใช้งาน Skill และ Q&A">
      <div>
        <h2 className="font-semibold text-slate-900">การใช้งาน Skill และโหมด Q&A</h2>
        <p className="mt-1 text-sm text-slate-600">เหมาะสำหรับหน่วยงานรัฐ สำนักงานกฎหมาย และบอตให้ข้อมูลเฉพาะทาง ไม่ต้องมีสินค้าในระบบ</p>
      </div>
      <fieldset disabled={loading || saving || !settings} className="space-y-3 disabled:opacity-60">
        <label className="flex items-start gap-3 text-sm text-slate-800">
          <input type="checkbox" className="mt-1" checked={settings?.enabled ?? false} onChange={event => change('enabled', event.target.checked)} />
          <span><strong>เปิดใช้ Skill สำหรับร้านนี้</strong><span className="block text-slate-600">ใช้ Skill ที่อนุมัติและเปิดใช้งานแล้วเป็นความรู้ประกอบคำตอบ ไม่ได้เปิดใช้งานฉบับร่างโดยอัตโนมัติ</span></span>
        </label>
        <label className="flex items-start gap-3 text-sm text-slate-800">
          <input type="checkbox" className="mt-1" checked={settings?.qaOnly ?? false} onChange={event => change('qaOnly', event.target.checked)} />
          <span><strong>โหมดตอบคำถามอย่างเดียว (Q&A-only)</strong><span className="block text-slate-600">ปิดเครื่องมือเชิงพาณิชย์และการขาย เช่น สั่งซื้อ ชำระเงิน และจองบริการ เพื่อเน้นการให้ข้อมูล โหมดนี้ตั้งค่าแยกจากการเปิด Skill</span></span>
        </label>
      </fieldset>
      {settings && !settings.globalAvailable && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">ระบบส่วนกลางตั้ง SHOP_SKILLS_RETRIEVAL_ENABLED=false จึงปิดการดึง Skill มาใช้ตอบ แม้เปิดสวิตช์ร้านนี้ คุณยังบันทึกค่าร้านและโหมด Q&A ได้</p>
      )}
      {loading && <p className="text-sm text-slate-500">กำลังโหลดการตั้งค่า…</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {success && <p role="status" className="text-sm text-emerald-700">{success}</p>}
      <div className="flex gap-3">
        <button type="button" onClick={save} disabled={loading || saving || !settings} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">{saving ? 'กำลังบันทึก…' : 'บันทึกการตั้งค่า'}</button>
        <button type="button" onClick={load} disabled={loading || saving} className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50">โหลดใหม่</button>
      </div>
    </section>
  )
}
