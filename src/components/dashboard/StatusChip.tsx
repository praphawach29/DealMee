import { orderStatusMeta } from '@/lib/dashboard/metrics'
import { cn } from '@/lib/utils'

const TONE = {
  success: 'bg-emerald-50 text-emerald-700',
  info: 'bg-sky-50 text-sky-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-rose-50 text-rose-700',
  neutral: 'bg-slate-100 text-slate-600',
}

export function OrderStatusChip({ status, className }: { status: string | null | undefined; className?: string }) {
  const meta = orderStatusMeta(status)
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none', TONE[meta.tone], className)}>
      {meta.label}
    </span>
  )
}

export function DeltaPill({ label, tone }: { label: string; tone: 'up' | 'down' | 'flat' | 'new' }) {
  const toneClass =
    tone === 'down'
      ? 'bg-rose-50 text-rose-600'
      : tone === 'flat'
        ? 'bg-slate-100 text-slate-600'
        : 'bg-emerald-50 text-emerald-700'
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', toneClass)}>{label}</span>
}
