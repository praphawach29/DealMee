'use client'

import { useCallback, useEffect, useState } from 'react'
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
}

const emptyForm = { skill_type: 'knowledge', category: 'sales', keywords: '', knowledge_body: '', instruction: '' }

export default function SkillManager({ enabled }: { enabled: boolean }) {
  const [skills, setSkills] = useState<Skill[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadSkills = useCallback(async () => {
    const response = await fetch('/api/shop/skills', { cache: 'no-store' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) setError(payload.error ?? 'โหลด Skill ไม่สำเร็จ')
    else setSkills(payload.skills ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadSkills(), 0)
    return () => window.clearTimeout(timeout)
  }, [loadSkills])

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

  async function mutate(skill: Skill, action: 'activate' | 'archive' | 'delete') {
    setError('')
    const response = await fetch(`/api/shop/skills/${skill.id}`, {
      method: action === 'delete' ? 'DELETE' : 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: action === 'delete' ? undefined : JSON.stringify({ action }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) setError(payload.error ?? 'อัปเดต Skill ไม่สำเร็จ')
    else await loadSkills()
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2 text-violet-600"><Sparkles size={20} /><span className="text-sm font-semibold">Per-shop AI Skills</span></div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">ทักษะเฉพาะร้าน</h1>
        <p className="mt-1 text-sm text-slate-600">สร้างเป็นฉบับร่าง ตรวจสอบ แล้วจึงเปิดใช้กับบอท</p>
      </header>

      {!enabled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          ร้านนี้ยังไม่ได้เปิด feature <code>shop_skills_enabled</code> จึงจัดเตรียม Skill ได้ แต่บอทจะยังไม่นำไปใช้
        </div>
      )}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

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
        </label>
        <label className="text-sm font-medium text-slate-700">ข้อมูลที่ยืนยันแล้ว
          <textarea className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 p-2" value={form.knowledge_body} onChange={(event) => setForm({ ...form, knowledge_body: event.target.value })} maxLength={8000} />
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

      <section className="space-y-3">
        {loading && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="animate-spin" size={16} /> กำลังโหลด</div>}
        {!loading && skills.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">ยังไม่มี Skill</div>}
        {skills.map((skill) => (
          <article key={skill.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><div className="font-semibold text-slate-900">{skill.category} <span className="text-xs font-normal text-slate-500">{skill.skill_type} · v{skill.version}</span></div><div className="mt-1 text-xs uppercase tracking-wide text-slate-500">{skill.status}</div></div>
              <div className="flex gap-2">
                {skill.status === 'candidate' && <button onClick={() => void mutate(skill, 'activate')} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"><CheckCircle2 size={14} /> เปิดใช้</button>}
                {skill.status === 'candidate' && <button onClick={() => editSkill(skill)} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs"><Pencil size={14} /> แก้ไข</button>}
                {skill.status === 'active' && <button onClick={() => void mutate(skill, 'archive')} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs"><Archive size={14} /> เก็บ</button>}
                {skill.status !== 'active' && <button onClick={() => void mutate(skill, 'delete')} className="rounded-lg border border-red-200 p-1.5 text-red-600" aria-label="ลบ"><Trash2 size={15} /></button>}
              </div>
            </div>
            {skill.trigger_keywords?.length > 0 && <div className="mt-3 text-xs text-violet-700">{skill.trigger_keywords.join(' · ')}</div>}
            {skill.knowledge_body && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{skill.knowledge_body}</p>}
            {skill.instruction && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{skill.instruction}</p>}
          </article>
        ))}
      </section>
    </div>
  )
}
