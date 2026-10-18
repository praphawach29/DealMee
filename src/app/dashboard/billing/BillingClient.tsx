'use client'

import { useState } from 'react'
import { effectivePlanKey, TRIAL_MESSAGE_LIMIT } from '@/lib/billing/trial'
import Link from 'next/link'
import { PlanItem } from '@/app/admin/actions'
import { PlatformBillingSettings } from '@/lib/billing/manualBilling'
import UpgradeButton from './UpgradeButton'
import PromptPayPaymentModal from './PromptPayPaymentModal'
import { QrCode, FileText, ExternalLink, CheckCircle2, Clock, XCircle } from 'lucide-react'

interface BillingClientProps {
  shop: any
  plans: PlanItem[]
  platformSettings: PlatformBillingSettings
  usage: { messages_used: number; tokens_used: number }
  payments: any[]
}

const STATUS_LABEL_TH: Record<string, string> = {
  active: 'ใช้งานอยู่',
  past_due: 'ค้างชำระ',
  canceled: 'ยกเลิกแล้ว',
}

const PAYMENT_STATUS_LABEL_TH: Record<string, { label: string; color: string; icon: any }> = {
  succeeded: { label: 'ชำระสำเร็จ', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800', icon: CheckCircle2 },
  verified: { label: 'ชำระสำเร็จ', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800', icon: CheckCircle2 },
  pending: { label: 'รอตรวจสอบ', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800', icon: Clock },
  rejected: { label: 'ไม่ผ่าน', color: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800', icon: XCircle },
  failed: { label: 'ล้มเหลว', color: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800', icon: XCircle },
}

export default function BillingClient({
  shop,
  plans,
  platformSettings,
  usage,
  payments,
}: BillingClientProps) {
  const [selectedPromptPayPlan, setSelectedPromptPayPlan] = useState<PlanItem | null>(null)
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)

  const currentPlanKey = effectivePlanKey(shop)
  // A running trial has no `plans` row; show it with the trial's own message allowance
  const currentPlan = currentPlanKey === 'trial'
    ? ({ ...(plans.find((p) => p.key === 'pro') || {}), key: 'trial', name: 'Trial', messages: TRIAL_MESSAGE_LIMIT } as PlanItem)
    : plans.find((p) => p.key === currentPlanKey)

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
              {shop.subscription_provider ? ` · ชำระผ่าน ${shop.subscription_provider === 'stripe' ? 'Stripe' : 'PromptPay'}` : ''}
            </p>
            {shop.plan_expires_at && (
              <p className="text-xs text-on-surface-variant mt-0.5 font-semibold text-indigo-600 dark:text-indigo-400">
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
                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPromptPayPlan(plan)}
                    className="w-full py-2.5 px-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs hover:shadow-md cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98]"
                  >
                    <QrCode className="h-4 w-4" />
                    <span>PromptPay (สแกนจ่าย + แนบสลิป)</span>
                  </button>

                  <div className="flex gap-2">
                    <UpgradeButton
                      planKey={plan.key}
                      provider="stripe"
                      label="บัตรเครดิต (Stripe)"
                      className="w-full py-2 px-3 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface font-semibold text-[11px] rounded-xl transition-all border border-outline-variant/30 cursor-pointer disabled:opacity-50 text-center"
                      onQrReady={setQrImageUrl}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Payment History Table */}
      {payments.length > 0 && (
        <div className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-on-surface">ประวัติการชำระเงินและใบเสร็จ</h2>
            <span className="text-[11px] text-on-surface-variant">แสดง {payments.length} รายการล่าสุด</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-on-surface-variant text-left border-b border-outline-variant/30">
                  <th className="py-2.5 pr-4">วันที่</th>
                  <th className="py-2.5 pr-4">ช่องทาง</th>
                  <th className="py-2.5 pr-4">แพ็กเกจ</th>
                  <th className="py-2.5 pr-4">ยอดเงินสุทธิ</th>
                  <th className="py-2.5 pr-4">สถานะ</th>
                  <th className="py-2.5 pr-4 text-right">เอกสาร</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {payments.map((p) => {
                  const statusConfig = PAYMENT_STATUS_LABEL_TH[p.status] || {
                    label: p.status,
                    color: 'bg-slate-100 text-slate-700 border-slate-200',
                    icon: Clock,
                  }
                  const StatusIcon = statusConfig.icon
                  const isVerified = p.status === 'verified' || p.status === 'succeeded'

                  return (
                    <tr key={p.id} className="hover:bg-surface-container-lowest transition-colors">
                      <td className="py-3 pr-4 text-on-surface-variant font-mono">
                        {new Date(p.created_at).toLocaleDateString('th-TH')}
                      </td>
                      <td className="py-3 pr-4 font-medium">
                        {p.provider === 'promptpay' ? 'PromptPay QR' : p.provider === 'stripe' ? 'Stripe' : 'Omise'}
                      </td>
                      <td className="py-3 pr-4 font-bold uppercase">{p.plan_key || '-'}</td>
                      <td className="py-3 pr-4 font-mono font-bold">
                        ฿{Number(p.transferred_amount || p.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        {Number(p.withheld_amount || 0) > 0 && (
                          <span className="block text-[10px] text-amber-600 font-normal">
                            หัก ณ ที่จ่าย 3%: ฿{Number(p.withheld_amount).toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusConfig.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          <span>{statusConfig.label}</span>
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        {isVerified ? (
                          <a
                            href={`/dashboard/billing/receipt/${p.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 text-indigo-600 dark:text-indigo-400 font-bold text-[11px] border border-indigo-200 dark:border-indigo-800/80 transition-all cursor-pointer"
                          >
                            <FileText className="h-3 w-3" />
                            <span>ดูใบเสร็จ</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ) : (
                          <span className="text-outline text-[11px]">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PromptPay Payment Modal */}
      {selectedPromptPayPlan && (
        <PromptPayPaymentModal
          isOpen={Boolean(selectedPromptPayPlan)}
          onClose={() => setSelectedPromptPayPlan(null)}
          plan={selectedPromptPayPlan}
          platformSettings={platformSettings}
          onPaymentSuccess={() => {
            // Refreshes data after success
          }}
        />
      )}

      {/* Legacy Omise QR Modal (if triggered via UpgradeButton) */}
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

