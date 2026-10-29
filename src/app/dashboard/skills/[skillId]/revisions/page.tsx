'use client'

import { use, useEffect, useState } from 'react'

type Revision = {
  id: string
  version: string
  skill_type: string
  category: string
  trigger_keywords: string[]
  knowledge_body: string | null
  instruction: string | null
  change_reason: string | null
  created_at: string
}

export default function SkillRevisionsPage({ params }: { params: Promise<{ skillId: string }> }) {
  const [revisions, setRevisions] = useState<Revision[]>([])
  const [loading, setLoading] = useState(true)
  const [rolling, setRolling] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const { skillId } = use(params)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/shop/skills/${skillId}/rollback`)
      if (res.ok) {
        const data = await res.json()
        setRevisions(data.revisions ?? [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [skillId])

  const handleRollback = async (revisionId: string) => {
    if (!confirm('Rollback skill to this revision?')) return
    setRolling(revisionId)
    setMessage('')
    try {
      const res = await fetch(`/api/shop/skills/${skillId}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision_id: revisionId }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(`✅ Rolled back to v${data.rolledBackTo} → new version ${data.newVersion}`)
        await load()
      } else {
        setMessage(`❌ ${data.error || 'Rollback failed'}`)
      }
    } catch {
      setMessage('❌ Network error')
    }
    setRolling(null)
  }

  if (loading) return <div className="p-6 text-gray-400">กำลังโหลด...</div>

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-bold mb-2">📜 Skill Revisions</h1>
      <p className="text-sm text-gray-500 mb-6">ประวัติการเปลี่ยนแปลง skill และ rollback</p>

      {message && (
        <div className="mb-4 p-3 rounded bg-blue-50 text-sm">{message}</div>
      )}

      {revisions.length === 0 ? (
        <p className="text-gray-400">ยังไม่มี revision history</p>
      ) : (
        <div className="space-y-4">
          {revisions.map((r, idx) => (
            <div key={r.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="font-mono text-sm font-bold">v{r.version}</span>
                  <span className="text-xs text-gray-400 ml-2">
                    {new Date(r.created_at).toLocaleString('th-TH')}
                  </span>
                  {idx === 0 && (
                    <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">latest</span>
                  )}
                </div>
                <button
                  onClick={() => handleRollback(r.id)}
                  disabled={rolling === r.id}
                  className="text-xs bg-orange-500 text-white px-3 py-1 rounded disabled:opacity-50"
                >
                  {rolling === r.id ? 'กำลัง rollback...' : 'Rollback'}
                </button>
              </div>
              <div className="text-xs text-gray-500 mb-1">
                {r.skill_type} · {r.category} · {r.change_reason || 'manual update'}
              </div>
              {r.trigger_keywords?.length > 0 && (
                <div className="text-xs mb-1">
                  <span className="text-gray-400">Keywords:</span> {r.trigger_keywords.join(', ')}
                </div>
              )}
              {r.knowledge_body && (
                <div className="text-sm bg-gray-50 p-2 rounded mt-1">
                  <span className="text-gray-400 text-xs">Knowledge:</span> {r.knowledge_body.slice(0, 200)}
                </div>
              )}
              {r.instruction && (
                <div className="text-sm bg-gray-50 p-2 rounded mt-1">
                  <span className="text-gray-400 text-xs">Instruction:</span> {r.instruction.slice(0, 200)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
