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

  return (
    <section className="bg-surface border border-amber-300/60 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-on-surface">🚀 ตั้งค่าร้านให้พร้อมขายอัตโนมัติ</h2>
          <p className="text-[11px] sm:text-xs text-on-surface-variant">
            บอทจะรับออเดอร์ ส่ง QR และแจ้งเตือนคุณได้ครบ เมื่อตั้งค่าครบทุกข้อ
          </p>
        </div>
        <span className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800">
          {doneCount}/{items.length}
        </span>
      </div>

      <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.round((doneCount / items.length) * 100)}%` }} />
      </div>

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                item.done
                  ? 'border-emerald-200 bg-emerald-50/50'
                  : 'border-outline-variant/50 bg-merchant-bg hover:border-electric-blue/50'
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  item.done ? 'bg-emerald-500 text-white' : 'border-2 border-outline-variant text-transparent'
                }`}
              >
                ✓
              </span>
              <span className="min-w-0">
                <span className={`block text-xs sm:text-sm font-bold ${item.done ? 'text-emerald-700' : 'text-on-surface'}`}>
                  {item.label}
                </span>
                {!item.done && <span className="block text-[11px] sm:text-xs text-on-surface-variant mt-0.5">{item.hint}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
