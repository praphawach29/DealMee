'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Search,
  Eye,
  Settings,
  Receipt,
  FileText,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import {
  verifyPaymentAction,
  rejectPaymentAction,
} from './actions'

interface PaymentItem {
  id: string
  shop_id: string
  plan_key: string
  amount: number
  billed_amount?: number
  withheld_amount?: number
  transferred_amount?: number
  currency: string
  status: 'pending' | 'verified' | 'rejected' | 'succeeded' | 'failed'
  slip_url?: string
  slip_reference?: string
  receipt_number?: string
  verified_at?: string
  verified_by?: string
  rejected_reason?: string
  customer_notes?: string
  created_at: string
  shop_name: string
  shop_bot_name?: string
}

export default function PaymentsManager({
  initialPayments,
}: {
  initialPayments: PaymentItem[]
}) {
  const [payments, setPayments] = useState<PaymentItem[]>(initialPayments)
  const [activeTab, setActiveTab] = useState<'pending' | 'verified' | 'rejected' | 'all'>('pending')
  const [search, setSearch] = useState('')
  const [selectedSlipUrl, setSelectedSlipUrl] = useState<string | null>(null)

  // Rejection modal state
  const [rejectingPaymentId, setRejectingPaymentId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // Approval confirmation card
  const [verifyingPayment, setVerifyingPayment] = useState<PaymentItem | null>(null)

  // Action loading states
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Filter payments
  const filteredPayments = payments.filter((p) => {
    const matchesTab =
      activeTab === 'all' ||
      p.status === activeTab ||
      (activeTab === 'verified' && p.status === 'succeeded')

    const matchesSearch =
      search.trim() === '' ||
      p.shop_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.receipt_number && p.receipt_number.toLowerCase().includes(search.toLowerCase())) ||
      (p.slip_reference && p.slip_reference.toLowerCase().includes(search.toLowerCase()))

    return matchesTab && matchesSearch
  })

  const pendingCount = payments.filter((p) => p.status === 'pending').length

  const handleVerifyConfirm = async () => {
    if (!verifyingPayment) return
    const paymentId = verifyingPayment.id
    setVerifyingPayment(null)
    setActionError(null)
    setProcessingId(paymentId)
    try {
      const res = await verifyPaymentAction(paymentId)
      if (res.success) {
        setPayments((prev) =>
          prev.map((p) =>
            p.id === paymentId
              ? {
                  ...p,
                  status: 'verified',
                  receipt_number: res.data?.receipt_number || p.receipt_number,
                  verified_at: new Date().toISOString(),
                }
              : p
          )
        )
      } else {
        setActionError('อนุมัติไม่สำเร็จ: ' + (res.error || 'ไม่สามารถอนุมัติได้'))
      }
    } catch (err: any) {
      setActionError('อนุมัติไม่สำเร็จ: ' + err.message)
    } finally {
      setProcessingId(null)
    }
  }

  const handleRejectConfirm = async () => {
    if (!rejectingPaymentId) return
    if (!rejectReason.trim()) return

    setActionError(null)
    setProcessingId(rejectingPaymentId)
    try {
      const res = await rejectPaymentAction(rejectingPaymentId, rejectReason)
      if (res.success) {
        setPayments((prev) =>
          prev.map((p) =>
            p.id === rejectingPaymentId
              ? {
                  ...p,
                  status: 'rejected',
                  rejected_reason: rejectReason,
                  slip_reference: undefined, // Cleared per CheckMee Trap #3
                }
              : p
          )
        )
        setRejectingPaymentId(null)
        setRejectReason('')
      } else {
        setActionError('ปฏิเสธไม่สำเร็จ: ' + (res.error || 'ไม่สามารถปฏิเสธได้'))
      }
    } catch (err: any) {
      setActionError('ปฏิเสธไม่สำเร็จ: ' + err.message)
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              รายการชำระเงิน & ใบเสร็จ DealMee AI
            </h1>
            {pendingCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-xs animate-pulse">
                รอตรวจ {pendingCount}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            ตรวจสอบสลิปการโอนเงิน อนุมัติแพ็กเกจ DealMee AI และออกใบเสร็จรับเงินตามเกณฑ์สรรพากร
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาร้านค้า, เลขที่ใบเสร็จ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'pending'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          <span>รอตรวจสอบ</span>
          {pendingCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-slate-950 text-amber-400 text-[10px] flex items-center justify-center font-black">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('verified')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'verified'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>อนุมัติแล้ว (Verified)</span>
        </button>

        <button
          onClick={() => setActiveTab('rejected')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'rejected'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <XCircle className="h-3.5 w-3.5" />
          <span>ปฏิเสธ (Rejected)</span>
        </button>

        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'all'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          <span>ทั้งหมด</span>
        </button>

        <div className="flex-1" />

        <Link
          href="/admin/payment-settings"
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Settings className="h-3.5 w-3.5" />
          <span>ตั้งค่าบัญชีรับเงิน</span>
        </Link>
      </div>

      {actionError && (
        <div className="flex items-start gap-2 p-3 rounded-xl border bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900 text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-px" />
          <span className="flex-1">{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="font-bold cursor-pointer" aria-label="ปิด">
            ×
          </button>
        </div>
      )}

      {/* Tab: Payments List */}
      <div className="space-y-4">
        {filteredPayments.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-500">
            <Receipt className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
            <p className="font-bold text-sm">ไม่พบรายการชำระเงินในหมวดนี้</p>
            <p className="text-xs mt-1">เมื่อร้านค้าชำระเงินผ่าน PromptPay รายการจะปรากฏที่นี่</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            {filteredPayments.map((p) => {
              const isPending = p.status === 'pending'
              const isVerified = p.status === 'verified' || p.status === 'succeeded'
              const isRejected = p.status === 'rejected'
              const isWithholding = Number(p.withheld_amount || 0) > 0

              return (
                <div
                  key={p.id}
                  className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 sm:p-5 transition-all shadow-xs ${
                    isPending
                      ? 'border-amber-400 dark:border-amber-500/50 ring-1 ring-amber-400/30'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Shop info and Plan */}
                    <div className="flex items-start gap-3.5">
                      {p.slip_url ? (
                        <div
                          onClick={() => setSelectedSlipUrl(p.slip_url || null)}
                          className="relative w-16 h-20 sm:w-20 sm:h-24 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 cursor-pointer group"
                          title="คลิกเพื่อดูรูปสลิปขยาย"
                        >
                          <img
                            src={p.slip_url}
                            alt="Slip"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Eye className="h-5 w-5" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-16 h-20 sm:w-20 sm:h-24 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400 shrink-0 text-[10px] text-center p-1">
                          ไม่มีรูปสลิป
                        </div>
                      )}

                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                            {p.shop_name}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold uppercase text-[10px]">
                            {p.plan_key === 'wallet_topup' ? 'เติมเงิน' : p.plan_key}
                          </span>
                        </div>

                        <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                          วันที่โอน: {new Date(p.created_at).toLocaleString('th-TH')}
                        </p>

                        {/* Amount details */}
                        <div className="flex flex-wrap items-baseline gap-2 pt-1 font-mono">
                          <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                            ฿{Number(p.transferred_amount || p.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                          </span>
                          {isWithholding && (
                            <span className="text-[11px] text-amber-600 font-semibold">
                              (หัก ณ ที่จ่าย 3%: ฿{Number(p.withheld_amount).toLocaleString()} / ยอดเต็ม ฿{Number(p.billed_amount).toLocaleString()})
                            </span>
                          )}
                        </div>

                        {/* Notes / References */}
                        {p.slip_reference && (
                          <p className="text-[11px] text-slate-400 font-mono">
                            Ref: {p.slip_reference}
                          </p>
                        )}
                        {p.customer_notes && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 italic bg-slate-50 dark:bg-slate-800 p-1.5 rounded-lg max-w-lg">
                            Note: {p.customer_notes}
                          </p>
                        )}
                        {p.rejected_reason && (
                          <p className="text-[11px] text-rose-600 font-medium">
                            เหตุผลที่ปฏิเสธ: {p.rejected_reason}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Status and Actions */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                      {isPending && (
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <button
                            onClick={() => setVerifyingPayment(p)}
                            disabled={processingId === p.id}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
                          >
                            {processingId === p.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                            <span>อนุมัติ</span>
                          </button>

                          <button
                            onClick={() => {
                              setRejectingPaymentId(p.id)
                              setRejectReason('')
                            }}
                            disabled={processingId === p.id}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 font-bold text-xs border border-rose-200 dark:border-rose-900 transition-all cursor-pointer disabled:opacity-50"
                          >
                            <XCircle className="h-4 w-4" />
                            <span>ปฏิเสธ</span>
                          </button>
                        </div>
                      )}

                      {isVerified && (
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 text-emerald-600 font-bold text-xs bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>อนุมัติแล้ว</span>
                          </span>

                          <a
                            href={`/dashboard/billing/receipt/${p.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 transition-all"
                            title="เปิดดูใบเสร็จรับเงิน"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>ใบเสร็จ: {p.receipt_number || 'ดูเอกสาร'}</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}

                      {isRejected && (
                        <span className="flex items-center gap-1 text-rose-600 font-bold text-xs bg-rose-50 dark:bg-rose-950/60 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-800">
                          <XCircle className="h-4 w-4" />
                          <span>ปฏิเสธแล้ว</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Zoomable Slip Image Modal */}
      {selectedSlipUrl && (
        <div
          onClick={() => setSelectedSlipUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm cursor-zoom-out animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white dark:bg-slate-900 rounded-2xl p-2 max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="flex justify-between items-center p-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                หลักฐานสลิปการโอนเงิน
              </span>
              <button
                onClick={() => setSelectedSlipUrl(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="p-2 overflow-auto flex-1 flex items-center justify-center">
              <img
                src={selectedSlipUrl}
                alt="Enlarged Slip"
                className="max-w-full max-h-[75vh] object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}

      {/* Approve Confirmation Card */}
      {verifyingPayment && (
        <VerifyConfirmCard
          payment={verifyingPayment}
          onCancel={() => setVerifyingPayment(null)}
          onConfirm={handleVerifyConfirm}
        />
      )}

      {/* Reject Reason Dialog */}
      {rejectingPaymentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  ระบุเหตุผลการปฏิเสธสลิป
                </h3>
                <p className="text-xs text-slate-500">
                  ระบบจะล้างเลขอ้างอิงสลิปออก เพื่อให้ร้านค้าสามารถโอนและส่งสลิปใหม่ได้
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5 text-xs">
                {['ยอดเงินไม่ครบ', 'สลิปไม่ชัดเจน/ตัดขอบ', 'บัญชีผู้รับเงินไม่ถูกต้อง', 'สลิปซ้ำ/หมดอายุ'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRejectReason(r)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-500 border border-transparent cursor-pointer"
                  >
                    {r}
                  </button>
                ))}
              </div>
              <textarea
                rows={3}
                required
                placeholder="พิมพ์เหตุผลที่ปฏิเสธเพื่อแจ้งให้ร้านค้าทราบ..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setRejectingPaymentId(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleRejectConfirm}
                disabled={!rejectReason.trim()}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
              >
                ยืนยันปฏิเสธ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function VerifyConfirmCard({
  payment,
  onCancel,
  onConfirm,
}: {
  payment: PaymentItem
  onCancel: () => void
  onConfirm: () => void
}) {
  const isTopUp = payment.plan_key === 'wallet_topup'
  const billed = Number(payment.billed_amount ?? payment.amount ?? 0)
  const transferred = Number(payment.transferred_amount ?? payment.amount ?? 0)
  const withheld = Number(payment.withheld_amount || 0)
  const baht = (n: number) => `฿${n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="verify-confirm-title"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 flex items-center gap-3 bg-gradient-to-r from-emerald-700 to-teal-600 text-white">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 id="verify-confirm-title" className="font-bold text-base">
              อนุมัติการชำระเงิน
            </h3>
            <p className="text-[11px] text-emerald-100 truncate">
              {payment.shop_name} · {isTopUp ? 'เติมเงินเข้ากระเป๋า' : `แพ็กเกจ ${payment.plan_key.toUpperCase()}`}
            </p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex gap-4 items-center">
            {payment.slip_url && (
              <a
                href={payment.slip_url}
                target="_blank"
                rel="noreferrer"
                className="w-16 h-20 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0"
                title="เปิดดูสลิป"
              >
                <img src={payment.slip_url} alt="สลิปการโอนเงิน" className="w-full h-full object-cover" />
              </a>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 dark:text-slate-400">{isTopUp ? 'ยอดเข้ากระเป๋า' : 'ยอดชำระ'}</p>
              <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{baht(billed)}</p>
              {withheld > 0 && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  โอนจริง {baht(transferred)} · หัก ณ ที่จ่าย {baht(withheld)}
                </p>
              )}
            </div>
          </div>

          <ul className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3.5 space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
            <li className="flex gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>
                {isTopUp
                  ? `เพิ่มเงิน ${baht(billed)} เข้ากระเป๋าของร้านทันที`
                  : 'ต่ออายุแพ็กเกจให้ร้านค้าอีก 30 วัน'}
              </span>
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>ออกเลขที่ใบเสร็จรับเงินให้อัตโนมัติ</span>
            </li>
            {payment.slip_reference && (
              <li className="flex gap-2 text-slate-500 dark:text-slate-400">
                <FileText className="h-4 w-4 shrink-0" />
                <span className="font-mono truncate">Ref: {payment.slip_reference}</span>
              </li>
            )}
          </ul>

          {payment.customer_notes && (
            <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-2.5 leading-relaxed">
              {payment.customer_notes}
            </p>
          )}

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer min-h-[44px]"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={onConfirm}
              autoFocus
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer min-h-[44px]"
            >
              ยืนยันอนุมัติ
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
