import Link from 'next/link'

export interface SetupChecklistItem {
  key: string
  label: string
  hint: string
  done: boolean
  href: string
}

/**
 * "Ready to sell" checklist on the dashboard. The bot can only take orders, send
 * QR codes and alert the owner once these are set, and new shops had no way of
 * knowing that. Hidden once every item is done.
 */
export default function SetupChecklistCard({ items }: { items: SetupChecklistItem[] }) {
  const doneCount = items.filter((i) => i.done).length
  if (items.length === 0 || doneCount === items.length) return null
  const progress = Math.round((doneCount / items.length) * 100)

  return (
    <section className="rounded-2xl border border-outline-variant bg-white p-4 shadow-card sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-on-surface">ตั้งค่าร้านให้พร้อมขายอัตโนมัติ</h2>
          <p className="mt-0.5 text-xs text-on-surface-variant">บอทจะรับออเดอร์ ส่ง QR และแจ้งเตือนคุณได้ครบ เมื่อตั้งค่าครบทุกข้อ</p>
        </div>
        <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
          {doneCount}/{items.length}
        </span>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-container">
        <div className="h-full rounded-full bg-amber-500" style={{ width: `${progress}%` }} />
      </div>

      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                item.done ? 'border-emerald-100 bg-emerald-50/60' : 'border-outline-variant bg-surface-container-low hover:border-primary/40'
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  item.done ? 'bg-emerald-500 text-white' : 'border border-outline-variant bg-white text-transparent'
                }`}
              >
                ✓
              </span>
              <span className="min-w-0">
                <span className={`block text-sm font-semibold ${item.done ? 'text-emerald-700' : 'text-on-surface'}`}>{item.label}</span>
                {!item.done && <span className="mt-0.5 block text-xs text-on-surface-variant">{item.hint}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
