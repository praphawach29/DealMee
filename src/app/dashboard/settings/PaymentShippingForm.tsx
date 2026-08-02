'use client'

import { useState } from 'react'
import { updatePaymentShippingSettings } from './actions'

export interface PaymentShippingShopData {
  id: string
  promptpay_number?: string | null
  promptpay_name?: string | null
  bank_name?: string | null
  bank_account_number?: string | null
  bank_account_name?: string | null
  shipping_provider?: string | null
  shipping_fee_type?: string | null
  shipping_fee_amount?: number | null
  free_shipping_threshold?: number | null
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

const SHIPPING_PROVIDERS = [
  { id: 'standard', name: '📦 ขนส่งพัสดุทั่วไป (Standard Delivery)' },
  { id: 'flash', name: '⚡ Flash Express' },
  { id: 'kerry', name: '🚚 Kerry Express' },
  { id: 'thailandpost', name: '📮 ไปรษณีย์ไทย (EMS / ลงทะเบียน)' },
  { id: 'j_and_t', name: '🔴 J&T Express' },
  { id: 'lalamove', name: '🛵 Lalamove / Rider ส่งด่วน' },
]

export default function PaymentShippingForm({ shop }: { shop: PaymentShippingShopData }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [shippingFeeType, setShippingFeeType] = useState<string>(shop.shipping_fee_type || 'flat')

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
    }
  }

  return (
    <form action={handleSubmit} className="space-y-5 sm:space-y-6">
      {/* Header & Save Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-on-surface font-headline-md leading-tight">ตั้งค่าการชำระเงินและจัดส่ง</h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5 font-body-md">
            กำหนดช่องทางรับเงิน บัญชีธนาคาร และอัตราค่าจัดส่งเพื่อให้บอท AI ส่งให้ลูกค้าในแชทอัตโนมัติ
          </p>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-electric-blue hover:bg-primary text-white font-label-md font-semibold px-4 py-2 rounded-xl transition-all shadow-md shadow-electric-blue/20 hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer text-xs sm:text-sm shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">
            {loading ? 'sync' : 'save'}
          </span>
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
            <span className="material-symbols-outlined text-[20px]">
              {message.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <p>{message.text}</p>
          </div>
          <button type="button" onClick={() => setMessage(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Section 1: PromptPay Settings */}
      <section className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
        <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-3.5 sm:pb-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-electric-blue/10 flex items-center justify-center text-electric-blue shrink-0">
            <span className="material-symbols-outlined text-[20px]">qr_code_2</span>
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-on-surface font-headline-sm">ชำระเงินผ่าน พร้อมเพย์ (PromptPay QR)</h2>
            <p className="text-[11px] sm:text-xs text-on-surface-variant">บอท AI จะสร้าง QR Code สแกนจ่ายตามยอดเงินจริงให้ออเดอร์อัตโนมัติ</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-5">
          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
              เบอร์โทรศัพท์ / เลขประจำตัวประชาชน
            </label>
            <input
              name="promptpay_number"
              type="text"
              defaultValue={shop.promptpay_number || ''}
              placeholder="เช่น 0812345678 หรือ 1100200..."
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
              placeholder="เช่น บจก. บอทิฟาย ซอฟต์แวร์"
              className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all"
            />
          </div>
        </div>
      </section>

      {/* Section 2: Bank Account Settings */}
      <section className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
        <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-3.5 sm:pb-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 shrink-0">
            <span className="material-symbols-outlined text-[20px]">account_balance</span>
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-on-surface font-headline-sm">โอนเงินผ่าน บัญชีธนาคาร (Bank Transfer)</h2>
            <p className="text-[11px] sm:text-xs text-on-surface-variant">รายละเอียดบัญชีสำหรับให้ลูกค้าโอนและส่งสลิปยืนยัน</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
              เลือกธนาคาร
            </label>
            <select
              name="bank_name"
              defaultValue={shop.bank_name || ''}
              className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all"
            >
              <option value="">-- กรุณาเลือกธนาคาร --</option>
              {THAI_BANKS.map((b) => (
                <option key={b.code} value={b.name}>
                  {b.name}
                </option>
              ))}
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
                defaultValue={shop.bank_account_number || ''}
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
                defaultValue={shop.bank_account_name || ''}
                placeholder="เช่น นายบอทิฟาย ใจดี"
                className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Shipping Settings */}
      <section className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
        <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-3.5 sm:pb-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-success-green/10 flex items-center justify-center text-success-green shrink-0">
            <span className="material-symbols-outlined text-[20px]">local_shipping</span>
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-on-surface font-headline-sm">อัตราค่าจัดส่งสินค้า (Shipping Rates)</h2>
            <p className="text-[11px] sm:text-xs text-on-surface-variant">บอท AI จะบวกคำนวณค่าจัดส่งในยอดรวมเมื่อลูกค้ารวมสินค้าในตะกร้า</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
              ผู้ให้บริการจัดส่งหลัก
            </label>
            <select
              name="shipping_provider"
              defaultValue={shop.shipping_provider || 'standard'}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
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
                  className="accent-electric-blue"
                />
                <div className="text-xs sm:text-sm">
                  <p className="font-bold text-on-surface">เหมาจ่ายต่อออเดอร์</p>
                  <p className="text-[11px] text-on-surface-variant">คิดค่าจัดส่งอัตราเดียวต่อ 1 คำสั่งซื้อ</p>
                </div>
              </label>

              <label
                className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
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
                  className="accent-electric-blue"
                />
                <div className="text-xs sm:text-sm">
                  <p className="font-bold text-on-surface">ส่งฟรีทุกออเดอร์</p>
                  <p className="text-[11px] text-on-surface-variant">ไม่มีการเก็บค่าจัดส่งเพิ่มเติม</p>
                </div>
              </label>
            </div>
          </div>

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
        </div>
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
            <span className="material-symbols-outlined text-[20px]">
              {message.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <p>{message.text}</p>
          </div>
          <button onClick={() => setMessage(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      <div className="flex justify-end pt-2 sm:pt-4">
        <button
          type="submit"
          disabled={loading}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-electric-blue hover:bg-primary text-white font-label-md font-semibold px-8 py-3 rounded-xl transition-all shadow-md shadow-electric-blue/20 hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer text-xs sm:text-sm"
        >
          <span className="material-symbols-outlined text-[18px] sm:text-[20px]">
            {loading ? 'sync' : 'save'}
          </span>
          <span>{loading ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าทั้งหมด'}</span>
        </button>
      </div>
    </form>
  )
}
