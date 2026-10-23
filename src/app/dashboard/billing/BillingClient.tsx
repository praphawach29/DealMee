'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { PLAN_GRACE_DAYS, planLapsed } from '@/lib/billing/trial'
import { PlanItem } from '@/app/admin/actions'
import { PlatformBillingSettings } from '@/lib/billing/manualBilling'
import type { PlanLimits } from '@/lib/billing/planLimits'
import TopUpModal from './TopUpModal'
import { buyPlanWithWallet, buyAddonWithWallet, setWalletAutoRenew } from './actions'
import { FileText, ExternalLink, CheckCircle2, Clock, XCircle, Wallet, Plus, MessageSquare, Receipt, AlertTriangle, X, ShoppingBag } from 'lucide-react'

interface AddonPack {
  key: string
  kind: 'messages' | 'slips'
  name: string
  quantity: number
  price: number
  valid_days: number
}

interface WalletTransaction {
  id: string
  kind: string
  amount: number
  balance_after: number
  description: string | null
  created_at: string
}

interface BillingClientProps {
  shop: any
  plans: PlanItem[]
  platformSettings: PlatformBillingSettings
  topUpEnabled: boolean
  limits: PlanLimits
  usage: { messages_used: number; slips_used: number }
  payments: any[]
  wallet: { balance: number; auto_renew: boolean }
  transactions: WalletTransaction[]
  addonPacks: AddonPack[]
  addonCredits: { kind: string; remaining: number; expires_at: string }[]
}

