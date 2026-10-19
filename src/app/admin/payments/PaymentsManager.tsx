'use client'

import { useState } from 'react'
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
  Check,
  Save,
  Building,
} from 'lucide-react'
import {
  verifyPaymentAction,
  rejectPaymentAction,
  updatePlatformSettingsAction,
} from './actions'
import { PlatformBillingSettings } from '@/lib/billing/manualBilling'

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
  initialSettings,
}: {
  initialPayments: PaymentItem[]
  initialSettings: PlatformBillingSettings
}) {
  const [payments, setPayments] = useState<PaymentItem[]>(initialPayments)
  const [settings, setSettings] = useState<PlatformBillingSettings>(initialSettings)
  const [activeTab, setActiveTab] = useState<'pending' | 'verified' | 'rejected' | 'all' | 'settings'>('pending')
  const [search, setSearch] = useState('')
  const [selectedSlipUrl, setSelectedSlipUrl] = useState<string | null>(null)

  // Rejection modal state
  const [rejectingPaymentId, setRejectingPaymentId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // Action loading states
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSavedSuccess, setSettingsSavedSuccess] = useState(false)

  // Filter payments
  const filteredPayments = payments.filter((p) => {
    const matchesTab =
      activeTab === 'all' ||
      activeTab === 'settings' ||
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

  const handleVerify = async (paymentId: string) => {
    if (!confirm('ยืนยันการอนุมัติการชำระเงินนี้? ระบบจะต่ออายุแพ็กเกจให้ร้านค้าและออกเลขที่ใบเสร็จทันที')) {
      return
    }

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
        alert('เกิดข้อผิดพลาด: ' + (res.error || 'ไม่สามารถอนุมัติได้'))
      }
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setProcessingId(null)
    }
  }

  const handleRejectConfirm = async () => {
    if (!rejectingPaymentId) return
    if (!rejectReason.trim()) {
      alert('กรุณาระบุเหตุผลการปฏิเสธสลิป')
      return
    }

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
        alert('เกิดข้อผิดพลาด: ' + (res.error || 'ไม่สามารถปฏิเสธได้'))
      }
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setProcessingId(null)
    }
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingSettings(true)
    setSettingsSavedSuccess(false)
    try {
      const res = await updatePlatformSettingsAction(settings)
      if (res.success) {
        setSettingsSavedSuccess(true)
        setTimeout(() => setSettingsSavedSuccess(false), 3000)
      } else {
        alert('เกิดข้อผิดพลาดในการบันทึก: ' + res.error)
      }
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setSavingSettings(false)
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
        {activeTab !== 'settings' && (
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
        )}
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

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Settings className="h-3.5 w-3.5" />
          <span>ตั้งค่าบัญชีรับเงิน (Settings)</span>
        </button>
      </div>

      {/* Tab: Settings */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="max-w-3xl space-y-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Building className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  ข้อมูลการรับชำระเงินและออกใบเสร็จ (DealMee Billing Settings)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ข้อมูลนี้จะแสดงบน QR Code และหัวเอกสารใบเสร็จรับเงิน DealMee ให้กับลูกค้า
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  ชื่อบัญชี / ชื่อบริษัท (Account / Company Name) *
                </label>
                <input
                  type="text"
                  required
                  value={settings.account_name}
                  onChange={(e) => setSettings({ ...settings, account_name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  เบอร์โทร / เลขประจำตัว PromptPay *
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น 0812345678 หรือ 01055..."
                  value={settings.promptpay_id}
                  onChange={(e) => setSettings({ ...settings, promptpay_id: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  ธนาคาร (Bank Name)
                </label>
                <input
                  type="text"
                  value={settings.bank_name}
                  onChange={(e) => setSettings({ ...settings, bank_name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  เลขที่บัญชีธนาคาร (Bank Account Number)
                </label>
                <input
                  type="text"
                  value={settings.bank_account_number}
                  onChange={(e) => setSettings({ ...settings, bank_account_number: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  เลขประจำตัวผู้เสียภาษี (Payee Tax ID 13 หลัก)
                </label>
                <input
                  type="text"
                  placeholder="01055..."
                  value={settings.payee_tax_id}
                  onChange={(e) => setSettings({ ...settings, payee_tax_id: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-mono"
                />
                <p className="text-[11px] text-slate-400">จำเป็นสำหรับลูกค้านิติบุคคลยื่นใบ 50 ทวิ</p>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  สถานะการจดทะเบียนภาษีมูลค่าเพิ่ม (VAT 7%) *
                </label>
                <div className="flex items-center gap-3 pt-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.is_vat_registered}
                      onChange={(e) => setSettings({ ...settings, is_vat_registered: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {settings.is_vat_registered
                      ? 'จดทะเบียน VAT แล้ว (ออกใบเสร็จรับเงิน/ใบกำกับภาษี)'
                      : 'ยังไม่จดทะเบียน VAT (ล็อกหัวเป็น "ใบเสร็จรับเงิน" เท่านั้น)'}
                  </span>
                </div>
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  ที่อยู่สถานประกอบการ (Company Address)
                </label>
                <textarea
                  rows={2}
                  value={settings.company_address}
                  onChange={(e) => setSettings({ ...settings, company_address: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  เบอร์โทรศัพท์ติดต่อ
                </label>
                <input
                  type="text"
                  value={settings.company_phone}
                  onChange={(e) => setSettings({ ...settings, company_phone: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  อีเมลฝ่ายการเงิน
                </label>
                <input
                  type="email"
                  value={settings.company_email}
                  onChange={(e) => setSettings({ ...settings, company_email: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="submit"
                disabled={savingSettings}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>บันทึกการตั้งค่า</span>
              </button>

              {settingsSavedSuccess && (
                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 animate-fade-in">
                  <Check className="h-4 w-4" />
                  <span>บันทึกการตั้งค่าเรียบร้อยแล้ว</span>
                </span>
              )}
            </div>
          </div>
        </form>
      )}

      {/* Tab: Payments List */}
      {activeTab !== 'settings' && (
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
                              onClick={() => handleVerify(p.id)}
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
      )}

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
