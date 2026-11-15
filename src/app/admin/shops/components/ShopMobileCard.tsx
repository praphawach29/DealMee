import React from 'react'
import { Mail, Copy, Check } from 'lucide-react'
import { ShopItem } from '../ShopsManagement'
import { ShopChannelBadges } from './ShopChannelBadges'
import { ShopStatusBadge } from './ShopStatusBadge'
import { ShopPlanSelect } from './ShopPlanSelect'

interface ShopMobileCardProps {
  shop: ShopItem
  isLoading: boolean
  copiedEmailId: string | null
  onCopyEmail: (email: string, shopId: string) => void
  onPlanChange: (shopId: string, newPlan: string) => void
  onImpersonate: (shopId: string) => void
  onToggleStatus: (shop: ShopItem) => void
}

export function ShopMobileCard({
  shop,
  isLoading,
  copiedEmailId,
  onCopyEmail,
  onPlanChange,
  onImpersonate,
  onToggleStatus,
}: ShopMobileCardProps) {
  const isSuspended = shop.status === 'suspended'

  return (
    <div className="bg-surface border border-outline-variant/40 rounded-2xl p-4 shadow-sm space-y-3.5 hover:shadow-md transition-shadow flex flex-col justify-between">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2 border-b border-outline-variant/20 pb-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-heading font-semibold text-sm sm:text-base text-on-surface truncate">
              {shop.name}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium mt-1 truncate">
              <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate select-all">{shop.owner_email || 'ไม่ระบุอีเมล'}</span>
              {shop.owner_email && shop.owner_email !== 'ไม่ระบุอีเมล' && (
                <button
                  type="button"
                  onClick={() => onCopyEmail(shop.owner_email!, shop.id)}
                  className="hover:text-blue-700 p-0.5 rounded cursor-pointer shrink-0"
                  title="คัดลอกอีเมล"
                >
                  {copiedEmailId === shop.id ? (
                    <Check className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <Copy className="h-3 w-3 text-slate-400" />
                  )}
                </button>
              )}
            </div>
            <p className="text-[10px] text-outline font-mono truncate mt-0.5 opacity-60">
              ID: {shop.id}
            </p>
          </div>
          <ShopStatusBadge status={shop.status} />
        </div>

        {/* Connected Channels Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-outline font-medium">ช่องทาง:</span>
          <ShopChannelBadges
            hasLine={shop.has_line}
            hasFacebook={shop.has_facebook}
            facebookPageId={shop.facebook_page_id}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs bg-merchant-bg p-3 rounded-xl border border-outline-variant/30">
          <div>
            <span className="text-[10px] text-outline block font-medium">แพ็กเกจ</span>
            <ShopPlanSelect
              currentPlan={shop.plan}
              disabled={isLoading}
              onChange={(newPlan) => onPlanChange(shop.id, newPlan)}
            />
          </div>

          <div>
            <span className="text-[10px] text-outline block font-medium">ข้อความที่ใช้</span>
            <span className="font-bold font-mono text-on-surface mt-0.5 block">
              {(shop.msg_used || 0).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-outline px-1">
          <span>วันที่สมัคร:</span>
          <span className="font-medium text-on-surface-variant">
            {new Date(shop.created_at).toLocaleDateString('th-TH')}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-outline-variant/20">
        <button
          type="button"
          onClick={() => onImpersonate(shop.id)}
          disabled={isLoading}
          className="flex items-center justify-center gap-1.5 py-2 px-3 bg-electric-blue/10 hover:bg-electric-blue/20 text-electric-blue font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[16px]">key</span>
          <span>สวมบทบาท</span>
        </button>

        <button
          type="button"
          onClick={() => onToggleStatus(shop)}
          disabled={isLoading}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50 ${
            isSuspended
              ? 'bg-success-green/10 text-success-green hover:bg-success-green/20'
              : 'bg-error-red/10 text-error-red hover:bg-error-red/20'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">
            {isSuspended ? 'play_arrow' : 'block'}
          </span>
          <span>{isSuspended ? 'ปลดระงับ' : 'ระงับร้านค้า'}</span>
        </button>
      </div>
    </div>
  )
}