const PAYMENT_STATUS_LABEL_TH: Record<string, { label: string; color: string; icon: any }> = {
  succeeded: { label: 'สำเร็จ', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800', icon: CheckCircle2 },
  verified: { label: 'สำเร็จ', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800', icon: CheckCircle2 },
  pending: { label: 'รอตรวจสอบ', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800', icon: Clock },
  rejected: { label: 'ไม่ผ่าน', color: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800', icon: XCircle },
  failed: { label: 'ล้มเหลว', color: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800', icon: XCircle },
}

const TRANSACTION_LABEL_TH: Record<string, string> = {
  topup: 'เติมเงิน',
  plan: 'ซื้อแพ็กเกจ',
  renewal: 'ต่ออายุอัตโนมัติ',
  plan_credit: 'คืนมูลค่าแพ็กเกจเดิม',
  addon: 'แพ็กเสริม',
  adjust: 'ปรับยอดโดยทีมงาน',
}

interface PendingPurchase {
  key: string
  title: string
  detail: string
  note?: string
  price: number
  run: () => Promise<any>
}

function baht(value: number) {
  return `฿${Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function thaiDate(value: string | Date) {
  return new Date(value).toLocaleDateString('th-TH', { dateStyle: 'medium' })
}

function UsageBar({ label, used, limit, addon, unit }: { label: string; used: number; limit: number; addon: number; unit: string }) {
  const unlimited = limit < 0
  const pct = unlimited || limit <= 0 ? (used > 0 ? 100 : 0) : Math.min(100, Math.round((used / limit) * 100))
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1 gap-2">
        <span className="text-on-surface-variant">{label}</span>
        <strong className="font-mono text-on-surface text-right">
          {unlimited ? 'ไม่จำกัด' : `${used.toLocaleString()} / ${limit.toLocaleString()} ${unit}`}
        </strong>
      </div>
      {!unlimited && (
        <div className="h-2 rounded-full bg-surface-container-high overflow-hidden">
          <div
            className={`h-full rounded-full ${pct >= 100 ? 'bg-error-red' : pct >= 80 ? 'bg-amber-500' : 'bg-electric-blue'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {addon > 0 && (
        <p className="text-[11px] text-success-green mt-1">+ แพ็กเสริมคงเหลือ {addon.toLocaleString()} {unit} (ใช้หลังโควตาแพ็กเกจหมด)</p>
      )}
    </div>
  )
}

export default function BillingClient({
  shop,
  plans,
  platformSettings,
  topUpEnabled,
  limits,
  usage,
  payments,
  wallet,
  transactions,
  addonPacks,
  addonCredits,
}: BillingClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [topUpAmount, setTopUpAmount] = useState<number | null>(null)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [pendingPurchase, setPendingPurchase] = useState<PendingPurchase | null>(null)

  // Keep the balance, plan and payments current without a reload: Realtime pushes
  // wallet and payment changes (an admin approving a top-up, a renewal), and the
  // page also refreshes when the tab comes back into view and every 30s while it is open
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') router.refresh()
    }
    const supabase = createClient()
    const channel = supabase
      .channel(`billing:${shop.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_wallets', filter: `shop_id=eq.${shop.id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'billing_payments', filter: `shop_id=eq.${shop.id}` }, refresh)
      .subscribe()
    const timer = window.setInterval(refresh, 30_000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
      supabase.removeChannel(channel)
    }
  }, [shop.id, router])

  const currentPlanKey = limits.planKey
  const currentPlan = plans.find((p) => p.key === currentPlanKey)
  const storedPlanKey = String(shop.plan_key || shop.plan || '').toLowerCase()
  const paysFromWallet = shop.subscription_provider === 'wallet' && Boolean(shop.plan_expires_at)
  const walletPlan = paysFromWallet ? plans.find((p) => p.key === storedPlanKey) : undefined
  const expiresAt = shop.plan_expires_at ? new Date(shop.plan_expires_at) : null
  const inGrace = Boolean(expiresAt && expiresAt.getTime() < Date.now() && !planLapsed(shop))
  const lapsed = paysFromWallet && planLapsed(shop)
  const balanceShort = Boolean(walletPlan && wallet.balance < walletPlan.price)

  const addonLeft = (kind: string) => addonCredits.filter((c) => c.kind === kind).reduce((sum, c) => sum + Number(c.remaining || 0), 0)
  const planName = currentPlanKey === 'trial' ? 'Trial (ทดลองใช้)' : currentPlan?.name || currentPlanKey.toUpperCase()

  const openTopUp = (amount?: number) => {
    if (!topUpEnabled) {
      setNotice({ type: 'error', text: 'ระบบเติมเงินยังไม่เปิดใช้งาน กรุณาติดต่อทีมงาน DealMee' })
      return
    }
    setTopUpAmount(Math.max(100, Math.ceil(amount || 1000)))
  }

  const runPurchase = (key: string, purchase: () => Promise<any>) => {
    setBusyKey(key)
    setNotice(null)
    startTransition(async () => {
      const result = await purchase()
      setBusyKey(null)
      if (result.success) {
        setNotice({ type: 'success', text: result.message })
        router.refresh()
      } else {
        setNotice({ type: 'error', text: result.error })
        if (result.needed) openTopUp(result.needed)
      }
    })
  }

  const confirmPurchase = () => {
    if (!pendingPurchase) return
    const { key, run } = pendingPurchase
    setPendingPurchase(null)
    runPurchase(key, run)
  }

  const handleBuyPlan = (plan: PlanItem) => {
    const isSamePlan = paysFromWallet && storedPlanKey === plan.key && !lapsed
    const switching = Boolean(paysFromWallet && storedPlanKey !== plan.key && expiresAt && expiresAt.getTime() > Date.now())
    setPendingPurchase({
      key: `plan:${plan.key}`,
      title: isSamePlan ? `ต่ออายุแพ็กเกจ ${plan.name}` : `ซื้อแพ็กเกจ ${plan.name}`,
      detail: isSamePlan ? 'ต่ออายุล่วงหน้าอีก 30 วัน' : 'ใช้งาน 30 วัน เริ่มนับจากวันนี้',
      note: switching ? 'มูลค่าวันที่เหลือของแพ็กเกจเดิมจะคืนเข้ากระเป๋าให้อัตโนมัติ' : undefined,
      price: plan.price,
      run: () => buyPlanWithWallet(plan.key),
    })
  }

  const handleBuyAddon = (pack: AddonPack) => {
    const unit = pack.kind === 'slips' ? 'ครั้ง' : 'ข้อความ'
    setPendingPurchase({
      key: `addon:${pack.key}`,
      title: `ซื้อ${pack.name}`,
      detail: `ใช้ได้ ${pack.valid_days} วัน`,
      note: `ระบบจะใช้แพ็กเสริมนี้หลังโควตา${unit}ของแพ็กเกจหมด`,
      price: pack.price,
      run: () => buyAddonWithWallet(pack.key),
    })
  }

  const handleAutoRenew = (value: boolean) => {
    startTransition(async () => {
      const result = await setWalletAutoRenew(value)
      if (!result.success) setNotice({ type: 'error', text: result.error || 'บันทึกไม่สำเร็จ' })
      router.refresh()
    })
  }

  const handleManageBilling = async () => {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || data.error) {
        setNotice({ type: 'error', text: data.error || 'เกิดข้อผิดพลาด' })
        setPortalLoading(false)
        return
      }
      window.location.href = data.url
    } catch {
      setNotice({ type: 'error', text: 'เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' })
      setPortalLoading(false)
    }
  }

  const paidPlans = plans.filter((p) => p.price > 0)
  const packsByKind = (kind: AddonPack['kind']) => addonPacks.filter((p) => p.kind === kind)

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-on-surface font-headline-md leading-tight">
          แพ็กเกจและกระเป๋าเงิน
        </h1>
        <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5 font-body-md">
          เติมเงินด้วย PromptPay แล้วใช้ยอดในกระเป๋าซื้อแพ็กเกจรายเดือนและแพ็กเสริม
        </p>
      </div>

      {notice && (
        <div
          className={`p-3 rounded-xl border text-xs ${
            notice.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900'
              : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900'
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
        {/* Wallet */}
        <div className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-on-surface-variant flex items-center gap-1.5">
                <Wallet className="h-4 w-4" /> ยอดเงินในกระเป๋า
              </p>
              <p className="text-3xl font-black text-on-surface font-mono mt-1">{baht(wallet.balance)}</p>
            </div>
            <button
              type="button"
              onClick={() => openTopUp(balanceShort && walletPlan ? walletPlan.price - wallet.balance : undefined)}
              disabled={!topUpEnabled}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4" /> เติมเงิน
            </button>
          </div>

          {!topUpEnabled && (
            <p className="text-[11px] text-amber-600">ระบบเติมเงินยังไม่เปิดใช้งาน กรุณาติดต่อทีมงาน DealMee</p>
          )}

          {paysFromWallet && walletPlan && (
            <div className="pt-3 border-t border-outline-variant/30 space-y-2 text-xs">
              <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
                <span className="text-on-surface">
                  ต่ออายุ {walletPlan.name} อัตโนมัติจากกระเป๋า ({baht(walletPlan.price)} / 30 วัน)
                </span>
                <input
                  type="checkbox"
                  checked={wallet.auto_renew}
                  disabled={isPending}
                  onChange={(e) => handleAutoRenew(e.target.checked)}
                  className="h-4 w-4 rounded text-indigo-600"
                />
              </label>
              {wallet.auto_renew && balanceShort && !lapsed && (
                <p className="flex items-start gap-1.5 text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>ยอดในกระเป๋าไม่พอต่ออายุรอบถัดไป เติมอีก {baht(walletPlan.price - wallet.balance)} ก่อนวันที่ {expiresAt ? thaiDate(expiresAt) : '-'}</span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Current plan + usage */}
        <div className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${currentPlan?.badge_color || 'bg-surface-container-high text-on-surface'}`}>
                {planName}
              </span>
              {expiresAt && !lapsed && (
                <p className="text-xs mt-1.5 font-semibold text-indigo-600 dark:text-indigo-400">
                  {inGrace
                    ? `ครบกำหนดแล้ว ใช้งานต่อได้ถึง ${thaiDate(new Date(expiresAt.getTime() + PLAN_GRACE_DAYS * 86_400_000))}`
                    : `ใช้งานได้ถึง ${thaiDate(expiresAt)}`}
                </p>
              )}
              {lapsed && (
                <p className="text-xs mt-1.5 text-rose-600">แพ็กเกจ {walletPlan?.name || storedPlanKey.toUpperCase()} หมดอายุแล้ว ซื้อแพ็กเกจเพื่อเปิดระบบขายอัตโนมัติอีกครั้ง</p>
              )}
            </div>

            {shop.subscription_provider === 'stripe' && (
              <button
                type="button"
                onClick={handleManageBilling}
                disabled={portalLoading}
                className="px-4 py-2 bg-surface-container-high hover:bg-amber-500/10 hover:text-amber-600 text-on-surface font-bold text-xs rounded-xl transition-all border border-outline-variant/40 cursor-pointer disabled:opacity-50"
              >
                {portalLoading ? 'กำลังโหลด...' : 'จัดการการชำระเงิน'}
              </button>
            )}
          </div>

          <div className="pt-3 border-t border-outline-variant/30 space-y-3">
            <UsageBar label="ข้อความ AI เดือนนี้" used={usage.messages_used} limit={limits.messages} addon={addonLeft('messages')} unit="ข้อความ" />
            <UsageBar label="ตรวจสลิปอัตโนมัติเดือนนี้" used={usage.slips_used} limit={limits.slips} addon={addonLeft('slips')} unit="ครั้ง" />
            {limits.slips === 0 && (
              <p className="text-[11px] text-on-surface-variant">แพ็กเกจนี้ยังไม่มีตรวจสลิปอัตโนมัติ สลิปจะส่งให้แอดมินตรวจเอง</p>
            )}
          </div>
        </div>
      </div>

      {/* Plans */}
      <div className="space-y-3">
        <h2 className="font-heading text-sm font-semibold text-on-surface">แพ็กเกจรายเดือน (30 วัน)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          {paidPlans.map((plan) => {
            const isCurrent = plan.key === currentPlanKey
            const isRenewal = isCurrent && paysFromWallet
            const busy = busyKey === `plan:${plan.key}`
            return (
              <div
                key={plan.key}
                className={`bg-surface border rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between gap-4 transition-all ${
                  isCurrent ? 'border-amber-500/50 ring-1 ring-amber-500/30' : 'border-outline-variant/40 hover:shadow-md'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${plan.badge_color || 'bg-surface-container-high text-on-surface'}`}>
                      {plan.name}
                    </span>
                    {isCurrent && (
                      <span className="text-[11px] font-bold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                        ปัจจุบัน
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-on-surface font-headline-md">฿{plan.price.toLocaleString()}</span>
                      <span className="text-xs text-outline font-medium">/ 30 วัน</span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{plan.description}</p>
                  </div>
                  <div className="pt-3 border-t border-outline-variant/30 space-y-1.5 text-xs text-on-surface">
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant">ข้อความ AI</span>
                      <strong className="font-mono">{plan.messages < 0 ? 'ไม่จำกัด' : `${plan.messages.toLocaleString()} / เดือน`}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant">ตรวจสลิปอัตโนมัติ</span>
                      <strong className="font-mono">{plan.slips < 0 ? 'ไม่จำกัด' : `${plan.slips.toLocaleString()} / เดือน`}</strong>
                    </div>
                  </div>
                  {plan.features?.length > 0 && (
                    <ul className="space-y-1 text-xs text-on-surface-variant">
                      {plan.features.map((f) => (
                        <li key={f} className="flex gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-success-green shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleBuyPlan(plan)}
                  disabled={isPending}
                  className={`w-full py-2.5 px-3 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50 ${
                    isRenewal
                      ? 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline-variant/40'
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-xs'
                  }`}
                >
                  {busy
                    ? 'กำลังดำเนินการ...'
                    : isRenewal
                      ? 'ต่ออายุล่วงหน้า'
                      : paysFromWallet && !lapsed && !isCurrent
                        ? 'เปลี่ยนเป็นแพ็กเกจนี้'
                        : 'ซื้อด้วยกระเป๋าเงิน'}
                </button>
              </div>
            )
          })}
        </div>
        {plans.some((p) => p.key === 'byok') && (
          <p className="text-[11px] text-on-surface-variant">
            BYOK: หลังซื้อแพ็กเกจ ใส่ API Key ของร้าน (แนะนำ Google Gemini) ที่หน้าตั้งค่าบอท ค่า AI ร้านจ่ายตรงกับผู้ให้บริการ
          </p>
        )}
      </div>

      {/* Add-on packs */}
      <div className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div>
          <h2 className="font-heading text-sm font-semibold text-on-surface">แพ็กเสริม</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">ใช้เมื่อโควตาของแพ็กเกจเดือนนั้นหมด อายุ 90 วันนับจากวันที่ซื้อ</p>
        </div>
        {([
          { kind: 'messages' as const, title: 'ข้อความ AI', icon: MessageSquare, unit: 'ข้อความ' },
          { kind: 'slips' as const, title: 'ตรวจสลิปอัตโนมัติ', icon: Receipt, unit: 'ครั้ง' },
        ]).map(({ kind, title, icon: Icon, unit }) => (
          <div key={kind} className="space-y-2">
            <p className="text-xs font-bold text-on-surface flex items-center gap-1.5">
              <Icon className="h-4 w-4" /> {title}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {packsByKind(kind).map((pack) => (
                <div key={pack.key} className="border border-outline-variant/40 rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-on-surface">+{pack.quantity.toLocaleString()} {unit}</p>
                    <p className="text-[11px] text-on-surface-variant">
                      ฿{pack.price.toLocaleString()} · {(pack.price / pack.quantity).toFixed(2)} บาท/{unit}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleBuyAddon(pack)}
                    disabled={isPending}
                    className="shrink-0 px-3 py-2 rounded-lg bg-surface-container-high hover:bg-indigo-500/10 hover:text-indigo-600 text-on-surface font-bold text-[11px] border border-outline-variant/40 cursor-pointer disabled:opacity-50"
                  >
                    {busyKey === `addon:${pack.key}` ? '...' : 'ซื้อ'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Wallet history */}
      {transactions.length > 0 && (
        <div className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
          <h2 className="font-heading text-sm font-semibold text-on-surface">ความเคลื่อนไหวของกระเป๋าเงิน</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-on-surface-variant text-left border-b border-outline-variant/30">
                  <th className="py-2.5 pr-4">วันที่</th>
                  <th className="py-2.5 pr-4">รายการ</th>
                  <th className="py-2.5 pr-4 text-right">จำนวน</th>
                  <th className="py-2.5 text-right">คงเหลือ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {transactions.map((tx) => {
                  const amount = Number(tx.amount)
                  return (
                    <tr key={tx.id}>
                      <td className="py-2.5 pr-4 text-on-surface-variant font-mono whitespace-nowrap">{thaiDate(tx.created_at)}</td>
                      <td className="py-2.5 pr-4">
                        <span className="font-semibold">{TRANSACTION_LABEL_TH[tx.kind] || tx.kind}</span>
                        {tx.description && <span className="block text-[11px] text-on-surface-variant">{tx.description}</span>}
                      </td>
                      <td className={`py-2.5 pr-4 text-right font-mono font-bold ${amount >= 0 ? 'text-success-green' : 'text-on-surface'}`}>
                        {amount >= 0 ? '+' : '−'}{baht(Math.abs(amount))}
                      </td>
                      <td className="py-2.5 text-right font-mono">{baht(Number(tx.balance_after))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payments and receipts */}
      {payments.length > 0 && (
        <div className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-sm font-semibold text-on-surface">ประวัติการชำระเงินและใบเสร็จ</h2>
            <span className="text-[11px] text-on-surface-variant">แสดง {payments.length} รายการล่าสุด</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-on-surface-variant text-left border-b border-outline-variant/30">
                  <th className="py-2.5 pr-4">วันที่</th>
                  <th className="py-2.5 pr-4">รายการ</th>
                  <th className="py-2.5 pr-4">ยอดโอน</th>
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
                      <td className="py-3 pr-4 text-on-surface-variant font-mono whitespace-nowrap">{thaiDate(p.created_at)}</td>
                      <td className="py-3 pr-4 font-medium">
                        {p.plan_key === 'wallet_topup' ? 'เติมเงินเข้ากระเป๋า' : `แพ็กเกจ ${String(p.plan_key || '-').toUpperCase()}`}
                        <span className="block text-[10px] text-on-surface-variant">
                          {p.provider === 'promptpay' ? 'PromptPay' : p.provider === 'stripe' ? 'Stripe' : 'Omise'}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-mono font-bold">
                        {baht(Number(p.transferred_amount || p.amount))}
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
                        {p.status === 'rejected' && p.rejected_reason && (
                          <span className="block text-[10px] text-rose-600 mt-1">{p.rejected_reason}</span>
                        )}
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
                            <span>ใบเสร็จ</span>
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

      {pendingPurchase && (
        <PurchaseConfirmCard
          purchase={pendingPurchase}
          balance={wallet.balance}
          onCancel={() => setPendingPurchase(null)}
          onConfirm={confirmPurchase}
          onTopUp={(shortfall) => {
            setPendingPurchase(null)
            openTopUp(shortfall)
          }}
        />
      )}

      {topUpAmount !== null && (
        <TopUpModal
          isOpen
          onClose={() => {
            setTopUpAmount(null)
            router.refresh()
          }}
          initialAmount={topUpAmount}
          platformSettings={platformSettings}
        />
      )}
    </div>
  )
}

function PurchaseConfirmCard({
  purchase,
  balance,
  onCancel,
  onConfirm,
  onTopUp,
}: {
  purchase: PendingPurchase
  balance: number
  onCancel: () => void
  onConfirm: () => void
  onTopUp: (shortfall: number) => void
}) {
  const after = balance - purchase.price
  const shortfall = after < 0 ? -after : 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-confirm-title"
        className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden text-slate-900 dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 flex items-center justify-between bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 id="purchase-confirm-title" className="font-heading font-semibold text-sm sm:text-base truncate">
                {purchase.title}
              </h3>
              <p className="text-[11px] text-indigo-200">{purchase.detail}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="ปิด"
            className="p-1.5 rounded-xl hover:bg-white/15 text-indigo-200 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">ราคา</p>
            <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400 font-mono">{baht(purchase.price)}</p>
          </div>

          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3.5 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">ยอดในกระเป๋าตอนนี้</span>
              <span className="font-mono font-bold">{baht(balance)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">หักค่า{purchase.key.startsWith('plan:') ? 'แพ็กเกจ' : 'แพ็กเสริม'}</span>
              <span className="font-mono font-bold text-rose-600">-{baht(purchase.price)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="font-bold">คงเหลือหลังซื้อ</span>
              <span className={`font-mono font-black ${shortfall > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {shortfall > 0 ? '-' : ''}
                {baht(Math.abs(after))}
              </span>
            </div>
          </div>

          {purchase.note && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{purchase.note}</p>
          )}

          {shortfall > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-[11px] text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-px" />
              <span>ยอดในกระเป๋าไม่พอ ต้องเติมอีกอย่างน้อย {baht(shortfall)}</span>
            </div>
          )}

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer min-h-[44px]"
            >
              ยกเลิก
            </button>
            {shortfall > 0 ? (
              <button
                type="button"
                onClick={() => onTopUp(shortfall)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 text-white font-bold text-xs shadow-md transition-all cursor-pointer min-h-[44px]"
              >
                <Plus className="h-4 w-4" />
                เติมเงิน
              </button>
            ) : (
              <button
                type="button"
                onClick={onConfirm}
                autoFocus
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 text-white font-bold text-xs shadow-md transition-all cursor-pointer min-h-[44px]"
              >
                ยืนยันซื้อ
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
