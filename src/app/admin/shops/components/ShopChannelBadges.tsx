import React from 'react'

interface ShopChannelBadgesProps {
  hasLine?: boolean
  hasFacebook?: boolean
  facebookPageId?: string | null
  layout?: 'row' | 'col'
}

export function ShopChannelBadges({
  hasLine,
  hasFacebook,
  facebookPageId,
  layout = 'row',
}: ShopChannelBadgesProps) {
  const containerClass = layout === 'col' ? 'flex flex-col gap-1.5' : 'flex items-center gap-1.5 flex-wrap'

  return (
    <div className={containerClass}>
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
          hasLine
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
            : 'bg-slate-500/10 text-slate-400 border border-slate-500/20 opacity-60'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${hasLine ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
        <span>LINE OA</span>
      </span>

      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
          hasFacebook
            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
            : 'bg-slate-500/10 text-slate-400 border border-slate-500/20 opacity-60'
        }`}
        title={facebookPageId ? `Page ID: ${facebookPageId}` : undefined}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${hasFacebook ? 'bg-blue-500' : 'bg-slate-400'}`}></span>
        <span>Facebook</span>
        {facebookPageId && (
          <span className="text-[9px] opacity-70 font-mono">({facebookPageId.slice(-4)})</span>
        )}
      </span>
    </div>
  )
}

