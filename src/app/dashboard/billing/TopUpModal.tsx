'use client'

import { useState, useEffect, useRef } from 'react'
import {
  X,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  Building,
  FileText,
  ExternalLink,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import {
  PlatformBillingSettings,
  generatePromptPayQRImage,
  MIN_TOPUP_AMOUNT,
  MAX_TOPUP_AMOUNT,
} from '@/lib/billing/manualBilling'

const PRESET_AMOUNTS = [300, 590, 1000, 1690, 3000, 5000]

interface TopUpModalProps {
  isOpen: boolean
  onClose: () => void
  /** Pre-filled amount, e.g. what's missing to buy a plan */
  initialAmount?: number
  platformSettings: PlatformBillingSettings
  onPaymentSuccess?: () => void
}

/** Wallet top-up: PromptPay QR for the chosen amount, then the slip is checked by /api/billing/submit-slip. */
export default function TopUpModal({
  isOpen,
  onClose,
  initialAmount,
  platformSettings,
  onPaymentSuccess,
}: TopUpModalProps) {
  const [amountInput, setAmountInput] = useState(String(Math.max(MIN_TOPUP_AMOUNT, Math.ceil(initialAmount || 1000))))
  const [isWithholdingTax, setIsWithholdingTax] = useState(false)
  const [companyTaxId, setCompanyTaxId] = useState('')
  const [customerNotes, setCustomerNotes] = useState('')
  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [slipPreview, setSlipPreview] = useState<string | null>(null)

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [submitProgress, setSubmitProgress] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [successResult, setSuccessResult] = useState<{
    autoVerified: boolean
    paymentId?: string
    receiptNumber?: string
    message: string
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Calculations
  const parsedAmount = Math.round(Number(amountInput) * 100) / 100
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount >= MIN_TOPUP_AMOUNT && parsedAmount <= MAX_TOPUP_AMOUNT
  const billedAmount = amountValid ? parsedAmount : 0
  const withheldAmount = isWithholdingTax
    ? Number((billedAmount * 0.03).toFixed(2))
    : 0
  const transferredAmount = Number((billedAmount - withheldAmount).toFixed(2))

  // Generate QR when transferredAmount or promptpay_id changes
  useEffect(() => {
    if (!isOpen || !amountValid) return

    let cancelled = false
    const loadQR = async () => {
      setQrLoading(true)
      try {
        const { qrDataUrl: generatedUrl } = await generatePromptPayQRImage(
          platformSettings.promptpay_id || '0812345678',
          transferredAmount
        )
        if (!cancelled) {
          setQrDataUrl(generatedUrl)
        }
      } catch (err) {
        console.error('QR generate error:', err)
      } finally {
        if (!cancelled) setQrLoading(false)
      }
    }

    loadQR()
    return () => {
      cancelled = true
    }
  }, [isOpen, amountValid, transferredAmount, platformSettings.promptpay_id])

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG)')
      return
    }

    setSlipFile(file)
    setError(null)
    const reader = new FileReader()
    reader.onload = () => {
      setSlipPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amountValid) {
      setError(`กรุณาระบุยอดเติมเงินระหว่าง ฿${MIN_TOPUP_AMOUNT.toLocaleString()} ถึง ฿${MAX_TOPUP_AMOUNT.toLocaleString()}`)
      return
    }
    if (!slipFile) {
      setError('กรุณาแนบรูปภาพสลิปการโอนเงินก่อนส่ง')
      return
    }

    if (isWithholdingTax && !companyTaxId.trim()) {
      setError('กรุณาระบุเลขประจำตัวผู้เสียภาษี 13 หลักสำหรับยื่นหัก ณ ที่จ่าย')
      return
    }

    setSubmitting(true)
    setError(null)
    setSubmitProgress('กำลังอัปโหลดรูปภาพสลิป...')

    try {
      const formData = new FormData()
      formData.append('slip', slipFile)
      formData.append('amount', billedAmount.toString())
      formData.append('withholding', String(isWithholdingTax))

      const notes = [
        isWithholdingTax ? `หัก ณ ที่จ่าย 3% (Tax ID: ${companyTaxId})` : '',
        customerNotes,
      ]
        .filter(Boolean)
        .join(' | ')

      formData.append('customerNotes', notes)

      setSubmitProgress('กำลังตรวจสอบสลิป...')
      const res = await fetch('/api/billing/submit-slip', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการส่งสลิป')
      }

      setSuccessResult({
        autoVerified: Boolean(data.autoVerified),
        paymentId: data.paymentId,
        receiptNumber: data.receiptNumber,
        message: data.message,
      })

      if (onPaymentSuccess) {
        onPaymentSuccess()
      }
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถทำรายการได้ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden my-auto text-slate-900 dark:text-white">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base">เติมเงินเข้ากระเป๋า</h3>
              <p className="text-[11px] text-indigo-200">
                สแกน PromptPay แล้วแนบสลิป เงินเข้ากระเป๋าทันทีเมื่อสลิปถูกต้อง
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/15 text-indigo-200 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        {successResult ? (
          <div className="p-6 sm:p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 className="h-9 w-9" />
            </div>

            <div className="space-y-1.5">
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                {successResult.autoVerified
                  ? 'เติมเงินสำเร็จ!'
                  : 'บันทึกสลิปเรียบร้อยแล้ว'}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-sm mx-auto">
                {successResult.message}
              </p>
            </div>

            {successResult.receiptNumber && (
              <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 max-w-xs mx-auto space-y-1 text-xs">
                <span className="text-slate-400">เลขที่ใบเสร็จรับเงิน</span>
                <p className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                  {successResult.receiptNumber}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 justify-center pt-2">
              {successResult.paymentId && successResult.autoVerified && (
                <a
                  href={`/dashboard/billing/receipt/${successResult.paymentId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                >
                  <FileText className="h-4 w-4" />
                  <span>ดูใบเสร็จรับเงิน</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}

              <button
                type="button"
                onClick={() => {
                  onClose()
                  window.location.reload()
                }}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
            {/* Step 0: Amount */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                ยอดเติมเงิน (บาท)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {PRESET_AMOUNTS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmountInput(String(preset))}
                    className={`py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      parsedAmount === preset
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                    }`}
                  >
                    ฿{preset.toLocaleString()}
                  </button>
                ))}
              </div>
              <input
                type="number"
                inputMode="decimal"
                min={MIN_TOPUP_AMOUNT}
                max={MAX_TOPUP_AMOUNT}
                step="1"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-mono"
                aria-label="ยอดเติมเงิน"
              />
              {!amountValid && (
                <p className="text-[11px] text-rose-600">
                  ขั้นต่ำ ฿{MIN_TOPUP_AMOUNT.toLocaleString()} สูงสุด ฿{MAX_TOPUP_AMOUNT.toLocaleString()}
                </p>
              )}
            </div>

            {/* Step 1: QR & Payment details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              {/* QR Image */}
              <div className="flex flex-col items-center justify-center p-2 bg-white rounded-xl shadow-xs border border-slate-100">
                {qrLoading ? (
                  <div className="w-44 h-44 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                    <span>กำลังสร้าง QR Code...</span>
                  </div>
                ) : qrDataUrl && amountValid ? (
                  <>
                    <img src={qrDataUrl} alt="PromptPay QR" className="w-44 h-44 object-contain" />
                    <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                      Thai PromptPay
                    </span>
                  </>
                ) : (
                  <div className="w-44 h-44 flex items-center justify-center text-rose-500 text-xs text-center p-2">
                    {amountValid ? 'ไม่สามารถสร้าง QR ได้' : 'ระบุยอดเติมเงินก่อน'}
                  </div>
                )}
              </div>

              {/* Payee Details */}
              <div className="space-y-2.5 text-xs">
                <div>
                  <span className="text-slate-400 text-[11px]">ยอดที่ต้องชำระสุทธิ</span>
                  <div className="text-2xl font-black text-indigo-700 dark:text-indigo-400 font-mono">
                    ฿{transferredAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </div>
                  {isWithholdingTax && (
                    <span className="text-[10px] text-amber-600 font-semibold block">
                      (หัก ณ ที่จ่าย 3%: -฿{withheldAmount.toLocaleString()} เงินเข้ากระเป๋าเต็ม ฿{billedAmount.toLocaleString()} เมื่อแอดมินได้รับใบ 50 ทวิ)
                    </span>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">บัญชีรับเงิน:</span>
                    <strong className="text-slate-800 dark:text-slate-200 truncate max-w-[130px]">
                      {platformSettings.account_name}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">PromptPay:</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {platformSettings.promptpay_id}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(platformSettings.promptpay_id, 'promptpay')}
                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md text-slate-400 hover:text-slate-600"
                        title="คัดลอก"
                      >
                        {copiedField === 'promptpay' ? (
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {platformSettings.bank_name && (
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{platformSettings.bank_name}</span>
                      {platformSettings.bank_account_number && (
                        <span className="font-mono">{platformSettings.bank_account_number}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Withholding Tax Option for Corporates */}
            <div className="bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl p-3.5 space-y-2.5 text-xs">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isWithholdingTax}
                  onChange={(e) => setIsWithholdingTax(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <span className="font-bold text-indigo-900 dark:text-indigo-200">
                  ขอยื่นหักภาษี ณ ที่จ่าย 3% (สำหรับนิติบุคคล / หักตาม ภ.ง.ด.53)
                </span>
              </label>

              {isWithholdingTax && (
                <div className="space-y-2 pt-1.5 border-t border-indigo-200/50 dark:border-indigo-900/40">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      เลขประจำตัวผู้เสียภาษี 13 หลักของบริษัทคุณ *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น 01055xxxxxxxx"
                      value={companyTaxId}
                      onChange={(e) => setCompanyTaxId(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 rounded-xl px-3 py-2 text-xs font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    * กรุณาส่งหนังสือรับรองการหักภาษี ณ ที่จ่าย (ใบ 50 ทวิ) มายังอีเมล{' '}
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      {platformSettings.company_email}
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Slip Upload Zone */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                แนบสลิปการโอนเงิน (Slip Upload) *
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {slipPreview ? (
                <div className="relative border-2 border-emerald-500/50 bg-emerald-50/20 rounded-2xl p-3 flex items-center gap-3">
                  <img
                    src={slipPreview}
                    alt="Slip Preview"
                    className="w-14 h-16 object-cover rounded-xl border border-emerald-300"
                  />
                  <div className="flex-1 min-w-0 text-xs">
                    <p className="font-bold text-emerald-800 dark:text-emerald-300 truncate">
                      {slipFile?.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      ขนาด {slipFile ? (slipFile.size / 1024).toFixed(1) : 0} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSlipFile(null)
                      setSlipPreview(null)
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 bg-slate-50/70 dark:bg-slate-850 hover:bg-indigo-50/20 rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2 group"
                >
                  <UploadCloud className="h-8 w-8 mx-auto text-slate-400 group-hover:text-indigo-500 group-hover:scale-110 transition-all" />
                  <div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      คลิกเพื่อเลือกไฟล์สลิป หรือลากรูปมาวางที่นี่
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      รองรับไฟล์ภาพ JPG, PNG จากแอปธนาคารทุกธนาคาร
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Error banner */}
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Footer buttons */}
            <div className="pt-2 flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>

              <button
                type="submit"
                disabled={!slipFile || !amountValid || submitting}
                className="flex-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-md hover:shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{submitProgress || 'กำลังประมวลผล...'}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    <span>ส่งสลิปเพื่อตรวจสอบ</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
