import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createAdminClient()

    // 1. Fetch document by id
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single()

    if (docError || !doc) {
      return new NextResponse('ไม่พบเอกสารใบเสนอราคาที่ต้องการ', { status: 404 })
    }

    // 2. Fetch shop details for company profile
    const { data: shop } = await supabase
      .from('shops')
      .select('*')
      .eq('id', doc.shop_id)
      .single()

    const companyName = shop?.company_name || shop?.name || 'บริษัท/ร้านค้า'
    const companyTaxId = shop?.company_tax_id || '-'
    const companyAddress = shop?.company_address || 'ที่อยู่บริษัท (สามารถระบุได้ที่ ตั้งค่า > ข้อมูลบริษัท)'
    const companyPhone = shop?.company_phone || shop?.phone || '-'
    const companyEmail = shop?.company_email || '-'
    const companyLogo = shop?.company_logo_url || ''

    const bankName = shop?.bank_name || shop?.payment_bank_name || ''
    const bankAccountNumber = shop?.bank_account_number || shop?.payment_bank_account || ''
    const bankAccountName = shop?.bank_account_name || shop?.payment_bank_acc_name || ''
    const promptpayId = shop?.promptpay_number || shop?.payment_promptpay || shop?.promptpay_id || ''

    const items: Array<{ name: string; price: number; qty: number; unit?: string; total?: number }> = Array.isArray(doc.items)
      ? doc.items
      : []

    const subtotal = Number(doc.subtotal || 0)
    const discount = Number(doc.discount_amount || 0)
    const vat = Number(doc.vat_amount || 0)
    const total = Number(doc.total_amount || 0)

    const issueDate = new Date(doc.created_at || Date.now()).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const initialLetter = companyName.trim().charAt(0) || 'D'

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ใบเสนอราคา Quotation - ${doc.doc_number || doc.doc_no || 'QT'}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Sarabun', sans-serif; }
    @media print {
      .no-print { display: none !important; }
      .mobile-items { display: none !important; }
      .desktop-table { display: block !important; }
      body { background: white !important; padding: 0 !important; }
      .paper-container { 
        box-shadow: none !important; 
        border: none !important; 
        padding: 0 !important; 
        max-width: 100% !important; 
        margin: 0 !important; 
        border-radius: 0 !important; 
      }
    }
  </style>
