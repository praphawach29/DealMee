'use client'

import { Printer, Download, ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react'
import Link from 'next/link'

export interface ReceiptData {
  id: string
  receipt_number: string
  created_at: string
  verified_at?: string
  plan_key: string
  plan_name: string
  billed_amount: number
  withheld_amount: number
  transferred_amount: number
  currency: string
  status: string
  customer_notes?: string
  shop: {
    id: string
    name: string
    company_name?: string
    company_tax_id?: string
    company_address?: string
    company_phone?: string
    company_email?: string
  }
  platform: {
    account_name: string
    payee_tax_id: string
    is_vat_registered: boolean
    company_address: string
    company_phone: string
    company_email: string
  }
}

export default function ReceiptDocument({
  data,
  showBackButton = true,
}: {
  data: ReceiptData
  showBackButton?: boolean
}) {
  const {
    receipt_number,
    verified_at,
    created_at,
    plan_key,
    plan_name,
    billed_amount,
    withheld_amount,
    transferred_amount,
    shop,
    platform,
  } = data
  const isWalletTopup = plan_key === 'wallet_topup'

  const dateToDisplay = new Date(verified_at || created_at).toLocaleDateString(
    'th-TH',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }
  )

  const isCorporateWithholding = withheld_amount > 0

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 sm:px-6 font-sans">
      {/* Action Bar (Hidden when printing) */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        {showBackButton ? (
          <Link
            href="/dashboard/billing"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>กลับไปหน้าประวัติการชำระเงิน</span>
          </Link>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>พิมพ์ใบเสร็จ / บันทึก PDF</span>
          </button>
        </div>
      </div>

      {/* Printable Receipt Paper Container */}
      <div className="bg-white text-slate-900 border border-slate-200 rounded-2xl shadow-xl p-8 sm:p-12 print:border-none print:shadow-none print:p-0 print:m-0 print:rounded-none">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-slate-200 pb-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-black text-sm shadow-xs">
                D
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {platform.account_name}
              </h1>
            </div>
            <p className="text-xs text-slate-600 max-w-sm leading-relaxed">
              {platform.company_address}
            </p>
            <div className="text-xs text-slate-600 space-y-0.5 pt-1">
              <p>
                <span className="font-semibold">เลขประจำตัวผู้เสียภาษี (Tax ID):</span>{' '}
                <span className="font-mono">{platform.payee_tax_id || '-'}</span>
              </p>
              {platform.company_phone && <p>โทรศัพท์: {platform.company_phone}</p>}
              {platform.company_email && <p>อีเมล: {platform.company_email}</p>}
            </div>
          </div>

          {/* Title and Receipt Number */}
          <div className="sm:text-right space-y-2 shrink-0">
            <div>
              {/* VAT Registration Rule Check: If false -> Strictly ใบเสร็จรับเงิน (Receipt) */}
              <h2 className="text-xl sm:text-2xl font-black text-indigo-900 tracking-tight">
                {platform.is_vat_registered
                  ? 'ใบเสร็จรับเงิน / ใบกำกับภาษี'
                  : 'ใบเสร็จรับเงิน'}
              </h2>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                {platform.is_vat_registered
                  ? 'RECEIPT / TAX INVOICE'
                  : 'RECEIPT'}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs space-y-1 font-mono">
              <div className="flex justify-between sm:justify-end gap-3">
                <span className="text-slate-500">เลขที่ / No:</span>
                <strong className="text-indigo-600 font-bold">
                  {receipt_number || 'REC-PENDING'}
                </strong>
              </div>
              <div className="flex justify-between sm:justify-end gap-3">
                <span className="text-slate-500">วันที่ / Date:</span>
                <span className="text-slate-800">{dateToDisplay}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payer Information (Shop / Corporate) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-slate-200 text-xs">
          <div>
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              ได้รับเงินจาก / Received From:
            </h3>
            <p className="text-sm font-bold text-slate-900">
              {shop.company_name || shop.name}
            </p>
            {shop.company_address && (
              <p className="text-slate-600 mt-1 leading-relaxed">{shop.company_address}</p>
            )}
            {shop.company_tax_id && (
              <p className="text-slate-700 mt-1">
                <span className="font-semibold">เลขประจำตัวผู้เสียภาษี:</span>{' '}
                <span className="font-mono">{shop.company_tax_id}</span>
              </p>
            )}
            {shop.company_email && <p className="text-slate-600 mt-0.5">อีเมล: {shop.company_email}</p>}
          </div>

          <div className="sm:text-right space-y-1">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              ช่องทางการชำระ / Payment Method:
            </h3>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>PromptPay QR Code (โอนเงินสำเร็จ)</span>
            </div>
            {isCorporateWithholding && (
              <p className="text-slate-500 text-[11px] mt-1">
                * มีการหักภาษี ณ ที่จ่าย 3% ตามมาตรา 3 เตรส (ภ.ง.ด.53)
              </p>
            )}
          </div>
        </div>

        {/* Items Table */}
        <div className="py-6 border-b border-slate-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-slate-900 text-slate-900 font-bold uppercase text-[11px]">
                <th className="py-2.5 text-left w-12">ลำดับ</th>
                <th className="py-2.5 text-left">รายการบริการ (Description)</th>
                <th className="py-2.5 text-center w-20">จำนวน</th>
                <th className="py-2.5 text-right w-32">จำนวนเงิน (THB)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-4 text-left font-mono">1</td>
                <td className="py-4 text-left">
                  {isWalletTopup ? (
                    <>
                      <p className="font-bold text-slate-900 text-sm">
                        เติมเงินเข้ากระเป๋า DealMee (เครดิตค่าบริการล่วงหน้า)
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        ใช้ชำระค่าแพ็กเกจรายเดือนและแพ็กเสริมของระบบ DealMee AI (Prepaid Service Credit)
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-bold text-slate-900 text-sm">
                        ค่าบริการใช้งานระบบ DealMee AI - แพ็กเกจ {plan_name}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        ระยะเวลาการใช้งาน 1 เดือน (SaaS Cloud Subscription Period: 30 Days)
                      </p>
                    </>
                  )}
                </td>
                <td className="py-4 text-center font-mono">{isWalletTopup ? '1 รายการ' : '1 งวด'}</td>
                <td className="py-4 text-right font-mono font-bold text-slate-900">
                  ฿{Number(billed_amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Calculation Summary */}
        <div className="py-6 flex justify-end">
          <div className="w-full sm:w-80 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>ยอดรวมค่าบริการ (Subtotal):</span>
              <span className="font-mono">
                ฿{Number(billed_amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {platform.is_vat_registered ? (
              <div className="flex justify-between text-slate-600">
                <span>ภาษีมูลค่าเพิ่ม 7% (VAT):</span>
                <span className="font-mono">
                  ฿{(Number(billed_amount) * 0.07).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ) : (
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>ภาษีมูลค่าเพิ่ม 7% (VAT):</span>
                <span>(ไม่อยู่ในระบบ VAT)</span>
              </div>
            )}

            {isCorporateWithholding && (
              <div className="flex justify-between text-amber-600 font-medium">
                <span>หักภาษี ณ ที่จ่าย 3% (WHT 3%):</span>
                <span className="font-mono">
                  -฿{Number(withheld_amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            <div className="pt-2 border-t-2 border-slate-900 flex justify-between items-baseline font-bold text-sm sm:text-base text-slate-900">
              <span>ยอดชำระสุทธิ (Net Total Paid):</span>
              <span className="font-mono text-indigo-700">
                ฿{Number(transferred_amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Signature & Confirmation Footnote */}
        <div className="pt-8 mt-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-8 items-end text-xs text-slate-500">
          <div className="space-y-1">
            <p className="flex items-center gap-1 text-emerald-600 font-semibold">
              <ShieldCheck className="h-4 w-4" />
              <span>เอกสารนี้ถูกสร้างโดยระบบอิเล็กทรอนิกส์สมบูรณ์</span>
            </p>
            <p className="text-[11px] leading-relaxed">
              การชำระเงินได้รับการยืนยันและบันทึกประวัติเข้าระบบ DealMee AI Platform เรียบร้อยแล้ว
            </p>
          </div>

          <div className="text-center sm:text-right space-y-3">
            <div className="inline-block border-b border-slate-300 w-48 pb-8">
              <span className="text-[11px] text-slate-400 font-mono">
                [ ระบบอนุมัติอิเล็กทรอนิกส์ ]
              </span>
            </div>
            <p className="text-slate-700 font-semibold">
              ผู้รับเงิน (Authorized Signature)
            </p>
            <p className="text-[10px] text-slate-400">
              {platform.account_name}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
