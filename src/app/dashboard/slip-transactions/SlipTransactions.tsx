'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'

type Txn = {
  id: string
  amount: number
  trans_ref: string | null
  trans_date: string | null
  sender_name: string | null
  receiver_name: string | null
  bank: string | null
  status: 'pending' | 'confirmed' | 'rejected'
  note: string | null
  created_at: string
}

export default function SlipTransactions() {
  const [txns, setTxns] = useState<Txn[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [updating, setUpdating] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const url = filter === 'all' ? '/api/shop/slip-transactions' : `/api/shop/slip-transactions?status=${filter}`
    const res = await fetch(url, { cache: 'no-store' })
    const payload = await res.json().catch(() => ({}))
    setTxns(payload.transactions ?? [])
    setLoading(false)
  }, [filter])

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(t)
  }, [load])

  async function mutate(id: string, action: 'confirm' | 'reject') {
    setUpdating(id)
    await fetch('/api/shop/slip-transactions', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, action }),
    })
    await load()
    setUpdating(null)
  }

  const totalPending = txns.filter((t) => t.status === 'pending').reduce((s, t) => s + Number(t.amount), 0)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">บันทึกสลิป (Slip Transactions)</h1>
          <p className="mt-1 text-sm text-slate-600">รายการสลิปที่ถ่ายผ่าน LINE — ตรวจสอบและยืนยัน</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          รอตรวจสอบ: {txns.filter((t) => t.status === 'pending').length} รายการ ({totalPending.toLocaleString()} บาท)
        </div>
      </header>

      <div className="flex gap-2">
        {['all', 'pending', 'confirmed', 'rejected'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${filter === s ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}
          >
            {s === 'all' ? 'ทั้งหมด' : s === 'pending' ? 'รอตรวจสอบ' : s === 'confirmed' ? 'ยืนยันแล้ว' : 'ปฏิเสธ'}
          </button>
        ))}
      </div>

      {loading && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="animate-spin" size={16} /> กำลังโหลด</div>}

      {!loading && txns.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          ยังไม่มีรายการสลิป
        </div>
      )}

      <div className="space-y-3">
        {txns.map((txn) => (
          <article key={txn.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-slate-900">
                  {Number(txn.amount).toLocaleString()} บาท
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                    txn.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                    txn.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {txn.status === 'pending' ? 'รอตรวจสอบ' : txn.status === 'confirmed' ? 'ยืนยันแล้ว' : 'ปฏิเสธ'}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {txn.trans_ref && `Ref: ${txn.trans_ref} · `}
                  {txn.sender_name && `จาก: ${txn.sender_name} · `}
                  {new Date(txn.created_at).toLocaleString('th-TH')}
                </div>
                {txn.note && <p className="mt-2 text-sm text-slate-600">{txn.note}</p>}
              </div>
              {txn.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    disabled={updating === txn.id}
                    onClick={() => void mutate(txn.id, 'confirm')}
                    className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {updating === txn.id ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />} ยืนยัน
                  </button>
                  <button
                    disabled={updating === txn.id}
                    onClick={() => void mutate(txn.id, 'reject')}
                    className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-50"
                  >
                    <XCircle size={14} /> ปฏิเสธ
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
