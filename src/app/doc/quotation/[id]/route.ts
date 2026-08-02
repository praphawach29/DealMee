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
      .select('name, company_name, company_tax_id, company_address, company_phone, company_email, company_logo_url, vat_enabled, promptpay_id, bank_account_number, bank_name, bank_account_name')
      .eq('id', doc.shop_id)
      .single()

    const companyName = shop?.company_name || shop?.name || 'บริษัท/ร้านค้า'
    const companyTaxId = shop?.company_tax_id || '-'
    const companyAddress = shop?.company_address || '-'
    const companyPhone = shop?.company_phone || '-'
    const companyEmail = shop?.company_email || '-'
    const companyLogo = shop?.company_logo_url || ''

    const items: Array<{ name: string; price: number; qty: number; total: number }> = Array.isArray(doc.items)
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

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ใบเสนอราคา Quotation - ${doc.doc_number}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Sarabun', sans-serif; }
    @media print {
      .no-print { display: none !important; }
      body { background: white; }
    }
  </style>
</head>
<body class="bg-gray-100 min-h-screen py-8 text-gray-800">
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

  <!-- Document Paper Container -->
  <div class="max-w-4xl mx-auto bg-white p-8 md:p-12 rounded-2xl shadow-md border border-gray-200">
    <!-- Document Header -->
    <div class="flex flex-col md:flex-row justify-between items-start border-b border-gray-200 pb-8 gap-6">
      <div class="flex items-start gap-4">
        ${companyLogo ? `<img src="${companyLogo}" alt="Logo" class="w-16 h-16 object-contain rounded-lg border border-gray-100" />` : ''}
        <div>
          <h1 class="text-xl font-bold text-gray-900">${companyName}</h1>
          <p class="text-xs text-gray-500 mt-1 max-w-md">${companyAddress}</p>
          <p class="text-xs text-gray-500 mt-1">เลขประจำตัวผู้เสียภาษี: ${companyTaxId} | โทร: ${companyPhone}</p>
        </div>
      </div>
      <div class="text-right">
        <h2 class="text-2xl font-extrabold text-blue-600 tracking-wider">ใบเสนอราคา</h2>
        <p class="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-0.5">QUOTATION</p>
        <div class="mt-3 text-xs text-gray-600 space-y-1">
          <p><span class="font-medium text-gray-400">เลขที่เอกสาร:</span> <span class="font-mono font-bold text-gray-900">${doc.doc_number}</span></p>
          <p><span class="font-medium text-gray-400">วันที่ออกเอกสาร:</span> ${issueDate}</p>
        </div>
      </div>
    </div>

    <!-- Customer Information -->
    <div class="my-6 p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col md:flex-row justify-between gap-4">
      <div>
        <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider">เรียน (เสนอราคาถึง):</h3>
        <p class="text-sm font-bold text-gray-900 mt-1">${doc.customer_name || 'ลูกค้าผู้มีอุปการคุณ'}</p>
        ${doc.customer_phone ? `<p class="text-xs text-gray-600 mt-0.5">เบอร์โทร: ${doc.customer_phone}</p>` : ''}
        ${doc.customer_address ? `<p class="text-xs text-gray-600 mt-0.5">ที่อยู่: ${doc.customer_address}</p>` : ''}
      </div>
      <div class="text-right flex flex-col justify-end">
        <span class="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full self-start md:self-end">สถานะ: รออนุมัติการสั่งซื้อ</span>
      </div>
    </div>

    <!-- Items Table -->
    <div class="overflow-x-auto my-6">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b-2 border-gray-200 text-xs font-bold text-gray-500 uppercase">
            <th class="py-3 px-2 w-12 text-center">#</th>
            <th class="py-3 px-2">รายการสินค้า / บริการ</th>
            <th class="py-3 px-2 text-right w-24">ราคา/หน่วย</th>
            <th class="py-3 px-2 text-center w-20">จำนวน</th>
            <th class="py-3 px-2 text-right w-28">จำนวนเงิน (บาท)</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          ${items.map((item, idx) => `
            <tr>
              <td class="py-3.5 px-2 text-center text-xs text-gray-400">${idx + 1}</td>
              <td class="py-3.5 px-2 font-medium text-gray-900">${item.name}</td>
              <td class="py-3.5 px-2 text-right font-mono text-xs">${Number(item.price || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
              <td class="py-3.5 px-2 text-center font-mono text-xs">${item.qty}</td>
              <td class="py-3.5 px-2 text-right font-mono font-semibold text-gray-900">${Number((item.price || 0) * (item.qty || 1)).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Summary & Totals -->
    <div class="flex flex-col md:flex-row justify-between items-start border-t border-gray-200 pt-6 gap-6">
      <div class="w-full md:w-1/2 space-y-2">
        <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider">เงื่อนไขการชำระเงินและการรับประกัน:</h4>
        <ul class="text-xs text-gray-600 space-y-1 list-disc list-inside leading-relaxed">
          <li>กำหนดยืนราคาภายใน 30 วันนับจากวันที่ออกเอกสาร</li>
          <li>โอนชำระเงินผ่าน PromptPay หรือ บัญชีธนาคารของบริษัท</li>
          <li>สินค้ามีประกันศูนย์และรับประกันความพึงพอใจ</li>
        </ul>
      </div>

      <div class="w-full md:w-5/12 bg-gray-50 p-4 rounded-xl space-y-2 border border-gray-100">
        <div class="flex justify-between text-xs text-gray-600">
          <span>รวมเป็นเงิน (Subtotal):</span>
          <span class="font-mono font-semibold">${subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</span>
        </div>
        ${discount > 0 ? `
          <div class="flex justify-between text-xs text-green-600">
            <span>ส่วนลดพิเศษ (Discount):</span>
            <span class="font-mono font-semibold">-${discount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</span>
          </div>
        ` : ''}
        ${vat > 0 ? `
          <div class="flex justify-between text-xs text-gray-600">
            <span>ภาษีมูลค่าเพิ่ม (VAT 7%):</span>
            <span class="font-mono font-semibold">${vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</span>
          </div>
        ` : ''}
        <div class="flex justify-between text-base font-bold text-blue-600 pt-2 border-t border-gray-200">
          <span>จำนวนเงินรวมทั้งสิ้น:</span>
          <span class="font-mono">${total.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</span>
        </div>
      </div>
    </div>

    <!-- Signature Footer -->
    <div class="mt-12 pt-8 border-t border-gray-200 flex justify-between items-end text-center">
      <div class="w-40">
        <div class="border-b border-gray-300 pb-12"></div>
        <p class="text-xs text-gray-500 mt-2">ผู้อนุมัติสั่งซื้อ (ลูกค้า)</p>
      </div>
      <div class="w-40">
        <div class="border-b border-gray-300 pb-12"></div>
        <p class="text-xs font-semibold text-gray-900 mt-2">${companyName}</p>
        <p class="text-[10px] text-gray-400">ผู้เสนอราคา / เจ้าหน้าที่</p>
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
