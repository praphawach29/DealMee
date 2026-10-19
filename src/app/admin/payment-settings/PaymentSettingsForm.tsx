'use client'

import { useState } from 'react'
import { Loader2, Check, Save, Building } from 'lucide-react'
import { updatePlatformSettingsAction } from '../payments/actions'
import { PlatformBillingSettings } from '@/lib/billing/manualBilling'

export default function PaymentSettingsForm({
  initialSettings,
}: {
  initialSettings: PlatformBillingSettings
}) {
  const [settings, setSettings] = useState<PlatformBillingSettings>(initialSettings)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSavedSuccess, setSettingsSavedSuccess] = useState(false)

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
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          ตั้งค่าบัญชีรับเงิน
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          บัญชี PromptPay ที่ร้านค้าโอนเงินเติม Wallet เข้ามา และข้อมูลผู้ออกใบเสร็จรับเงิน
        </p>
      </div>

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
    </div>
  )
}
