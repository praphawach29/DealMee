import React from 'react'
import { Mail, Copy, Check } from 'lucide-react'
import { ShopItem } from '../ShopsManagement'
import { ShopChannelBadges } from './ShopChannelBadges'
import { ShopStatusBadge } from './ShopStatusBadge'
import { ShopPlanSelect } from './ShopPlanSelect'

interface ShopTableRowProps {
  shop: ShopItem
  isLoading: boolean
  copiedEmailId: string | null
  onCopyEmail: (email: string, shopId: string) => void
  onPlanChange: (shopId: string, newPlan: string) => void
  onImpersonate: (shopId: string) => void
  onToggleStatus: (shop: ShopItem) => void
}

export function ShopTableRow({
  shop,
  isLoading,
  copiedEmailId,
  onCopyEmail,
  onPlanChange,
  onImpersonate,
  onToggleStatus,
}: ShopTableRowProps) {
  const isSuspended = shop.status === 'suspended'

  return (
    <tr className="hover:bg-surface-container-low/50 transition-colors">
      <td className="py-4 px-6">
        <p className="font-bold text-on-surface text-sm sm:text-base">{shop.name}</p>
        <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium mt-1 group">
          <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="select-all font-mono">{shop.owner_email || 'ไม่ระบุอีเมล'}</span>
          {shop.owner_email && shop.owner_email !== 'ไม่ระบุอีเมล' && (
            <button
              type="button"
              onClick={() => onCopyEmail(shop.owner_email!, shop.id)}
              className="opacity-60 group-hover:opacity-100 hover:text-blue-700 transition-opacity p-0.5 rounded cursor-pointer"
              title="คัดลอกอีเมล"
            >
              {copiedEmailId === shop.id ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600" />
              )}
            </button>
          )}
        </div>
        <p className="text-[10px] text-outline font-mono mt-0.5 opacity-60">ID: {shop.id}</p>
      </td>

      <td className="py-4 px-4">
        <ShopPlanSelect
          currentPlan={shop.plan}
          disabled={isLoading}
          onChange={(newPlan) => onPlanChange(shop.id, newPlan)}
          variant="table"
        />
      </td>

      <td className="py-4 px-4">
        <ShopChannelBadges
          hasLine={shop.has_line}
          hasFacebook={shop.has_facebook}
          facebookPageId={shop.facebook_page_id}
          layout="col"
        />
      </td>

      <td className="py-4 px-4 font-mono font-bold text-on-surface">
        {(shop.msg_used || 0).toLocaleString()}
      </td>

      <td className="py-4 px-4">
        <ShopStatusBadge status={shop.status} />
      </td>

      <td className="py-4 px-4 text-xs text-on-surface-variant">
        {new Date(shop.created_at).toLocaleDateString('th-TH')}
      </td>

      <td className="py-4 px-6 text-right space-x-2">
        <button
          type="button"
          onClick={() => onImpersonate(shop.id)}
          disabled={isLoading}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-electric-blue/10 hover:bg-electric-blue/20 text-electric-blue font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[16px]">key</span>
          <span>สวมบทบาท</span>
        </button>

        <button
          type="button"
          onClick={() => onToggleStatus(shop)}
          disabled={isLoading}
          className={`inline-flex items-center gap-1 px-3 py-1.5 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50 ${
            isSuspended
              ? 'bg-success-green/10 text-success-green hover:bg-success-green/20'
              : 'bg-error-red/10 text-error-red hover:bg-error-red/20'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">
            {isSuspended ? 'play_arrow' : 'block'}
          </span>
          <span>{isSuspended ? 'ปลดระงับ' : 'ระงับ'}</span>
        </button>
      </td>
    </tr>
  )
}

