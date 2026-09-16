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

    const initialLetter = companyName.trim().charAt(0) || 'B'

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
      body { background: white !important; padding: 0 !important; }
      .paper-container { box-shadow: none !important; border: none !important; padding: 0 !important; }
    }
  </style>
</head>
<body class="bg-gray-100 min-h-screen py-6 sm:py-10 text-gray-800">
  <!-- Print Controls Bar -->
  <div class="max-w-4xl mx-auto px-4 mb-4 flex justify-between items-center no-print">
    <div class="flex items-center gap-2">
      <span class="text-xs font-semibold text-gray-500">เอกสารใบเสนอราคา (Quotation)</span>
    </div>
    <button onclick="window.print()" class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
      พิมพ์ / บันทึกเป็น PDF
    </button>
  </div>

  <!-- Document Paper Container (Matches Live Preview in Dashboard) -->
  <div class="paper-container max-w-4xl mx-auto bg-white p-6 sm:p-12 rounded-2xl shadow-xl border border-gray-200 space-y-6">
    <!-- Header: Company Profile & Document Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start border-b border-gray-200 pb-6 gap-6">
      <div class="flex items-start gap-4">
        ${companyLogo ? `
          <img src="${companyLogo}" alt="Logo" class="w-16 h-16 object-contain rounded-xl border border-gray-100 bg-gray-50 p-1 shrink-0" />
        ` : `
          <div class="w-14 h-14 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl shrink-0">
            ${initialLetter}
          </div>
        `}
        <div>
          <h1 class="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">
            ${companyName}
          </h1>
          <p class="text-xs text-gray-500 mt-1 max-w-md leading-relaxed">
            ${companyAddress}
          </p>
          <p class="text-xs text-gray-500 mt-1">
            <span>เลขประจำตัวผู้เสียภาษี: <span class="font-mono font-medium">${companyTaxId}</span></span>
            <span class="mx-2">|</span>
            <span>โทร: <span class="font-mono">${companyPhone}</span></span>
            ${companyEmail && companyEmail !== '-' ? `
              <span class="mx-2">|</span>
              <span>อีเมล: ${companyEmail}</span>
            ` : ''}
          </p>
        </div>
      </div>

      <div class="text-left sm:text-right shrink-0">
        <h2 class="text-2xl sm:text-3xl font-extrabold text-blue-600 tracking-wider">
          ใบเสนอราคา
        </h2>
        <p class="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-0.5">
          QUOTATION
        </p>
        <div class="mt-3 text-xs text-gray-600 space-y-1">
          <p>
            <span class="text-gray-400">เลขที่เอกสาร:</span>
            <span class="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
              ${doc.doc_number || doc.doc_no}
            </span>
          </p>
          <p>
            <span class="text-gray-400">วันที่ออกเอกสาร:</span>
            <span class="font-medium text-gray-800">${issueDate}</span>
          </p>
        </div>
      </div>
    </div>

    <!-- Customer Details Box -->
    <div class="p-4 bg-gray-50/80 rounded-xl border border-gray-200 flex flex-col sm:flex-row justify-between gap-4">
      <div class="space-y-1">
        <h3 class="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
          เรียน (เสนอราคาถึง):
        </h3>
        <p class="text-base font-bold text-gray-900">
          ${doc.customer_name || 'ลูกค้าผู้มีอุปการคุณ'}
        </p>
        ${doc.customer_phone ? `
          <p class="text-xs text-gray-600 flex items-center gap-1.5">
            <span class="text-gray-400">เบอร์โทร:</span>
            <span class="font-mono font-medium">${doc.customer_phone}</span>
          </p>
        ` : ''}
        ${doc.customer_address ? `
          <p class="text-xs text-gray-600">
            <span class="text-gray-400">ที่อยู่ / หน้างาน:</span> ${doc.customer_address}
          </p>
        ` : ''}
      </div>
      <div class="flex sm:flex-col justify-end items-start sm:items-end">
        <span class="inline-flex items-center px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-200/60">
          ● สถานะ: รออนุมัติการสั่งซื้อ
        </span>
      </div>
    </div>

    <!-- Items Table -->
    <div class="overflow-x-auto rounded-xl border border-gray-200">
      <table class="w-full text-left text-sm border-collapse">
        <thead>
          <tr class="bg-gray-50/90 border-b border-gray-200 text-xs font-bold text-gray-600 uppercase">
            <th class="py-3 px-3 w-12 text-center">#</th>
            <th class="py-3 px-4">รายการสินค้า / บริการ</th>
            <th class="py-3 px-3 text-center w-24">หน่วย</th>
            <th class="py-3 px-3 text-center w-20">จำนวน</th>
            <th class="py-3 px-4 text-right w-28">ราคา/หน่วย (บาท)</th>
            <th class="py-3 px-4 text-right w-32">จำนวนเงิน (บาท)</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          ${items.length > 0 ? items.map((item, idx) => {
            const rowTotal = Number((item.price || 0) * (item.qty || 1))
            return `
              <tr class="hover:bg-gray-50/50">
                <td class="py-3 px-3 text-center text-xs text-gray-400">${idx + 1}</td>
                <td class="py-3 px-4 font-medium text-gray-900">${item.name || '(ยังไม่ได้ระบุชื่อสินค้า)'}</td>
                <td class="py-3 px-3 text-center text-xs text-gray-500">${item.unit || 'ชิ้น'}</td>
                <td class="py-3 px-3 text-center font-mono text-xs">${item.qty || 1}</td>
                <td class="py-3 px-4 text-right font-mono text-xs">${Number(item.price || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td class="py-3 px-4 text-right font-mono font-semibold text-gray-900">${rowTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            `
          }).join('') : `
            <tr>
              <td colspan="6" class="py-8 text-center text-gray-400 text-xs">ไม่มีรายการสินค้า</td>
            </tr>
          `}
        </tbody>
      </table>
    </div>

    <!-- Calculations & Payment Terms -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
      <div class="space-y-3">
        <div>
          <h4 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
            เงื่อนไขการชำระเงินและข้อกำหนด:
          </h4>
          <div class="text-xs text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-200 leading-relaxed whitespace-pre-line">
            ${doc.notes || '• กำหนดยืนราคาภายใน 30 วันนับจากวันที่ออกเอกสาร\n• กรุณาชำระเงินตามเงื่อนไขที่ตกลงกัน'}
          </div>
        </div>

        <!-- Bank / Payment Info -->
        ${(bankAccountNumber || promptpayId) ? `
          <div class="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-gray-700 space-y-1">
            <span class="font-bold text-blue-900 block">ข้อมูลการชำระเงิน:</span>
            ${bankName ? `<p>ธนาคาร: <span class="font-semibold">${bankName}</span></p>` : ''}
            ${bankAccountNumber ? `
              <p>
                เลขที่บัญชี: <span class="font-mono font-bold text-gray-900">${bankAccountNumber}</span>
                ${bankAccountName ? `<span> (${bankAccountName})</span>` : ''}
              </p>
            ` : ''}
            ${promptpayId ? `<p>PromptPay: <span class="font-mono font-bold text-gray-900">${promptpayId}</span></p>` : ''}
          </div>
        ` : ''}
      </div>

      <!-- Totals Table -->
      <div class="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2 text-xs sm:text-sm">
        <div class="flex justify-between text-gray-600">
          <span>ยอดรวมก่อนภาษี (Subtotal):</span>
          <span class="font-mono font-semibold text-gray-900">
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
          <div class="flex justify-between text-gray-600">
            <span>ภาษีมูลค่าเพิ่ม VAT 7%:</span>
            <span class="font-mono font-semibold text-gray-900">
              ${vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
            </span>
          </div>
        ` : ''}

        <div class="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-300">
          <span>ยอดสุทธิทั้งสิ้น (Grand Total):</span>
          <span class="font-mono text-blue-600 text-lg sm:text-xl font-extrabold">
            ${total.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
          </span>
        </div>
      </div>
    </div>

    <!-- Signature Blocks -->
    <div class="grid grid-cols-2 gap-8 pt-8 border-t border-gray-200 text-center text-xs text-gray-600">
      <div class="space-y-8">
        <p class="font-medium text-gray-700">ในนาม ${companyName}</p>
        <div class="w-48 mx-auto border-b border-gray-300"></div>
        <p>( ผู้มีอำนาจลงนาม / ผู้เสนอราคา )</p>
      </div>
      <div class="space-y-8">
        <p class="font-medium text-gray-700">ผู้สั่งซื้อ / ผู้อนุมัติ</p>
        <div class="w-48 mx-auto border-b border-gray-300"></div>
        <p>( ${doc.customer_name || '...........................................'} )</p>
      </div>
    </div>
  </div>
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
