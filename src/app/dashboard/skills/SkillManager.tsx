'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_SKILL_FILE_BYTES, parseSkillFile, type ParsedSkillFile } from '@/lib/ai/skillFile'
import { isStaleRunning, skillDigest } from '@/lib/ai/shadowReport'
import SkillRuntimeSettings from './SkillRuntimeSettings'
import { Archive, CheckCircle2, Loader2, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'

type Skill = {
  id: string
  skill_type: 'knowledge' | 'behavior' | 'example' | 'rule'
  category: string
  version: string
  status: 'candidate' | 'active' | 'archived'
  trigger_keywords: string[]
  knowledge_body: string | null
  instruction: string | null
  facts_confirmed?: boolean | null
}

const emptyForm = { skill_type: 'knowledge', category: 'sales', keywords: '', knowledge_body: '', instruction: '' }

type ShadowRow = {
  id: string
  skill_id: string
  status?: string | null
  winner?: string | null
  recommendation?: string | null
  sample_size?: number | null
  improved_count?: number | null
  regressed_count?: number | null
  tied_count?: number | null
  grounded_with?: number | null
  grounded_without?: number | null
  handoff_with?: number | null
  handoff_without?: number | null
  judge_used?: boolean | null
  judge_with?: number | null
  judge_without?: number | null
  prompt_tokens?: number | null
  completion_tokens?: number | null
  estimated_cost_usd?: number | string | null
  skill_digest?: string | null
  metrics?: { kind?: string; confirmFacts?: boolean } | null
  created_at?: string | null
}

function shadowPhase(row: ShadowRow | undefined): 'none' | 'legacy' | 'running' | 'stale' | 'completed' | 'insufficient' | 'failed' {
  if (!row) return 'none'
  if (!row.status || row.status === 'legacy') return 'legacy'
  if (row.status === 'completed' && row.metrics?.kind !== 'replay') return 'legacy'
  if (row.status === 'running' && isStaleRunning(row.status, row.created_at)) return 'stale'
  if (row.status === 'running' || row.status === 'completed' || row.status === 'insufficient' || row.status === 'failed') return row.status
  return 'legacy'
}

export default function SkillManager({ enabled }: { enabled: boolean }) {
  const [skills, setSkills] = useState<Skill[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [applyingTemplate, setApplyingTemplate] = useState<string | null>(null)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ParsedSkillFile | null>(null)
  const [readingFile, setReadingFile] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importNotice, setImportNotice] = useState('')
  const [confirmFacts, setConfirmFacts] = useState<Record<string, boolean>>({})
  const [evals, setEvals] = useState<Record<string, ShadowRow>>({})
  const [shadowBusy, setShadowBusy] = useState<string | null>(null)
  const selectionVersion = useRef(0)

  async function previewFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    const version = ++selectionVersion.current
    setPreview(null)
    setImportFile(null)
    setError('')
    setImportNotice('')
    if (!file) { setReadingFile(false); return }
    setReadingFile(true)
    try {
      if (file.size > MAX_SKILL_FILE_BYTES) throw new Error('File exceeds 16 KB')
      const parsed = parseSkillFile(file.name, new Uint8Array(await file.arrayBuffer()))
      if (version !== selectionVersion.current) return
      setImportFile(file)
      setPreview(parsed)
    } catch (error) {
      if (version === selectionVersion.current) setError(error instanceof Error ? error.message : 'อ่านไฟล์ไม่สำเร็จ')
    } finally {
      if (version === selectionVersion.current) setReadingFile(false)
    }
  }

  async function importSkill(event: React.FormEvent) {
    event.preventDefault()
    if (!importFile || !preview || readingFile || importing) return
    setImporting(true)
    setError('')
    setImportNotice('')
    try {
      const data = new FormData()
      data.set('file', importFile)
      const response = await fetch('/api/shop/skills/import', { method: 'POST', body: data })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'นำเข้า Skill ไม่สำเร็จ')
      setImportFile(null)
      setPreview(null)
      setImportNotice('นำเข้าเป็น Candidate แล้ว กรุณาตรวจสอบและกดเปิดใช้ก่อนบอทนำไปใช้')
      await loadSkills()
      await loadEvals()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'นำเข้า Skill ไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setImporting(false)
    }
  }

  async function applyTemplate(templateType: string) {
    setApplyingTemplate(templateType)
    setError('')
    try {
      const response = await fetch('/api/shop/skills/templates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ template_type: templateType }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) setError(payload.error ?? 'สร้างจาก Template ไม่สำเร็จ')
      else {
        await loadSkills()
        await loadEvals()
      }
    } finally {
      setApplyingTemplate(null)
    }
  }
  const loadEvals = useCallback(async () => {
    try {
      const response = await fetch('/api/shop/shadow-eval', { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) return
      const next: Record<string, ShadowRow> = {}
      for (const row of (payload.evals || []) as ShadowRow[]) {
        if (row?.skill_id) next[row.skill_id] = row
      }
      setEvals(next)
    } catch {
      // The skill list still works when the eval table is not ready.
    }
  }, [])

  const loadSkills = useCallback(async () => {
    try {
      const response = await fetch('/api/shop/skills', { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) setError(payload.error ?? 'โหลด Skill ไม่สำเร็จ')
      else setSkills(payload.skills ?? [])
    } catch {
      setError('โหลดรายการ Skill ไม่สำเร็จ กรุณาลองใหม่ (หากนำเข้าสำเร็จแล้วไม่ต้องนำเข้าซ้ำ)')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadSkills()
      void loadEvals()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [loadSkills, loadEvals])

  const evalRunning = Object.values(evals).some((row) => shadowPhase(row) === 'running')
  useEffect(() => {
    if (!evalRunning) return
    const timer = window.setInterval(() => void loadEvals(), 4000)
    return () => window.clearInterval(timer)
  }, [evalRunning, loadEvals])

  async function submitSkill(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    const response = await fetch(editingId ? `/api/shop/skills/${editingId}` : '/api/shop/skills', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        skill_type: form.skill_type,
        category: form.category,
        trigger_keywords: form.keywords.split(',').map((item) => item.trim()).filter(Boolean),
        knowledge_body: form.knowledge_body,
        instruction: form.instruction,
      }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) setError(payload.error ?? 'สร้าง Skill ไม่สำเร็จ')
    else {
      setForm(emptyForm)
      setEditingId(null)
      await loadSkills()
      await loadEvals()
    }
    setSaving(false)
  }

  function editSkill(skill: Skill) {
    setEditingId(skill.id)
    setForm({
      skill_type: skill.skill_type,
      category: skill.category,
      keywords: skill.trigger_keywords?.join(', ') ?? '',
      knowledge_body: skill.knowledge_body ?? '',
      instruction: skill.instruction ?? '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function mutate(skill: Skill, action: 'activate' | 'archive' | 'delete' | 'confirm_facts') {
    setError('')
    const response = await fetch(`/api/shop/skills/${skill.id}`, {
      method: action === 'delete' ? 'DELETE' : 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: action === 'delete' ? undefined : JSON.stringify({
        action,
        confirm_facts: action === 'activate' && confirmFacts[skill.id] === true,
      }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) setError(payload.error ?? 'อัปเดต Skill ไม่สำเร็จ')
    else {
      await loadSkills()
      await loadEvals()
    }
  }

  async function requestShadow(skill: Skill) {
    setShadowBusy(skill.id)
    setError('')
    try {
      const response = await fetch('/api/shop/shadow-eval', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ skillId: skill.id, confirmFacts: confirmFacts[skill.id] === true }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'ทดสอบไม่สำเร็จ')
      await loadEvals()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ทดสอบไม่สำเร็จ')
    } finally {
      setShadowBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2 text-violet-600"><Sparkles size={20} /><span className="text-sm font-semibold">Per-shop AI Skills</span></div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">ทักษะเฉพาะร้าน</h1>
        <p className="mt-1 text-sm text-slate-600">สร้างเป็นฉบับร่าง ตรวจสอบ แล้วจึงเปิดใช้กับบอท</p>
      </header>

      <SkillRuntimeSettings />
      {!enabled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          ร้านนี้ยังไม่ได้เปิด feature <code>shop_skills_enabled</code> จึงจัดเตรียม Skill ได้ แต่บอทจะยังไม่นำไปใช้
        </div>
      )}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error} <button type="button" onClick={() => void loadSkills()} className="underline">โหลดรายการอีกครั้ง</button></div>}

      <form aria-label="Import skill" aria-busy={importing || readingFile} onSubmit={importSkill} className="space-y-3 rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">นำเข้า Skill จาก Markdown</h2>
        <p className="text-sm text-slate-600">ไฟล์ .md / .txt แบบ UTF-8 ไม่เกิน 16 KB และแนวทางการตอบไม่เกิน 8,000 ตัวอักษร ระบบปฏิเสธไฟล์ที่เกินขนาดโดยไม่ตัดข้อความ</p>
        <p className="text-sm text-slate-600">รองรับ Markdown ธรรมดา หรือ frontmatter ระหว่าง --- ที่มี name (ไม่เกิน 50 ตัวอักษร) และ description แบบข้อความบรรทัดเดียวเท่านั้น ไม่รองรับ YAML ซับซ้อน ชื่อจะเป็นหมวดหมู่และคำอธิบายเก็บในช่องข้อมูล</p>
        <p className="text-sm text-amber-800">นำเข้าเป็น Behavior แบบไม่มีคำกระตุ้น: ใช้กับทุกคำตอบเมื่ออนุมัติและเปิดระบบ Skills แล้ว ต้องตรวจสอบ Candidate และกดเปิดใช้ก่อน ระบบไม่รันสคริปต์หรือไฟล์แนบ ไม่โหลดไฟล์ที่ลิงก์ไว้</p>
        <div className="flex flex-wrap gap-4 text-sm text-violet-700">
          <a href="/skill-templates/government-service.md" download className="underline">ดาวน์โหลดแม่แบบงานราชการ</a>
          <a href="/skill-templates/legal-information.md" download className="underline">ดาวน์โหลดแม่แบบข้อมูลกฎหมาย</a>
        </div>
        <label className="block text-sm font-medium text-slate-700">เลือกไฟล์เพื่อดูตัวอย่างก่อนบันทึก
          <input type="file" accept=".md,.txt,text/plain,text/markdown" disabled={importing} onChange={previewFile} className="mt-2 block w-full text-sm" />
        </label>
        {readingFile && <p role="status" className="text-sm text-slate-500">กำลังอ่านไฟล์…</p>}
        {preview && <div className="space-y-2">
          <p className="text-sm font-medium text-slate-800">{importFile?.name} · หมวดหมู่: {preview.category}</p>
          {preview.description && <p className="whitespace-pre-wrap text-sm text-slate-600">{preview.description}</p>}
          <p className="text-xs text-slate-500">แนวทางการตอบ {preview.instruction.length.toLocaleString()} / 8,000 ตัวอักษร (แสดงเป็นข้อความเท่านั้น)</p>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{preview.instruction}</pre>
        </div>}
        <button type="submit" disabled={!preview || importing || readingFile} className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {importing && <Loader2 size={16} className="animate-spin" />} {importing ? 'กำลังนำเข้า…' : 'ยืนยันนำเข้าเป็น Candidate'}
        </button>
        {importNotice && <p role="status" className="text-sm text-emerald-700">{importNotice}</p>}
      </form>

      <form onSubmit={submitSkill} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">ประเภท
          <select className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={form.skill_type} onChange={(event) => setForm({ ...form, skill_type: event.target.value })}>
            <option value="knowledge">Knowledge</option><option value="behavior">Behavior</option><option value="example">Example</option><option value="rule">Rule</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">หมวดหมู่
          <input className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} maxLength={50} />
        </label>
        <label className="text-sm font-medium text-slate-700 md:col-span-2">คำกระตุ้น (คั่นด้วย comma)
          <input className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={form.keywords} onChange={(event) => setForm({ ...form, keywords: event.target.value })} placeholder="ราคา, ส่งด่วน, รับประกัน" />
          {form.skill_type === 'behavior' && <span className="mt-1 block text-xs text-slate-500">เว้นว่าง = ใช้กับทุกคำตอบเมื่ออนุมัติและเปิดระบบ Skills แล้ว</span>}
        </label>
        <label className="text-sm font-medium text-slate-700">ข้อมูลที่ยืนยันแล้ว
          <textarea className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 p-2" value={form.knowledge_body} onChange={(event) => setForm({ ...form, knowledge_body: event.target.value })} maxLength={8000} />
          <span className="mt-1 block text-xs text-slate-500">ข้อความที่ร้านเขียนหรือแก้เองถือเป็นข้อเท็จจริงของร้าน และใช้เป็นหลักฐานตอบลูกค้าได้เมื่อเปิดใช้</span>
        </label>
        <label className="text-sm font-medium text-slate-700">แนวทางการตอบ
          <textarea className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 p-2" value={form.instruction} onChange={(event) => setForm({ ...form, instruction: event.target.value })} maxLength={8000} />
        </label>
        <div className="flex gap-2 md:col-span-2">
          <button disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? <Loader2 className="animate-spin" size={17} /> : editingId ? <Pencil size={17} /> : <Plus size={17} />} {editingId ? 'บันทึก Candidate' : 'สร้าง Candidate'}
          </button>
          {editingId && <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm) }} className="rounded-lg border px-4 py-2 text-sm">ยกเลิก</button>}
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">📋 ใช้ Template (สร้าง Skill อัตโนมัติ)</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { type: 'restaurant', label: '🍽️ ร้านอาหาร', desc: 'เมนู+ราคา, จัดส่ง' },
            { type: 'salon', label: '💅 เสริมสวย/สปา', desc: 'บริการ+ราคา, จองคิว' },
            { type: 'retail', label: '🛍️ ร้านค้า', desc: 'สินค้า+ราคา, จัดส่ง' },
            { type: 'general', label: '🏢 ทั่วไป', desc: 'ราคา+แพ็กเกจ, การชำระเงิน' },
          ].map((t) => (
            <button
              key={t.type}
              type="button"
              disabled={applyingTemplate !== null}
              onClick={() => void applyTemplate(t.type)}
              className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center text-sm hover:border-violet-300 hover:bg-violet-50 disabled:opacity-50"
            >
              {applyingTemplate === t.type ? <Loader2 className="animate-spin" size={18} /> : <span className="text-lg">{t.label.split(' ')[0]}</span>}
              <span className="font-semibold text-slate-800">{t.label.split(' ').slice(1).join(' ')}</span>
              <span className="text-xs text-slate-500">{t.desc}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">กดเลือก → ระบบสร้าง candidate skills อัตโนมัติ → แก้ไขข้อมูล → กด "เปิดใช้"</p>
      </div>

      <section className="space-y-3">
        {loading && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="animate-spin" size={16} /> กำลังโหลด</div>}
        {!loading && skills.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">ยังไม่มี Skill</div>}
        {skills.map((skill) => (
          <article key={skill.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><div className="font-semibold text-slate-900">{skill.category} <span className="text-xs font-normal text-slate-500">{skill.skill_type} · v{skill.version}</span></div><div className="mt-1 text-xs uppercase tracking-wide text-slate-500">{skill.status}</div></div>
              <div className="flex flex-wrap gap-2">
                {skill.status !== 'archived' && (
                  <button type="button" onClick={() => void requestShadow(skill)} disabled={shadowBusy === skill.id || shadowPhase(evals[skill.id]) === 'running'} className="flex items-center gap-1 rounded-lg border border-violet-300 px-3 py-1.5 text-xs font-semibold text-violet-800 disabled:opacity-50">
                    {(shadowBusy === skill.id || shadowPhase(evals[skill.id]) === 'running') && <Loader2 size={14} className="animate-spin" />}
                    ทดสอบกับแชทจริง
                  </button>
                )}
                {skill.status === 'candidate' && <button onClick={() => void mutate(skill, 'activate')} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"><CheckCircle2 size={14} /> เปิดใช้</button>}
                {skill.status === 'candidate' && <button onClick={() => editSkill(skill)} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs"><Pencil size={14} /> แก้ไข</button>}
                {skill.status === 'active' && <button onClick={() => void mutate(skill, 'archive')} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs"><Archive size={14} /> เก็บ</button>}
                {skill.status !== 'active' && <button onClick={() => void mutate(skill, 'delete')} className="rounded-lg border border-red-200 p-1.5 text-red-600" aria-label="ลบ"><Trash2 size={15} /></button>}
              </div>
            </div>
            <ShadowResult skill={skill} row={evals[skill.id]} confirmFacts={confirmFacts[skill.id] === true} />
            {skill.skill_type === 'behavior' && !skill.trigger_keywords?.length && <div className="mt-3 text-xs text-violet-700">ไม่มีคำกระตุ้น · ใช้กับทุกคำตอบเมื่ออนุมัติและเปิดระบบ Skills</div>}
            {skill.trigger_keywords?.length > 0 && <div className="mt-3 text-xs text-violet-700">{skill.trigger_keywords.join(' · ')}</div>}
            {skill.facts_confirmed === true && <p className="mt-3 text-xs text-emerald-700">ข้อเท็จจริงที่ยืนยันแล้ว จะใช้เป็นหลักฐานเมื่อสกิลนี้เปิดใช้</p>}
            {skill.facts_confirmed !== true && (skill.knowledge_body || skill.skill_type === 'knowledge') && (
              <div className="mt-3 space-y-2 text-xs text-amber-800">
                <p>ข้อเท็จจริงยังไม่ยืนยัน บอททำตามแนวทางนี้ได้ แต่จะไม่ใช้ข้อความนี้พิสูจน์ราคา สต็อก นโยบาย หรือการชำระเงิน จนกว่าจะแก้ข้อความหรือกดยืนยัน</p>
                {skill.status === 'candidate' && (
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={confirmFacts[skill.id] === true}
                      onChange={(event) => setConfirmFacts((current) => ({ ...current, [skill.id]: event.target.checked }))}
                    />
                    <span>ยืนยันว่าข้อความนี้เป็นข้อเท็จจริงของร้าน แล้วจึงใช้เป็นหลักฐานตอนกดเปิดใช้</span>
                  </label>
                )}
                {skill.status === 'active' && (
                  <button type="button" onClick={() => void mutate(skill, 'confirm_facts')} className="rounded-lg border border-amber-300 px-2 py-1 font-semibold">ยืนยันข้อเท็จจริง</button>
                )}
              </div>
            )}
            {skill.knowledge_body && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{skill.knowledge_body}</p>}
            {skill.instruction && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{skill.instruction}</p>}
          </article>
        ))}
      </section>
    </div>
  )
}

function ShadowResult({ skill, row, confirmFacts }: { skill: Skill; row?: ShadowRow; confirmFacts: boolean }) {
  const phase = shadowPhase(row)
  if (phase === 'none' && skill.status !== 'candidate') return null
  const digest = skillDigest({
    knowledge_body: skill.knowledge_body,
    instruction: skill.instruction,
    trigger_keywords: skill.trigger_keywords,
    facts_confirmed: skill.facts_confirmed === true,
    version: skill.version,
  }, confirmFacts)
  const stale = Boolean(row?.skill_digest && row.skill_digest !== digest && (phase === 'completed' || phase === 'insufficient'))
  const n = row?.sample_size ?? 0
  const cost = row?.estimated_cost_usd == null ? null : Number(row.estimated_cost_usd)
  const tokens = (row?.prompt_tokens || 0) + (row?.completion_tokens || 0)
  return (
    <div role="status" className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
      {phase === 'none' && <p>ยังไม่มีผลทดสอบกับแชทจริง ระบบจะไม่เปิดใช้สกิลให้อัตโนมัติ</p>}
      {phase === 'legacy' && <p>ผลนี้เป็นการประมาณแบบเดิม ไม่ได้ให้บอทตอบแชทจริง กดทดสอบกับแชทจริงเพื่อดูผลใหม่</p>}
      {phase === 'running' && <p>กำลังทดสอบกับแชทจริงของร้าน ยังไม่สรุปผล และยังไม่เปิดใช้สกิล</p>}
      {phase === 'stale' && <p>ทดสอบไม่จบในเวลาที่กำหนด ยังไม่มีผลให้ตัดสิน กดทดสอบใหม่ได้</p>}
      {(phase === 'completed' || phase === 'insufficient' || phase === 'failed') && <p>{row?.recommendation}</p>}
      {phase === 'completed' && (
        <ul className="mt-2 space-y-1 text-slate-600">
          <li>ดีขึ้น {row?.improved_count ?? 0} ข้อ · แย่ลง {row?.regressed_count ?? 0} ข้อ · เท่าเดิม {row?.tied_count ?? 0} ข้อ จาก {n} ข้อ</li>
          <li>ตอบโดยมีหลักฐานจากร้าน: มีสกิล {row?.grounded_with ?? 0}/{n} ข้อ · ไม่มีสกิล {row?.grounded_without ?? 0}/{n} ข้อ</li>
          <li>ส่งต่อแอดมิน: มีสกิล {row?.handoff_with ?? 0}/{n} ข้อ · ไม่มีสกิล {row?.handoff_without ?? 0}/{n} ข้อ</li>
          {row?.judge_used === true && <li>ผู้ตรวจเพิ่ม: มีสกิลผ่าน {row.judge_with ?? 0} ข้อ · ไม่มีสกิลผ่าน {row.judge_without ?? 0} ข้อ</li>}
          {tokens > 0 && <li>ใช้โทเคนประมาณ {tokens.toLocaleString('th-TH')}{cost != null && Number.isFinite(cost) ? ` (ค่าโดยประมาณ $${cost.toFixed(4)} ตามอัตรา Gemini Flash ไม่ใช่บิลจริง)` : ''}</li>}
        </ul>
      )}
      {stale && <p className="mt-2 text-amber-800">เนื้อหาหรือการยืนยันข้อเท็จจริงเปลี่ยนหลังการทดสอบครั้งนี้ กดทดสอบใหม่ก่อนตัดสินใจ</p>}
    </div>
  )
}
