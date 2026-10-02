'use client'

import { useState } from 'react'
import { updateCompanySettings } from './actions'
import { Save, CheckCircle2, AlertCircle, FileText, RefreshCw } from 'lucide-react'

interface ShopData {
  id: string
  name: string
  company_name?: string | null
  company_tax_id?: string | null
  company_address?: string | null
  company_phone?: string | null
  company_email?: string | null
  company_logo_url?: string | null
  company_signature_url?: string | null
  vat_enabled?: boolean | null
  features?: any
}

export default function CompanySettingsForm({ shop }: { shop: ShopData }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setMessage(null)

    const res = await updateCompanySettings(formData)
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-on-surface font-headline-md leading-tight">
            ข้อมูลบริษัทและใบเสนอราคา (Company & Documents)
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5 font-body-md">
            กำหนดข้อมูลบริษัท หัวกระดาษ และเงื่อนไขสำหรับให้ AI ออกใบเสนอราคา (Quotation PDF) ให้ลูกค้าอัตโนมัติ
          </p>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-electric-blue hover:bg-primary text-white font-label-md font-semibold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-electric-blue/20 hover:-translate-y-0.5 cursor-pointer disabled:opacity-50 shrink-0 text-xs sm:text-sm"
        >
          {loading ? <RefreshCw className="w-4 h-4 shrink-0 animate-spin" /> : <Save className="w-4 h-4 shrink-0" />}
          <span>{loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูลบริษัท'}</span>
        </button>
      </div>

      {/* Alert Notification */}
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
          <button onClick={() => setMessage(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Company Form Card */}
      <section className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
        <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-3.5 sm:pb-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-on-surface font-headline-sm">
              ข้อมูลนิติบุคคล / ร้านค้า สำหรับเอกสาร
            </h2>
            <p className="text-[11px] sm:text-xs text-on-surface-variant">
              ข้อมูลนี้จะนำไปแสดงบนหัวกระดาษของใบเสนอราคาและเอกสารการขาย
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
              ชื่อบริษัท / ร้านค้า (สำหรับออกเอกสาร)
            </label>
            <input
              type="text"
              name="company_name"
              defaultValue={shop.company_name || shop.name || ''}
              placeholder="เช่น บริษัท ดีลมี เอไอ จำกัด (สำนักงานใหญ่)"
              className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
              เลขประจำตัวผู้เสียภาษี (Tax ID)
            </label>
            <input
              type="text"
              name="company_tax_id"
              defaultValue={shop.company_tax_id || ''}
              placeholder="เช่น 0105565123456"
              className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all font-mono"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
              ที่อยู่บริษัท (ใช้ระบุในใบเสนอราคา)
            </label>
            <textarea
              name="company_address"
              rows={2}
              defaultValue={shop.company_address || ''}
              placeholder="เช่น 123 อาคารซูเปอร์ทาวเวอร์ ชั้น 15 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110"
              className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all leading-relaxed"
            ></textarea>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
              เบอร์โทรศัพท์ติดต่อ
            </label>
            <input
              type="text"
              name="company_phone"
              defaultValue={shop.company_phone || ''}
              placeholder="เช่น 02-123-4567"
              className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
              อีเมลบริษัท
            </label>
            <input
              type="email"
              name="company_email"
              defaultValue={shop.company_email || ''}
              placeholder="เช่น contact@company.com"
              className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
              URL โลโก้บริษัท (สำหรับหัวกระดาษใบเสนอราคา)
            </label>
            <input
              type="url"
              name="company_logo_url"
              defaultValue={shop.company_logo_url || ''}
              placeholder="เช่น https://yourdomain.com/logo.png"
              className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all"
            />
          </div>

          {/* Authorized Signature Card */}
          <div className="space-y-2 sm:col-span-2 p-4 bg-slate-50/70 border border-outline-variant/60 rounded-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="block text-xs sm:text-sm font-bold text-on-surface font-label-md">
                  ✍️ รูปลายเซ็นผู้มีอำนาจ / ผู้เสนอราคา (Authorized Signature)
                </label>
                <p className="text-[11px] sm:text-xs text-on-surface-variant">
                  PNG พื้นหลังโปร่งใสจะแสดงผลดีที่สุด — ลายเซ็นจะนำไปประทับในใบเสนอราคาอัตโนมัติ (ทั้งบนเว็บ, PDF, Word และ Excel)
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-1">
              <input
                type="url"
                name="company_signature_url"
                id="company_signature_url"
                defaultValue={shop.company_signature_url || shop.features?.company_signature_url || ''}
                placeholder="เช่น https://yourdomain.com/signature.png"
                className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-outline-variant bg-white text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 sm:col-span-2">
            <input
              type="checkbox"
              id="company_vat_enabled"
              name="vat_enabled"
              defaultChecked={shop.vat_enabled || false}
              className="w-4 h-4 text-electric-blue rounded border-outline-variant focus:ring-electric-blue"
            />
            <label htmlFor="company_vat_enabled" className="text-xs sm:text-sm font-medium text-on-surface cursor-pointer select-none">
              คำนวณภาษีมูลค่าเพิ่ม (VAT 7%) ในใบเสนอราคาโดยอัตโนมัติ
            </label>
          </div>
        </div>
      </section>

      <div className="flex justify-end pt-2 sm:pt-4">
        <button
          type="submit"
          disabled={loading}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-electric-blue hover:bg-primary text-white font-label-md font-semibold px-8 py-3 rounded-xl transition-all shadow-md shadow-electric-blue/20 hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer text-xs sm:text-sm"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 animate-spin" />
          ) : (
            <Save className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          )}
          <span>{loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูลบริษัท'}</span>
        </button>
      </div>
    </form>
  )
}
