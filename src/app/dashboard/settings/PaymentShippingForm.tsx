'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { updatePaymentShippingSettings } from './actions'
import {
  Save,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Building2,
  Truck,
  Banknote,
  RefreshCw,
  ShieldCheck,
  Eye,
  EyeOff,
  ExternalLink,
  Zap,
} from 'lucide-react'

export interface PaymentShippingShopData {
  id: string
  promptpay_number?: string | null
  promptpay_name?: string | null
  promptpay_qr_enabled?: boolean | null
  bank_name?: string | null
  payment_bank_name?: string | null
  bank_account_number?: string | null
  payment_bank_account?: string | null
  bank_account_name?: string | null
  payment_bank_acc_name?: string | null
  shipping_provider?: string | null
  shipping_fee_type?: string | null
  shipping_fee_amount?: number | null
  shipping_zone_bkk?: number | null
  shipping_zone_upcountry?: number | null
  shipping_zone_remote?: number | null
  free_shipping_threshold?: number | null
  cod_enabled?: boolean | null
  cod_fee_type?: string | null
  cod_fee_amount?: number | null
  features?: {
    slip_verification?: {
      enabled?: boolean
      provider?: string
      api_key?: string
      branch_id?: string
    }
    payment_shipping?: {
      bank_name?: string
      bank_account_number?: string
      bank_account_name?: string
      promptpay_qr_enabled?: boolean
      cod_enabled?: boolean
      cod_fee_type?: string
      cod_fee_amount?: number
      shipping_zone_bkk?: number
      shipping_zone_upcountry?: number
      shipping_zone_remote?: number
    }
    [key: string]: any
  } | null
}

const THAI_BANKS = [
  { code: 'KBANK', name: 'ธนาคารกสิกรไทย (KBANK)' },
  { code: 'SCB', name: 'ธนาคารไทยพาณิชย์ (SCB)' },
  { code: 'BBL', name: 'ธนาคารกรุงเทพ (BBL)' },
  { code: 'KTB', name: 'ธนาคารกรุงไทย (KTB)' },
  { code: 'BAY', name: 'ธนาคารกรุงศรีอยุธยา (BAY)' },
  { code: 'TTB', name: 'ธนาคารทหารไทยธนชาต (TTB)' },
  { code: 'GSB', name: 'ธนาคารออมสิน (GSB)' },
  { code: 'BAAC', name: 'ธนาคาร ธ.ก.ส.' },
]

function normalizeBankName(val?: string | null): string {
  if (!val) return ''
  const trimmed = val.trim()
  const matched = THAI_BANKS.find(
    (b) =>
      b.name === trimmed ||
      b.code.toLowerCase() === trimmed.toLowerCase() ||
      trimmed.includes(b.code) ||
      trimmed.includes(b.name) ||
      b.name.includes(trimmed)
  )
  return matched ? matched.name : trimmed
}

const SHIPPING_PROVIDERS = [
  { id: 'standard', name: '📦 ขนส่งพัสดุทั่วไป (Standard Delivery)' },
  { id: 'flash', name: '⚡ Flash Express' },
  { id: 'kerry', name: '🚚 Kerry Express' },
  { id: 'thailandpost', name: '📮 ไปรษณีย์ไทย (EMS / ลงทะเบียน)' },
  { id: 'j_and_t', name: '🔴 J&T Express' },
  { id: 'lalamove', name: '🛵 Lalamove / Rider ส่งด่วน' },
]

