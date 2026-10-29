'use client'

import { useEffect, useState } from 'react'

type Memory = {
  id: string
  memory_type: 'procedure' | 'preference' | 'pitfall' | 'fact'
  category: string
  content: string
  confidence: number
  usage_count: number
  created_at: string
}

const TYPE_LABELS: Record<string, string> = {
  procedure: '📋 ขั้นตอน',
  preference: '⭐ ความชอบ',
  pitfall: '⚠️ ข้อควรระวัง',
  fact: '📌 ข้อเท็จจริง',
}

export default function AgentMemoryPage() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [newContent, setNewContent] = useState('')
  const [newType, setNewType] = useState<Memory['memory_type']>('fact')
  const [newCategory, setNewCategory] = useState('general')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/shop/agent-memory')
      if (res.ok) {
        const data = await res.json()
        setMemories(data.memories ?? [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!newContent.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/shop/agent-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memory_type: newType, category: newCategory, content: newContent }),
      })
      if (res.ok) {
        setNewContent('')
        await load()
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('ลบ memory นี้?')) return
    try {
      await fetch(`/api/shop/agent-memory?id=${id}`, { method: 'DELETE' })
      await load()
    } catch { /* ignore */ }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">🧠 Agent Memory</h1>
      <p className="text-sm text-gray-500 mb-6">ความรู้ที่บอทเรียนรู้เอง (cross-conversation)</p>

      {/* Add new memory */}
      <div className="border rounded-lg p-4 mb-6 bg-gray-50">
        <h2 className="font-semibold mb-3">เพิ่ม Memory ใหม่</h2>
        <div className="flex gap-2 mb-2">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as Memory['memory_type'])}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="procedure">ขั้นตอน</option>
            <option value="preference">ความชอบ</option>
            <option value="pitfall">ข้อควรระวัง</option>
            <option value="fact">ข้อเท็จจริง</option>
          </select>
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="หมวดหมู่ (เช่น sales, shipping)"
            className="border rounded px-2 py-1 text-sm flex-1"
          />
        </div>
        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="เนื้อหา memory..."
          className="border rounded px-2 py-1 text-sm w-full mb-2"
          rows={3}
        />
        <button
          onClick={handleAdd}
          disabled={saving || !newContent.trim()}
          className="bg-blue-600 text-white px-4 py-1 rounded text-sm disabled:opacity-50"
        >
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </div>

      {/* Memory list */}
      {loading ? (
        <p className="text-gray-400">กำลังโหลด...</p>
      ) : memories.length === 0 ? (
        <p className="text-gray-400">ยังไม่มี memory</p>
      ) : (
        <div className="space-y-3">
          {memories.map((m) => (
            <div key={m.id} className="border rounded-lg p-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <span className="text-xs font-medium text-gray-500">{TYPE_LABELS[m.memory_type]} · {m.category}</span>
                  <p className="text-sm mt-1">{m.content}</p>
                  <span className="text-xs text-gray-400 mt-1 block">
                    ใช้ {m.usage_count} ครั้ง · confidence {m.confidence} · {new Date(m.created_at).toLocaleDateString('th-TH')}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(m.id)}
                  className="text-red-500 text-xs ml-2 hover:underline"
                >
                  ลบ
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
