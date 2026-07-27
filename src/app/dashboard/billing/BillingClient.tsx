'use client'

import { useState } from 'react'
import { PlanItem } from '@/app/admin/actions'
import UpgradeButton from './UpgradeButton'

interface BillingClientProps {
  shop: any
  plans: PlanItem[]
  usage: { messages_used: number; tokens_used: number }
  payments: any[]
}

const STATUS_LABEL_TH: Record<string, string> = {
  active: 'ใช้งานอยู่',
  past_due: 'ค้างชำระ',
  canceled: 'ยกเลิกแล้ว',
}

const PAYMENT_STATUS_LABEL_TH: Record<string, string> = {
  succeeded: 'สำเร็จ',
  pending: 'รอดำเนินการ',
  failed: 'ล้มเหลว',
}

export default function BillingClient({ shop, plans, usage, payments }: BillingClientProps) {
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)

  const currentPlanKey = shop.plan_key || shop.plan || 'free'
  const currentPlan = plans.find((p) => p.key === currentPlanKey)

  const isUnlimitedMsg = (currentPlan?.messages ?? 0) < 0
  const isUnlimitedTokens = (currentPlan?.tokens ?? 0) < 0
  const messagesPct = isUnlimitedMsg || !currentPlan?.messages
    ? 0
    : Math.min(100, Math.round((usage.messages_used / currentPlan.messages) * 100))
  const tokensPct = isUnlimitedTokens || !currentPlan?.tokens
    ? 0
    : Math.min(100, Math.round((usage.tokens_used / currentPlan.tokens) * 100))

  const handleManageBilling = async () => {
    setPortalLoading(true)
    setPortalError(null)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || data.error) {
        setPortalError(data.error || 'เกิดข้อผิดพลาด')
        setPortalLoading(false)
        return
      }
      window.location.href = data.url
    } catch {
      setPortalError('เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
      setPortalLoading(false)
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-on-surface font-headline-md leading-tight">
          แพ็กเกจและการชำระเงิน
        </h1>
        <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5 font-body-md">
          ดูแพ็กเกจปัจจุบัน การใช้งาน และอัปเกรดแพ็กเกจของร้านค้า
        </p>
      </div>

      {/* Current Plan Card */}
      <div className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${currentPlan?.badge_color || 'bg-surface-container-high text-on-surface'}`}>
              {currentPlan?.name || currentPlanKey}
            </span>
            <p className="text-xs text-on-surface-variant mt-1.5">
              สถานะ: {STATUS_LABEL_TH[shop.subscription_status] || shop.subscription_status || 'ใช้งานอยู่'}
              {shop.subscription_provider ? ` · ชำระผ่าน ${shop.subscription_provider === 'stripe' ? 'Stripe' : 'Omise (PromptPay)'}` : ''}
            </p>
            {shop.plan_expires_at && (
              <p className="text-xs text-on-surface-variant mt-0.5">
                ใช้งานได้ถึง: {new Date(shop.plan_expires_at).toLocaleDateString('th-TH')}
              </p>
            )}
          </div>

          {shop.subscription_provider === 'stripe' && (
            <div className="flex flex-col gap-1 items-end">
              <button
                type="button"
                onClick={handleManageBilling}
                disabled={portalLoading}
                className="px-4 py-2 bg-surface-container-high hover:bg-amber-500/10 hover:text-amber-600 text-on-surface font-bold text-xs rounded-xl transition-all border border-outline-variant/40 cursor-pointer disabled:opacity-50"
              >
                {portalLoading ? 'กำลังโหลด...' : 'จัดการการชำระเงิน'}
              </button>
              {portalError && <p className="text-[11px] text-error-red">{portalError}</p>}
            </div>
          )}
        </div>

        {/* Usage Bars */}
        <div className="pt-3 border-t border-outline-variant/30 space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-on-surface-variant">ข้อความที่ใช้ไปเดือนนี้</span>
              <strong className="font-mono text-on-surface">
                {isUnlimitedMsg
                  ? 'ไม่จำกัด'
                  : `${usage.messages_used.toLocaleString()} / ${(currentPlan?.messages ?? 0).toLocaleString()}`}
              </strong>
            </div>
            {!isUnlimitedMsg && (
              <div className="h-2 rounded-full bg-surface-container-high overflow-hidden">
                <div
                  className={`h-full rounded-full ${messagesPct >= 100 ? 'bg-error-red' : messagesPct >= 80 ? 'bg-amber-500' : 'bg-electric-blue'}`}
                  style={{ width: `${messagesPct}%` }}
                />
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-on-surface-variant">Token ที่ใช้ไปเดือนนี้</span>
              <strong className="font-mono text-on-surface">
                {isUnlimitedTokens
                  ? 'ไม่จำกัด'
                  : `${(usage.tokens_used / 1000000).toFixed(2)}M / ${((currentPlan?.tokens ?? 0) / 1000000).toFixed(1)}M`}
              </strong>
            </div>
            {!isUnlimitedTokens && (
              <div className="h-2 rounded-full bg-surface-container-high overflow-hidden">
                <div
                  className={`h-full rounded-full ${tokensPct >= 100 ? 'bg-error-red' : tokensPct >= 80 ? 'bg-amber-500' : 'bg-electric-blue'}`}
                  style={{ width: `${tokensPct}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Plan Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
        {plans.map((plan) => {
          const isCurrent = plan.key === currentPlanKey
          const isFree = plan.price === 0

          return (
            <div
              key={plan.key}
              className={`bg-surface border rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between space-y-4 transition-all ${
                isCurrent ? 'border-amber-500/50 ring-1 ring-amber-500/30' : 'border-outline-variant/40 hover:shadow-md'
              }`}
            >
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${plan.badge_color || 'bg-surface-container-high text-on-surface'}`}>
                    {plan.name}
                  </span>
                  {isCurrent && (
                    <span className="text-xs font-bold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                      แพ็กเกจปัจจุบัน
                    </span>
                  )}
                </div>

                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-on-surface font-headline-md">
                      ฿{plan.price.toLocaleString()}
                    </span>
                    <span className="text-xs text-outline font-medium">/ เดือน</span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{plan.description}</p>
                </div>

                <div className="pt-3 border-t border-outline-variant/30 space-y-2 text-xs text-on-surface">
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant">โควต้าข้อความ:</span>
                    <strong className="font-mono">
                      {plan.messages < 0 ? 'ไม่จำกัด' : `${plan.messages.toLocaleString()} ข้อความ`}
                    </strong>
                  </div>
                </div>
              </div>

              {!isCurrent && !isFree && (
                <div className="grid grid-cols-2 gap-2">
                  <UpgradeButton
                    planKey={plan.key}
                    provider="stripe"
                    label="บัตรเครดิต"
                    className="w-full py-2.5 px-3 bg-electric-blue/10 hover:bg-electric-blue/20 text-electric-blue font-bold text-xs rounded-xl transition-all border border-electric-blue/20 cursor-pointer disabled:opacity-50"
                    onQrReady={setQrImageUrl}
                  />
                  <UpgradeButton
                    planKey={plan.key}
                    provider="omise"
                    label="PromptPay"
                    className="w-full py-2.5 px-3 bg-success-green/10 hover:bg-success-green/20 text-success-green font-bold text-xs rounded-xl transition-all border border-success-green/20 cursor-pointer disabled:opacity-50"
                    onQrReady={setQrImageUrl}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Payment History */}
      {payments.length > 0 && (
        <div className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-5 shadow-sm">
          <h2 className="text-sm font-bold text-on-surface mb-3">ประวัติการชำระเงิน</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-on-surface-variant text-left border-b border-outline-variant/30">
                  <th className="py-2 pr-4">วันที่</th>
                  <th className="py-2 pr-4">ช่องทาง</th>
                  <th className="py-2 pr-4">แพ็กเกจ</th>
                  <th className="py-2 pr-4">ยอดเงิน</th>
                  <th className="py-2 pr-4">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-outline-variant/10">
                    <td className="py-2 pr-4 text-on-surface-variant">{new Date(p.created_at).toLocaleDateString('th-TH')}</td>
                    <td className="py-2 pr-4">{p.provider === 'stripe' ? 'Stripe' : 'Omise'}</td>
                    <td className="py-2 pr-4">{p.plan_key || '-'}</td>
                    <td className="py-2 pr-4 font-mono">฿{Number(p.amount).toLocaleString()}</td>
                    <td className="py-2 pr-4">{PAYMENT_STATUS_LABEL_TH[p.status] || p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Omise QR Modal */}
      {qrImageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 text-center">
            <h3 className="font-bold text-base">สแกน QR เพื่อชำระเงิน</h3>
            <img src={qrImageUrl} alt="PromptPay QR" className="w-full rounded-xl bg-white p-3" />
            <p className="text-xs text-slate-400">
              สแกนด้วยแอปธนาคารของคุณ เมื่อชำระเงินสำเร็จ ระบบจะอัปเกรดแพ็กเกจให้อัตโนมัติภายในไม่กี่วินาที
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setQrImageUrl(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ปิด
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold text-xs cursor-pointer"
              >
                ฉันชำระเงินแล้ว
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