export default function PaymentShippingForm({ shop }: { shop: PaymentShippingShopData }) {
  const router = useRouter()
  const paymentShipping = shop.features?.payment_shipping
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [shippingFeeType, setShippingFeeType] = useState<string>(shop.shipping_fee_type || 'flat')
  const [codEnabled, setCodEnabled] = useState<boolean>(shop.cod_enabled ?? paymentShipping?.cod_enabled ?? false)
  const [codFeeType, setCodFeeType] = useState<string>(shop.cod_fee_type ?? paymentShipping?.cod_fee_type ?? 'flat')

  const initialBank = normalizeBankName(
    shop.bank_name || shop.payment_bank_name || paymentShipping?.bank_name || ''
  )
  const [selectedBank, setSelectedBank] = useState<string>(initialBank)
  const [shippingProvider, setShippingProvider] = useState<string>(shop.shipping_provider || 'standard')

  useEffect(() => {
    const freshBank = normalizeBankName(
      shop.bank_name || shop.payment_bank_name || paymentShipping?.bank_name || ''
    )
    if (freshBank) {
      setSelectedBank(freshBank)
    }
    if (shop.shipping_provider) {
      setShippingProvider(shop.shipping_provider)
    }
  }, [shop.bank_name, shop.payment_bank_name, paymentShipping?.bank_name, shop.shipping_provider])

  const slipConfig = shop.features?.slip_verification
  const [slipEnabled, setSlipEnabled] = useState<boolean>(slipConfig?.enabled ?? true)
  const [slipProvider, setSlipProvider] = useState<string>(slipConfig?.provider || 'easyslip')
  const [showApiKey, setShowApiKey] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setMessage(null)

    const res = await updatePaymentShippingSettings(formData)
    setLoading(false)

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    if (res?.error) {
      setMessage({ type: 'error', text: res.error })
    } else if (res?.success) {
      setMessage({ type: 'success', text: res.success })
      router.refresh()
    }
  }

  return (
    <form action={handleSubmit} className="space-y-5 sm:space-y-6">
      {/* Top Header & Save Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-on-surface font-headline-md leading-tight">
            การชำระเงินและการจัดส่ง (Payment & Shipping)
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5 font-body-md">
            ตั้งค่าช่องทางการรับเงินของร้าน อัตราค่าส่งสินค้า และเปิดใช้ PromptPay QR ฝังยอดอัจฉริยะ
          </p>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-electric-blue hover:bg-primary text-white font-label-md font-semibold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-electric-blue/20 hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer text-xs sm:text-sm shrink-0"
        >
          {loading ? <RefreshCw className="w-4 h-4 shrink-0 animate-spin" /> : <Save className="w-4 h-4 shrink-0" />}
          <span>{loading ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}</span>
        </button>
      </div>

      {/* Notification Message */}
      {message && (
        <div
          className={`p-4 rounded-xl text-xs sm:text-sm font-label-md flex items-center justify-between transition-all ${
            message.type === 'success'
              ? 'bg-success-green/10 text-success-green border border-success-green/20'
              : 'bg-error-red/10 text-error-red border border-error-red/20'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-success-green shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-error-red shrink-0" />
            )}
            <p>{message.text}</p>
          </div>
          <button type="button" onClick={() => setMessage(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Section 1: PromptPay Settings & Dynamic QR */}
      <section className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
        <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-3.5 sm:pb-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-electric-blue/10 flex items-center justify-center text-electric-blue shrink-0">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-on-surface font-headline-sm">ชำระเงินผ่าน พร้อมเพย์ (PromptPay QR)</h2>
            <p className="text-[11px] sm:text-xs text-on-surface-variant">บอท AI จะสร้างรูปภาพ PromptPay Dynamic QR Code ฝังยอดเงินอัตโนมัติในแชทให้ลูกค้าสแกนจ่ายได้ทันที</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-5">
          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
              เบอร์โทรศัพท์ / เลขประจำตัวประชาชน / Tax ID
            </label>
            <input
              name="promptpay_number"
              type="text"
              defaultValue={shop.promptpay_number || ''}
              placeholder="เช่น 0812345678 หรือ 3450101..."
              className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
              ชื่อบัญชีพร้อมเพย์
            </label>
            <input
              name="promptpay_name"
              type="text"
              defaultValue={shop.promptpay_name || ''}
              placeholder="เช่น ประภาวัชร์ สุทธิประภา"
              className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1 border-t border-outline-variant/20">
          <input
            type="checkbox"
            id="promptpay_qr_enabled"
            name="promptpay_qr_enabled"
            defaultChecked={shop.promptpay_qr_enabled ?? paymentShipping?.promptpay_qr_enabled ?? true}
            className="w-4 h-4 text-electric-blue rounded border-outline-variant focus:ring-electric-blue"
          />
          <label htmlFor="promptpay_qr_enabled" className="text-xs sm:text-sm font-medium text-on-surface cursor-pointer select-none">
            💡 ให้ AI สร้างและส่งรูปภาพ PromptPay QR Code สแกนจ่ายตามยอดจริงในแชทอัตโนมัติ
          </label>
        </div>
      </section>

      {/* Section 2: Bank Account Settings */}
      <section className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
        <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-3.5 sm:pb-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-on-surface font-headline-sm">โอนเงินผ่าน บัญชีธนาคาร (Bank Transfer)</h2>
            <p className="text-[11px] sm:text-xs text-on-surface-variant">รายละเอียดบัญชีสำหรับให้ลูกค้าโอนผ่านแอปธนาคารและส่งสลิปยืนยัน</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
              เลือกธนาคาร
            </label>
            <select
              name="bank_name"
              value={selectedBank}
              onChange={(e) => setSelectedBank(e.target.value)}
              className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all"
            >
              <option value="">-- กรุณาเลือกธนาคาร --</option>
              {THAI_BANKS.map((b) => (
                <option key={b.code} value={b.name}>
                  {b.name}
                </option>
              ))}
              {selectedBank && !THAI_BANKS.some((b) => b.name === selectedBank) && (
                <option value={selectedBank}>{selectedBank}</option>
              )}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-5">
            <div className="space-y-1.5">
              <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
                เลขที่บัญชี
              </label>
              <input
                name="bank_account_number"
                type="text"
                defaultValue={shop.bank_account_number || shop.payment_bank_account || paymentShipping?.bank_account_number || ''}
                placeholder="เช่น 123-4-56789-0"
                className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
                ชื่อบัญชีธนาคาร
              </label>
              <input
                name="bank_account_name"
                type="text"
                defaultValue={shop.bank_account_name || shop.payment_bank_acc_name || paymentShipping?.bank_account_name || ''}
                placeholder="เช่น นายประภาวัชร์ สุทธิประภา"
                className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Section: Automated Slip Verification API */}
      <section className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
        <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3.5 sm:pb-4 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-on-surface font-headline-sm">ระบบตรวจสอบสลิปอัตโนมัติ (Slip Verification API)</h2>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">Auto Check</span>
              </div>
              <p className="text-[11px] sm:text-xs text-on-surface-variant">เมื่อลูกค้าส่งรูปสลิปโอนเงินเข้ามาในแชท LINE บอท AI จะตรวจความถูกต้องกับระบบธนาคาร ยืนยันยอดเงิน และเปลี่ยนสถานะออเดอร์เป็น 'ชำระแล้ว' อัตโนมัติ</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-xl border border-outline-variant/30">
            <input
              type="checkbox"
              id="slip_verify_enabled"
              name="slip_verify_enabled"
              checked={slipEnabled}
              onChange={(e) => setSlipEnabled(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded border-outline-variant focus:ring-emerald-500 cursor-pointer"
            />
            <label htmlFor="slip_verify_enabled" className="text-xs font-semibold text-on-surface cursor-pointer select-none">
              {slipEnabled ? 'เปิดใช้งานตรวจสลิป' : 'ปิดระบบตรวจสลิป'}
            </label>
          </div>
        </div>

        {slipEnabled && (
          <div className="space-y-4 pt-1">
            {/* Provider Selection */}
            <div className="space-y-2">
              <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
                เลือกผู้ให้บริการ API ตรวจสอบสลิป (Slip Provider)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Thunder Solution */}
                <div
                  onClick={() => setSlipProvider('thunder')}
                  className={`flex flex-col p-3.5 rounded-xl border cursor-pointer transition-all ${
                    slipProvider === 'thunder'
                      ? 'border-electric-blue bg-electric-blue/5 shadow-sm ring-1 ring-electric-blue'
                      : 'border-outline-variant/60 bg-surface hover:bg-surface-container-low'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-on-surface">
                      <Zap className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
                      <span>Thunder Solution</span>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">แนะนำ</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    เร็ว แรง เสถียร ตรวจ 18 ธนาคาร + TrueMoney (thunder.in.th)
                  </p>
                  <input
                    type="radio"
                    name="slip_provider"
                    value="thunder"
                    checked={slipProvider === 'thunder'}
                    onChange={() => setSlipProvider('thunder')}
                    className="sr-only"
                  />
                </div>

                {/* EasySlip */}
                <div
                  onClick={() => setSlipProvider('easyslip')}
                  className={`flex flex-col p-3.5 rounded-xl border cursor-pointer transition-all ${
                    slipProvider === 'easyslip'
                      ? 'border-electric-blue bg-electric-blue/5 shadow-sm ring-1 ring-electric-blue'
                      : 'border-outline-variant/60 bg-surface hover:bg-surface-container-low'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-on-surface">
                      <ShieldCheck className="w-4 h-4 text-electric-blue shrink-0" />
                      <span>EasySlip</span>
                    </div>
                    <span className="text-[10px] font-medium text-on-surface-variant">มาตรฐาน</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    ระบบตรวจสลิปยอดนิยม รองรับ QR PromptPay และธนาคารชั้นนำ (easyslip.com)
                  </p>
                  <input
                    type="radio"
                    name="slip_provider"
                    value="easyslip"
                    checked={slipProvider === 'easyslip'}
                    onChange={() => setSlipProvider('easyslip')}
                    className="sr-only"
                  />
                </div>

                {/* SlipOK */}
                <div
                  onClick={() => setSlipProvider('slipok')}
                  className={`flex flex-col p-3.5 rounded-xl border cursor-pointer transition-all ${
                    slipProvider === 'slipok'
                      ? 'border-electric-blue bg-electric-blue/5 shadow-sm ring-1 ring-electric-blue'
                      : 'border-outline-variant/60 bg-surface hover:bg-surface-container-low'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-on-surface">
                      <RefreshCw className="w-4 h-4 text-purple-500 shrink-0" />
                      <span>SlipOK</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    ตรวจสลิปผ่าน Branch & Line Integration (slipok.com)
                  </p>
                  <input
                    type="radio"
                    name="slip_provider"
                    value="slipok"
                    checked={slipProvider === 'slipok'}
                    onChange={() => setSlipProvider('slipok')}
                    className="sr-only"
                  />
                </div>

                {/* Mock / Auto */}
                <div
                  onClick={() => setSlipProvider('mock')}
                  className={`flex flex-col p-3.5 rounded-xl border cursor-pointer transition-all ${
                    slipProvider === 'mock'
                      ? 'border-electric-blue bg-electric-blue/5 shadow-sm ring-1 ring-electric-blue'
                      : 'border-outline-variant/60 bg-surface hover:bg-surface-container-low'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-on-surface">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>โหมดจำลอง (Mock)</span>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">ฟรี</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    อนุมัติทันทีสำหรับทดสอบร้านค้า ไม่ต้องใช้ API Key
                  </p>
                  <input
                    type="radio"
                    name="slip_provider"
                    value="mock"
                    checked={slipProvider === 'mock'}
                    onChange={() => setSlipProvider('mock')}
                    className="sr-only"
                  />
                </div>
              </div>
            </div>

            {/* API Key Input Field (shown if not mock) */}
            {slipProvider !== 'mock' && (
              <div className="space-y-3 p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/30">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
                      API Key ({slipProvider === 'thunder' ? 'Thunder Solution' : slipProvider === 'slipok' ? 'SlipOK' : 'EasySlip'})
                    </label>
                    <a
                      href={
                        slipProvider === 'thunder'
                          ? 'https://developer.thunder.in.th/'
                          : slipProvider === 'slipok'
                          ? 'https://slipok.com/'
                          : 'https://developer.easyslip.com/'
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-electric-blue hover:underline flex items-center gap-1 font-medium"
                    >
                      <span>ขอ API Key จาก {slipProvider === 'thunder' ? 'thunder.in.th' : slipProvider === 'slipok' ? 'slipok.com' : 'easyslip.com'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="relative">
                    <input
                      name="slip_api_key"
                      type={showApiKey ? 'text' : 'password'}
                      defaultValue={slipConfig?.api_key || ''}
                      placeholder={
                        slipProvider === 'thunder'
                          ? 'เช่น thd_live_xxxxxxxxxxxxxxxxxxxxxxxx'
                          : slipProvider === 'slipok'
                          ? 'ใส่ API Key จาก SlipOK'
                          : 'เช่น ed17f60a-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
                      }
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface cursor-pointer p-1"
                      title={showApiKey ? 'ซ่อน Key' : 'แสดง Key'}
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    {slipConfig?.api_key ? (
                      <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> ใช้ API Key เฉพาะของร้านค้านี้เรียบร้อยแล้ว
                      </span>
                    ) : (
                      <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
                        💡 หากเว้นว่างไว้ ระบบจะใช้ API Key ค่าเริ่มต้นของระบบส่วนกลาง (ถ้ามี) หรือเข้าสู่โหมดจำลองอัตโนมัติ
                      </span>
                    )}
                  </div>
                </div>

                {/* SlipOK Branch ID */}
                {slipProvider === 'slipok' && (
                  <div className="space-y-1.5 pt-2 border-t border-outline-variant/20">
                    <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
                      Branch ID (SlipOK)
                    </label>
                    <input
                      name="slip_branch_id"
                      type="text"
                      defaultValue={slipConfig?.branch_id || '1'}
                      placeholder="เช่น 1 หรือ 2"
                      className="w-full px-3.5 py-2 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs sm:text-sm font-mono"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Section 4: Advanced Shipping Settings */}
      <section className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
        <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-3.5 sm:pb-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-success-green/10 flex items-center justify-center text-success-green shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-on-surface font-headline-sm">อัตราค่าจัดส่งสินค้า (Shipping Rates)</h2>
            <p className="text-[11px] sm:text-xs text-on-surface-variant">บอท AI จะคำนวณบวกค่าจัดส่งตามรูปแบบที่คุณเลือกในออเดอร์อัตโนมัติ</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
              ผู้ให้บริการจัดส่งหลัก
            </label>
            <select
              name="shipping_provider"
              value={shippingProvider}
              onChange={(e) => setShippingProvider(e.target.value)}
              className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all"
            >
              {SHIPPING_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
              รูปแบบการคิดค่าจัดส่ง
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  shippingFeeType === 'flat'
                    ? 'border-electric-blue bg-electric-blue/5 text-on-surface font-semibold'
                    : 'border-outline-variant/50 bg-merchant-bg text-on-surface-variant'
                }`}
              >
                <input
                  type="radio"
                  name="shipping_fee_type"
                  value="flat"
                  checked={shippingFeeType === 'flat'}
                  onChange={() => setShippingFeeType('flat')}
                  className="accent-electric-blue mt-0.5"
                />
                <div className="text-xs sm:text-sm">
                  <p className="font-bold text-on-surface">เหมาจ่ายอัตราเดียว</p>
                  <p className="text-[11px] text-on-surface-variant">คิดค่าส่งเท่ากันทั่วประเทศ</p>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  shippingFeeType === 'zone'
                    ? 'border-electric-blue bg-electric-blue/5 text-on-surface font-semibold'
                    : 'border-outline-variant/50 bg-merchant-bg text-on-surface-variant'
                }`}
              >
                <input
                  type="radio"
                  name="shipping_fee_type"
                  value="zone"
                  checked={shippingFeeType === 'zone'}
                  onChange={() => setShippingFeeType('zone')}
                  className="accent-electric-blue mt-0.5"
                />
                <div className="text-xs sm:text-sm">
                  <p className="font-bold text-on-surface">แยกตามพื้นที่ (กทม./ตจว.)</p>
                  <p className="text-[11px] text-on-surface-variant">คิดค่าส่งตามจังหวัดลูกค้า</p>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  shippingFeeType === 'free'
                    ? 'border-electric-blue bg-electric-blue/5 text-on-surface font-semibold'
                    : 'border-outline-variant/50 bg-merchant-bg text-on-surface-variant'
                }`}
              >
                <input
                  type="radio"
                  name="shipping_fee_type"
                  value="free"
                  checked={shippingFeeType === 'free'}
                  onChange={() => setShippingFeeType('free')}
                  className="accent-electric-blue mt-0.5"
                />
                <div className="text-xs sm:text-sm">
                  <p className="font-bold text-on-surface">ส่งฟรีทุกออเดอร์</p>
                  <p className="text-[11px] text-on-surface-variant">ไม่มีการเก็บค่าจัดส่ง</p>
                </div>
              </label>
            </div>
          </div>

          {/* Rate Inputs based on selection */}
          {shippingFeeType === 'flat' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-5 pt-2">
              <div className="space-y-1.5">
                <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
                  ค่าจัดส่งเหมาจ่าย (บาท)
                </label>
                <div className="relative">
                  <input
                    name="shipping_fee_amount"
                    type="number"
                    min="0"
                    step="5"
                    defaultValue={shop.shipping_fee_amount ?? 40}
                    placeholder="40"
                    className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all pr-12"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant font-bold">
                    บาท
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
                  โปรโมชั่นส่งฟรี เมื่อยอดซื้อครบ (บาท)
                </label>
                <div className="relative">
                  <input
                    name="free_shipping_threshold"
                    type="number"
                    min="0"
                    step="100"
                    defaultValue={shop.free_shipping_threshold ?? ''}
                    placeholder="เช่น 1000 (เว้นว่างหากไม่มี)"
                    className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all pr-12"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant font-bold">
                    บาท
                  </span>
                </div>
              </div>
            </div>
          )}

          {shippingFeeType === 'zone' && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
                    🏢 กทม. และปริมณฑล (บาท)
                  </label>
                  <div className="relative">
                    <input
                      name="shipping_zone_bkk"
                      type="number"
                      min="0"
                      step="5"
                      defaultValue={shop.shipping_zone_bkk ?? paymentShipping?.shipping_zone_bkk ?? 40}
                      placeholder="40"
                      className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all pr-12"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant font-bold">
                      บาท
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
                    🏞️ ต่างจังหวัด (บาท)
                  </label>
                  <div className="relative">
                    <input
                      name="shipping_zone_upcountry"
                      type="number"
                      min="0"
                      step="5"
                      defaultValue={shop.shipping_zone_upcountry ?? paymentShipping?.shipping_zone_upcountry ?? 60}
                      placeholder="60"
                      className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all pr-12"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant font-bold">
                      บาท
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
                    🏝️ พื้นที่ห่างไกล / เกาะ (บาท)
                  </label>
                  <div className="relative">
                    <input
                      name="shipping_zone_remote"
                      type="number"
                      min="0"
                      step="5"
                      defaultValue={shop.shipping_zone_remote ?? paymentShipping?.shipping_zone_remote ?? 100}
                      placeholder="100"
                      className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all pr-12"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant font-bold">
                      บาท
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
                  โปรโมชั่นส่งฟรี เมื่อยอดซื้อครบ (บาท)
                </label>
                <div className="relative">
                  <input
                    name="free_shipping_threshold"
                    type="number"
                    min="0"
                    step="100"
                    defaultValue={shop.free_shipping_threshold ?? ''}
                    placeholder="เช่น 1000 (เว้นว่างหากไม่มี)"
                    className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all pr-12"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant font-bold">
                    บาท
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Section 4: Cash on Delivery (COD) Settings */}
      <section className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
        <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3.5 sm:pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-on-surface font-headline-sm">บริการเก็บเงินปลายทาง (COD)</h2>
              <p className="text-[11px] sm:text-xs text-on-surface-variant">รองรับลูกค้าที่ต้องการชำระเงินเมื่อสินค้าส่งถึงบ้าน</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="cod_enabled"
              name="cod_enabled"
              checked={codEnabled}
              onChange={(e) => setCodEnabled(e.target.checked)}
              className="w-5 h-5 text-electric-blue rounded border-outline-variant focus:ring-electric-blue cursor-pointer"
            />
            <label htmlFor="cod_enabled" className="text-xs sm:text-sm font-bold text-on-surface cursor-pointer select-none">
              {codEnabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
            </label>
          </div>
        </div>

        {codEnabled && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-5 pt-1">
            <div className="space-y-1.5">
              <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
                ประเภทค่าธรรมเนียม COD
              </label>
              <select
                name="cod_fee_type"
                value={codFeeType}
                onChange={(e) => setCodFeeType(e.target.value)}
                className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all"
              >
                <option value="flat">เหมาจ่ายรายออเดอร์ (บาท)</option>
                <option value="percent">คิดเป็น % จากยอดค่าสินค้า</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
                จำนวนค่าธรรมเนียม COD
              </label>
              <div className="relative">
                <input
                  name="cod_fee_amount"
                  type="number"
                  min="0"
                  step={codFeeType === 'percent' ? '0.5' : '5'}
                  defaultValue={shop.cod_fee_amount ?? paymentShipping?.cod_fee_amount ?? 30}
                  placeholder={codFeeType === 'percent' ? '3' : '30'}
                  className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all pr-12"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant font-bold">
                  {codFeeType === 'percent' ? '%' : 'บาท'}
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Bottom Save Button & Notification */}
      {message && (
        <div
          className={`p-4 rounded-xl text-xs sm:text-sm font-label-md flex items-center justify-between transition-all ${
            message.type === 'success'
              ? 'bg-success-green/10 text-success-green border border-success-green/20'
              : 'bg-error-red/10 text-error-red border border-error-red/20'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-success-green shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-error-red shrink-0" />
            )}
            <p>{message.text}</p>
          </div>
          <button type="button" onClick={() => setMessage(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-4 sm:pt-6 pb-20 sm:pb-6 border-t border-outline-variant/30 mt-6 sm:pr-36">
        <div className="text-xs text-on-surface-variant flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>ตรวจสอบความถูกต้องของข้อมูลการชำระเงินและการจัดส่งก่อนกดบันทึก</span>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-electric-blue hover:bg-primary text-white font-label-md font-semibold px-8 py-3 rounded-xl transition-all shadow-md shadow-electric-blue/20 hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer text-xs sm:text-sm shrink-0"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 animate-spin" />
          ) : (
            <Save className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          )}
          <span>{loading ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าทั้งหมด'}</span>
        </button>
      </div>
    </form>
  )
}
