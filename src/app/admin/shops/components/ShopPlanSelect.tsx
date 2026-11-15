import React from 'react'

interface ShopPlanSelectProps {
  currentPlan: string | null
  disabled?: boolean
  onChange: (newPlan: string) => void
  variant?: 'card' | 'table'
}

export function ShopPlanSelect({
  currentPlan,
  disabled,
  onChange,
  variant = 'card',
}: ShopPlanSelectProps) {
  const className =
    variant === 'table'
      ? 'font-bold text-xs uppercase bg-surface-container-high border border-outline-variant/40 rounded-lg px-2.5 py-1.5 text-amber-600 outline-none cursor-pointer hover:border-amber-500 transition-colors'
      : 'font-bold uppercase text-xs bg-transparent text-amber-600 outline-none cursor-pointer mt-0.5'

  return (
    <select
      value={currentPlan || 'free'}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      <option value="free">FREE</option>
      <option value="starter">STARTER</option>
      <option value="pro">PRO</option>
      <option value="agency">AGENCY</option>
      <option value="byok">BYOK</option>
    </select>
  )
}