</head>
<body class="bg-slate-100/80 min-h-screen py-4 sm:py-10 text-gray-800 antialiased">

  <!-- Top Action Controls Bar -->
  <div class="max-w-4xl mx-auto px-3 sm:px-4 mb-3 sm:mb-5 no-print">
    <div class="bg-white/95 backdrop-blur-md p-2.5 sm:p-3 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2.5">
      <div class="flex items-center justify-between w-full sm:w-auto">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span class="text-xs font-bold text-slate-800">ใบเสนอราคา (Quotation)</span>
        </div>
        <span class="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 sm:ml-2">
          ${doc.doc_number || doc.doc_no}
        </span>
      </div>

      <div class="grid grid-cols-3 gap-2 w-full sm:w-auto">
        <a href="/api/doc/${id}/download?format=docx&openExternalBrowser=1" download class="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-xl border border-indigo-200/80 transition-all flex items-center justify-center gap-1.5 cursor-pointer no-underline active:scale-95 text-center shadow-xs">
          <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          Word
        </a>
        <a href="/api/doc/${id}/download?format=xlsx&openExternalBrowser=1" download class="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs rounded-xl border border-emerald-200/80 transition-all flex items-center justify-center gap-1.5 cursor-pointer no-underline active:scale-95 text-center shadow-xs">
          <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          Excel
        </a>
        <button onclick="handlePrintOrPdf()" class="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 text-center">
          <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
          พิมพ์/PDF
        </button>
      </div>
    </div>
  </div>

  <!-- Document Paper Container -->
  <div class="paper-container max-w-4xl mx-auto bg-white p-4 sm:p-10 md:p-12 sm:rounded-2xl shadow-md sm:border border-slate-200/80 space-y-5 sm:space-y-6">
    <!-- Header: Company Profile & Document Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start border-b border-slate-200 pb-5 sm:pb-6 gap-4 sm:gap-6">
      <div class="flex items-start gap-3 sm:gap-4 w-full sm:w-auto">
        ${companyLogo ? `
          <img src="${companyLogo}" alt="Logo" class="w-14 h-14 sm:w-16 sm:h-16 object-contain rounded-xl border border-slate-100 bg-slate-50 p-1 shrink-0" />
        ` : `
          <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg sm:text-xl shrink-0">
            ${initialLetter}
          </div>
        `}
        <div class="flex-1 min-w-0">
          <h1 class="text-lg sm:text-2xl font-bold text-slate-900 leading-tight">
            ${companyName}
          </h1>
          <p class="text-xs text-slate-500 mt-1 max-w-md leading-relaxed">
            ${companyAddress}
          </p>
          <div class="text-[11px] sm:text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>เลขประจำตัวผู้เสียภาษี: <span class="font-mono font-medium text-slate-700">${companyTaxId}</span></span>
            <span>|</span>
            <span>โทร: <span class="font-mono text-slate-700">${companyPhone}</span></span>
            ${companyEmail && companyEmail !== '-' ? `
              <span>|</span>
              <span>อีเมล: ${companyEmail}</span>
            ` : ''}
          </div>
        </div>
      </div>

      <div class="w-full sm:w-auto text-left sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
        <h2 class="text-2xl sm:text-3xl font-extrabold text-blue-600 tracking-wider">
          ใบเสนอราคา
        </h2>
        <p class="text-[11px] sm:text-xs font-semibold text-slate-400 uppercase tracking-widest mt-0.5">
          QUOTATION
        </p>
        <div class="mt-2 text-xs text-slate-600 space-y-1">
          <p>
            <span class="text-slate-400">เลขที่เอกสาร:</span>
            <span class="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
              ${doc.doc_number || doc.doc_no}
            </span>
          </p>
          <p>
            <span class="text-slate-400">วันที่ออกเอกสาร:</span>
            <span class="font-medium text-slate-800">${issueDate}</span>
          </p>
        </div>
      </div>
    </div>

    <!-- Customer Details Box -->
    <div class="p-3.5 sm:p-4 bg-slate-50/80 rounded-xl border border-slate-200/90 flex flex-col sm:flex-row justify-between gap-3 sm:gap-4">
      <div class="space-y-1">
        <h3 class="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          เรียน (เสนอราคาถึง):
        </h3>
        <p class="text-base font-bold text-slate-900">
          ${doc.customer_name || 'ลูกค้าผู้มีอุปการคุณ'}
        </p>
        ${doc.customer_phone ? `
          <p class="text-xs text-slate-600 flex items-center gap-1.5">
            <span class="text-slate-400">เบอร์โทร:</span>
            <span class="font-mono font-medium text-slate-800">${doc.customer_phone}</span>
          </p>
        ` : ''}
        ${doc.customer_address ? `
          <p class="text-xs text-slate-600">
            <span class="text-slate-400">ที่อยู่ / หน้างาน:</span> ${doc.customer_address}
          </p>
        ` : ''}
      </div>
      <div class="flex sm:flex-col justify-end items-start sm:items-end">
        <span class="inline-flex items-center px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-200/60">
          ● สถานะ: รออนุมัติการสั่งซื้อ
        </span>
      </div>
    </div>

    <!-- Mobile Items View (sm:hidden) - Solves Issue 2 -->
    <div class="mobile-items block sm:hidden space-y-2">
      <div class="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between pb-1.5 border-b border-slate-100">
        <span>รายการสินค้า / บริการ</span>
        <span class="text-slate-400 font-normal text-[11px]">${items.length} รายการ</span>
      </div>
      ${items.length > 0 ? items.map((item, idx) => {
        const rowTotal = Number((item.price || 0) * (item.qty || 1))
        return `
          <div class="p-3 bg-slate-50/70 rounded-xl border border-slate-200/80 space-y-2">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-start gap-2">
                <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-50 text-blue-600 font-bold text-[10px] shrink-0 mt-0.5">
                  ${idx + 1}
                </span>
                <span class="font-semibold text-slate-900 text-sm leading-snug">
                  ${item.name || '(ยังไม่ได้ระบุชื่อสินค้า)'}
                </span>
              </div>
              <div class="text-right shrink-0">
                <span class="font-mono font-bold text-slate-900 text-sm">
                  ฿${rowTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <div class="flex items-center justify-between text-xs text-slate-500 pl-7">
              <span>${item.qty || 1} ${item.unit || 'ชิ้น'} × ฿${Number(item.price || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span class="text-[11px] text-slate-400 font-medium">รวมย่อย</span>
            </div>
          </div>
        `
      }).join('') : `
        <div class="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
          ไม่มีรายการสินค้า
        </div>
      `}
    </div>

    <!-- Desktop & Print Table View (hidden sm:block) -->
    <div class="desktop-table hidden sm:block overflow-x-auto rounded-xl border border-slate-200">
      <table class="w-full text-left text-sm border-collapse">
        <thead>
          <tr class="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
            <th class="py-3 px-3 w-12 text-center">#</th>
            <th class="py-3 px-4">รายการสินค้า / บริการ</th>
            <th class="py-3 px-3 text-center w-24">หน่วย</th>
            <th class="py-3 px-3 text-center w-20">จำนวน</th>
            <th class="py-3 px-4 text-right w-28">ราคา/หน่วย (บาท)</th>
            <th class="py-3 px-4 text-right w-32">จำนวนเงิน (บาท)</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${items.length > 0 ? items.map((item, idx) => {
            const rowTotal = Number((item.price || 0) * (item.qty || 1))
            return `
              <tr class="hover:bg-slate-50/50">
                <td class="py-3 px-3 text-center text-xs text-slate-400">${idx + 1}</td>
                <td class="py-3 px-4 font-medium text-slate-900">${item.name || '(ยังไม่ได้ระบุชื่อสินค้า)'}</td>
                <td class="py-3 px-3 text-center text-xs text-slate-500">${item.unit || 'ชิ้น'}</td>
                <td class="py-3 px-3 text-center font-mono text-xs">${item.qty || 1}</td>
                <td class="py-3 px-4 text-right font-mono text-xs">${Number(item.price || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td class="py-3 px-4 text-right font-mono font-semibold text-slate-900">${rowTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            `
          }).join('') : `
            <tr>
              <td colspan="6" class="py-8 text-center text-slate-400 text-xs">ไม่มีรายการสินค้า</td>
            </tr>
          `}
        </tbody>
      </table>
    </div>

    <!-- Calculations & Payment Terms -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 pt-1">
      <div class="space-y-3">
        <div>
          <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            เงื่อนไขการชำระเงินและข้อกำหนด:
          </h4>
          <div class="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed whitespace-pre-line">
            ${doc.notes || '• กำหนดยืนราคาภายใน 30 วันนับจากวันที่ออกเอกสาร\n• กรุณาชำระเงินตามเงื่อนไขที่ตกลงกัน'}
          </div>
        </div>

        <!-- Bank / Payment Info -->
        ${(bankAccountNumber || promptpayId) ? `
          <div class="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-slate-700 space-y-1">
            <span class="font-bold text-blue-900 block">ข้อมูลการชำระเงิน:</span>
            ${bankName ? `<p>ธนาคาร: <span class="font-semibold">${bankName}</span></p>` : ''}
            ${bankAccountNumber ? `
              <p>
                เลขที่บัญชี: <span class="font-mono font-bold text-slate-900">${bankAccountNumber}</span>
                ${bankAccountName ? `<span> (${bankAccountName})</span>` : ''}
              </p>
            ` : ''}
            ${promptpayId ? `<p>PromptPay: <span class="font-mono font-bold text-slate-900">${promptpayId}</span></p>` : ''}
          </div>
        ` : ''}
      </div>

      <!-- Totals Table -->
      <div class="bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200 space-y-2 text-xs sm:text-sm">
        <div class="flex justify-between text-slate-600">
          <span>ยอดรวมก่อนภาษี (Subtotal):</span>
          <span class="font-mono font-semibold text-slate-900">
            ${subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
          </span>
        </div>

        ${discount > 0 ? `
          <div class="flex justify-between text-rose-600 font-medium">
            <span>ส่วนลด (Discount):</span>
            <span class="font-mono">
              -${discount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
            </span>
          </div>
        ` : ''}

        ${vat > 0 ? `
          <div class="flex justify-between text-slate-600">
            <span>ภาษีมูลค่าเพิ่ม VAT 7%:</span>
            <span class="font-mono font-semibold text-slate-900">
              ${vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
            </span>
          </div>
        ` : ''}

        <div class="flex justify-between text-sm sm:text-base font-bold text-slate-900 pt-2 border-t border-slate-300">
          <span>ยอดสุทธิทั้งสิ้น (Grand Total):</span>
          <span class="font-mono text-blue-600 text-base sm:text-xl font-extrabold">
            ${total.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
          </span>
        </div>
      </div>
    </div>

    <!-- Signature Blocks -->
    <div class="grid grid-cols-2 gap-4 sm:gap-8 pt-6 sm:pt-8 border-t border-slate-200 text-center text-xs text-slate-600">
      <div class="space-y-6 sm:space-y-8">
        <p class="font-medium text-slate-700">ในนาม ${companyName}</p>
        <div class="w-32 sm:w-48 mx-auto border-b border-slate-300"></div>
        <p>( ผู้มีอำนาจลงนาม / ผู้เสนอราคา )</p>
      </div>
      <div class="space-y-6 sm:space-y-8">
        <p class="font-medium text-slate-700">ผู้สั่งซื้อ / ผู้อนุมัติ</p>
        <div class="w-32 sm:w-48 mx-auto border-b border-slate-300"></div>
        <p>( ${doc.customer_name || '...........................................'} )</p>
      </div>
    </div>
  </div>

  <!-- Modal for LINE In-App Browser Guidance (Solves Issue 3) -->
  <div id="linePrintModal" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 hidden no-print">
    <div class="bg-white rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4">
      <div class="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
      </div>
      
      <div class="text-center space-y-1">
        <h3 class="text-base sm:text-lg font-bold text-slate-900">พิมพ์หรือบันทึกเป็น PDF</h3>
        <p class="text-xs text-slate-500 leading-relaxed">
          เบราว์เซอร์ของ LINE ไม่อนุญาตให้สั่งพิมพ์โดยตรง กรุณาเลือกวิธีที่สะดวกดังนี้ค่ะ:
        </p>
      </div>

      <div class="space-y-2 pt-1">
        <button onclick="openInExternalBrowser()" class="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
          เปิดในเบราว์เซอร์เครื่อง (บันทึก PDF ทันที)
        </button>

        <a href="/api/doc/${id}/download?format=docx&openExternalBrowser=1" download class="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer no-underline active:scale-95">
          <svg class="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          ดาวน์โหลดไฟล์ Word (.docx) แทน
        </a>
      </div>

      <div class="p-3 bg-amber-50 rounded-xl border border-amber-200/70 text-[11px] text-amber-800 space-y-1">
        <p class="font-bold flex items-center gap-1 text-amber-900">
          <span>💡 หรือทำด้วยตนเอง:</span>
        </p>
        <p class="text-amber-700 leading-normal">
          แตะจุด 3 จุด (⋮ หรือ ⋯) ที่มุมบนขวาของ LINE แล้วเลือก <b>"เปิดด้วยเบราว์เซอร์อื่น"</b> เพื่อพิมพ์หรือเซฟ PDF
        </p>
      </div>

      <button onclick="closeLineModal()" class="w-full py-1.5 text-xs text-slate-400 hover:text-slate-600 font-medium cursor-pointer">
        ปิดหน้าต่างนี้
      </button>
    </div>
  </div>

  <script>
    function isLineApp() {
      return /Line\//i.test(navigator.userAgent);
    }

    function openInExternalBrowser() {
      const url = new URL(window.location.href);
      url.searchParams.set('openExternalBrowser', '1');
      url.searchParams.set('autoPrint', '1');
      window.location.href = url.toString();
    }

    function handlePrintOrPdf() {
      if (isLineApp()) {
        document.getElementById('linePrintModal').classList.remove('hidden');
        return;
      }
      try {
        window.print();
      } catch (err) {
        document.getElementById('linePrintModal').classList.remove('hidden');
      }
    }

    function closeLineModal() {
      document.getElementById('linePrintModal').classList.add('hidden');
    }

    // Auto print if opened from external browser with autoPrint=1
    window.addEventListener('DOMContentLoaded', () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autoPrint') === '1' && !isLineApp()) {
        setTimeout(() => {
          try {
            window.print();
          } catch(e) {}
        }, 600);
      }
    });
  </script>
</body>
</html>`

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (err: any) {
    console.error('[Quotation Route Exception]:', err)
    return new NextResponse('เกิดข้อผิดพลาดในการโหลดใบเสนอราคา', { status: 500 })
  }
}
