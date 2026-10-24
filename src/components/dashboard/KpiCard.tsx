import type { LucideIcon } from 'lucide-react'
import { DeltaPill } from './StatusChip'
import type { Delta } from '@/lib/dashboard/metrics'

export function KpiCard({
  icon: Icon,
  iconClass,
  label,
  value,
  hint,
  delta,
}: {
  icon: LucideIcon
  iconClass: string
  label: string
  value: string
  hint: string
  delta?: Delta | null
}) {
  return (
    <article className="flex flex-col justify-between rounded-2xl border border-outline-variant bg-white p-4 shadow-card sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClass}`}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
        {delta ? <DeltaPill label={delta.label} tone={delta.tone} /> : null}
      </div>
      <div>
        <p className="text-xs font-medium text-on-surface-variant">{label}</p>
        <p className="font-heading mt-1 text-2xl font-semibold tracking-tight text-on-surface">{value}</p>
        <p className="mt-1 text-[11px] text-outline">{hint}</p>
      </div>
    </article>
  )
}
