'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Settings,
  Receipt,
  FileText,
  AlertTriangle,
} from 'lucide-react'
import {
  verifyPaymentAction,
  rejectPaymentAction,
} from './actions'
import { PaymentItem, VerifyConfirmModal } from './components/VerifyConfirmModal'
import { RejectPaymentModal } from './components/RejectPaymentModal'
import { SlipPreviewModal } from './components/SlipPreviewModal'
import { PaymentItemCard } from './components/PaymentItemCard'

export type { PaymentItem }

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

  // Approval confirmation modal state
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

    const term = search.trim().toLowerCase()
    const matchesSearch =
      term === '' ||
      p.shop_name.toLowerCase().includes(term) ||
      (p.receipt_number && p.receipt_number.toLowerCase().includes(term)) ||
      (p.slip_reference && p.slip_reference.toLowerCase().includes(term))

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
    if (!rejectingPaymentId || !rejectReason.trim()) return

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
                  slip_reference: null, // Cleared per CheckMee Trap #3
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
            <h1 className="font-heading text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
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

      {/* Payments List */}
      <div className="space-y-4">
        {filteredPayments.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-500">
            <Receipt className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
            <p className="font-bold text-sm">ไม่พบรายการชำระเงินในหมวดนี้</p>
            <p className="text-xs mt-1">เมื่อร้านค้าชำระเงินผ่าน PromptPay รายการจะปรากฏที่นี่</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            {filteredPayments.map((p) => (
              <PaymentItemCard
                key={p.id}
                payment={p}
                processingId={processingId}
                onOpenSlip={(url) => setSelectedSlipUrl(url)}
                onApprove={(item) => setVerifyingPayment(item)}
                onReject={(id) => {
                  setRejectingPaymentId(id)
                  setRejectReason('')
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Slip Preview Modal */}
      {selectedSlipUrl && (
        <SlipPreviewModal
          slipUrl={selectedSlipUrl}
          onClose={() => setSelectedSlipUrl(null)}
        />
      )}

      {/* Verify / Approve Confirmation Modal */}
      {verifyingPayment && (
        <VerifyConfirmModal
          payment={verifyingPayment}
          onCancel={() => setVerifyingPayment(null)}
          onConfirm={handleVerifyConfirm}
        />
      )}

      {/* Rejection Reason Modal */}
      {rejectingPaymentId && (
        <RejectPaymentModal
          rejectReason={rejectReason}
          onReasonChange={setRejectReason}
          onCancel={() => setRejectingPaymentId(null)}
          onConfirm={handleRejectConfirm}
        />
      )}
    </div>
  )
}
