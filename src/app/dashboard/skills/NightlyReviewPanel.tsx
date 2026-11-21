'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, Moon, X } from 'lucide-react'

type ReviewSkill = {
  id: string
  category: string
  skill_type: string
  version?: string
  knowledge_body: string | null
  instruction: string | null
  trigger_keywords: string[]
  status: 'candidate' | 'active' | 'archived'
  facts_confirmed?: boolean | null
}

type SourceSignal = { type?: string; id?: string; label?: string }

type Proposal = {
  id: string
  skill_id: string
  summary_th: string
  needs_merchant_fact: boolean
  source_signals: SourceSignal[]
  revises_category: string | null
  skill: ReviewSkill | null
}

const SOURCE_LABEL: Record<string, string> = {
  gap: 'คำถามที่ตอบไม่ได้',
  feedback: 'กดไม่ชอบ',
  admin_reply: 'แอดมินตอบเอง',
}

export default function NightlyReviewPanel({
  onEditSkill,
  onDecided,
}: {
  onEditSkill: (skill: ReviewSkill) => void
  onDecided: () => void
}) {
  const [proposals, setProposals] = useState<Proposal[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/shop/skill-review', { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(payload.error ?? 'โหลดข้อเสนอไม่สำเร็จ')
        setProposals([])
        return
      }
      setError('')
      setProposals(payload.ready === false ? [] : payload.proposals ?? [])
    } catch {
      setError('โหลดข้อเสนอไม่สำเร็จ')
      setProposals([])
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeout)
  }, [load])

  async function decide(proposal: Proposal, decision: 'accept' | 'reject') {
    setBusy(proposal.id)
    setError('')
    try {
      const response = await fetch('/api/shop/skill-review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ proposal_id: proposal.id, decision }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'บันทึกไม่สำเร็จ')
      await load()
      onDecided()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setBusy(null)
    }
  }

  if (proposals === null) return null
  if (proposals.length === 0 && !error) return null

  return (
    <section className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50/60 p-5 shadow-sm">
      <div className="flex items-center gap-2 text-violet-800">
        <Moon size={18} />
        <h2 className="font-semibold">ข้อเสนอจากการรีวิวเมื่อคืน</h2>
      </div>
      <p className="text-sm text-slate-600">
        ระบบรวบรวมคำถามที่ตอบไม่ได้ คำตอบที่แอดมินพิมพ์เอง และข้อความที่กดไม่ชอบ แล้วร่างสกิลไว้ให้ตรวจ
        การรับไว้ยังไม่เปิดใช้ และยังไม่ยืนยันข้อเท็จจริง
      </p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {proposals.map((proposal) => (
        <article key={proposal.id} className="space-y-3 rounded-xl border border-violet-100 bg-white p-4">
          <p className="text-sm font-medium text-slate-900">{proposal.summary_th}</p>
          {proposal.revises_category && (
            <p className="text-xs text-violet-700">เกี่ยวกับสกิลเดิม «{proposal.revises_category}» แต่ยังไม่แก้สกิลนั้น</p>
          )}
          {proposal.needs_merchant_fact && (
            <p className="text-xs text-amber-800">ยังไม่มีคำตอบจากร้านในแชทนี้ กรุณาเติมข้อเท็จจริงก่อนเปิดใช้ ระบบไม่ได้แต่งคำตอบให้</p>
          )}
          {proposal.source_signals.length > 0 && (
            <ul className="space-y-1 text-xs text-slate-600">
              {proposal.source_signals.map((signal, index) => (
                <li key={`${signal.type || 'signal'}-${signal.id || index}`}>
                  <span className="font-medium text-slate-700">{SOURCE_LABEL[signal.type || ''] || 'สัญญาณ'}: </span>
                  {signal.label || '—'}
                </li>
              ))}
            </ul>
          )}
          {proposal.skill?.knowledge_body && (
            <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{proposal.skill.knowledge_body}</p>
          )}
          {proposal.skill?.instruction && (
            <p className="whitespace-pre-wrap text-sm text-slate-600">{proposal.skill.instruction}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy === proposal.id}
              onClick={() => void decide(proposal, 'accept')}
              className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {busy === proposal.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              รับไว้เป็นฉบับร่าง
            </button>
            <button
              type="button"
              disabled={busy === proposal.id}
              onClick={() => void decide(proposal, 'reject')}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              <X size={14} />
              ไม่ใช้ข้อเสนอนี้
            </button>
            {proposal.needs_merchant_fact && proposal.skill?.status === 'candidate' && (
              <button
                type="button"
                onClick={() => onEditSkill(proposal.skill as ReviewSkill)}
                className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-900"
              >
                เติมข้อเท็จจริง
              </button>
            )}
          </div>
        </article>
      ))}
    </section>
  )
}
