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
    let companyLogo = shop?.company_logo_url || ''

    // Auto-fallback: if company_logo_url is empty but shop has LINE bot token, fetch LINE OA avatar
    if (!companyLogo && shop?.line_token) {
      try {
        const lineRes = await fetch('https://api.line.me/v2/bot/info', {
          headers: { Authorization: `Bearer ${shop.line_token}` },
          next: { revalidate: 3600 }
        })
        if (lineRes.ok) {
          const botInfo = await lineRes.json()
          if (botInfo.pictureUrl) {
            companyLogo = botInfo.pictureUrl
          }
        }
      } catch (e) {
        // silent fallback
      }
    }

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
    const docNo = doc.doc_number || doc.doc_no || 'QT'
    const safeDocNo = String(docNo).replace(/[^a-zA-Z0-9_-]/g, '_')
    const companySignature = shop?.company_signature_url || shop?.features?.company_signature_url || ''
    const isAccepted = doc.status === 'accepted' || (typeof doc.notes === 'string' && doc.notes.includes('[STATUS:ACCEPTED'))
    const acceptedAt = (typeof doc.notes === 'string' && doc.notes.match(/\[STATUS:ACCEPTED:([^\]]+)\]/)?.[1]) || doc.accepted_at || (doc.status === 'accepted' ? doc.updated_at : null)
    const acceptedDateStr = acceptedAt ? new Date(acceptedAt).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) : ''

    const publicUrl = `https://app.dealmee.app/doc/quotation/${id}`
    const lineShareText = `📄 ใบเสนอราคา ${docNo}\n🏢 จาก: ${companyName}\n👤 ผู้รับ: ${doc.customer_name || 'คุณลูกค้า'}\n💰 ยอดสุทธิทั้งสิ้น: ฿${total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}\n\n🔗 เปิดดูใบเสนอราคาและดาวน์โหลด:\n${publicUrl}`
    const lineShareUrl = `https://line.me/R/msg/text/?${encodeURIComponent(lineShareText)}`

    // Helper: Convert total number to Thai Baht text (เช่น หนึ่งพันแปดร้อยบาทถ้วน)
    function formatThaiBaht(num: number): string {
      if (isNaN(num) || num === 0) return 'ศูนย์บาทถ้วน'
      const fixed = Number(num).toFixed(2)
      const numbers = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']
      const units = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน']
      const [baht, satang] = fixed.split('.')

      function readGroup(str: string): string {
        let result = ''
        const len = str.length
        for (let i = 0; i < len; i++) {
          const digit = Number(str[i])
          const pos = len - i - 1
          if (digit !== 0) {
            if (pos === 0 && digit === 1 && len > 1) {
              result += 'เอ็ด'
            } else if (pos === 1 && digit === 2) {
              result += 'ยี่'
            } else if (pos === 1 && digit === 1) {
              // no prefix
            } else {
              result += numbers[digit]
            }
            result += units[pos]
          }
        }
        return result
      }

      let b = baht
      const parts: string[] = []
      while (b.length > 6) {
        parts.unshift(b.slice(-6))
        b = b.slice(0, -6)
      }
      parts.unshift(b)

      const bahtStr = parts.map((p, idx) => {
        const r = readGroup(p)
        return (idx < parts.length - 1 && r) ? r + 'ล้าน' : r
      }).join('') + 'บาท'

      if (Number(satang) === 0) {
        return bahtStr + 'ถ้วน'
      }

      let satangStr = ''
      const d1 = Number(satang[0])
      const d2 = Number(satang[1])
      if (d1 === 1) satangStr += 'สิบ'
      else if (d1 === 2) satangStr += 'ยี่สิบ'
      else if (d1 > 2) satangStr += numbers[d1] + 'สิบ'

      if (d2 === 1 && d1 > 0) satangStr += 'เอ็ด'
      else if (d2 > 0) satangStr += numbers[d2]

      return bahtStr + satangStr + 'สตางค์'
    }

    const thaiBahtText = formatThaiBaht(total)

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ใบเสนอราคา Quotation - ${doc.doc_number || doc.doc_no || 'QT'}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
  <style>
    body { font-family: 'Sarabun', sans-serif; }

    @page {
      size: A4 portrait;
      margin: 8mm 10mm 10mm 10mm;
    }

    /* Print & PDF Exact Styling */
    @media print {
      .no-print, #lineTopBanner, #linePrintModal {
        display: none !important;
      }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      html, body {
        background: #ffffff !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        height: auto !important;
        font-size: 12px !important;
        color: #0f172a !important;
      }
      .paper-container {
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }
      .mobile-items {
        display: none !important;
      }
      .desktop-table {
        display: block !important;
        width: 100% !important;
        border: 1px solid #cbd5e1 !important;
        border-radius: 8px !important;
        margin-top: 10px !important;
        margin-bottom: 14px !important;
      }
      .desktop-table table {
        width: 100% !important;
        border-collapse: collapse !important;
      }
      .desktop-table th {
        background-color: #1e293b !important;
        color: #ffffff !important;
        padding: 8px 12px !important;
        font-size: 11px !important;
        font-weight: 700 !important;
      }
      .desktop-table td {
        padding: 9px 12px !important;
        border-bottom: 1px solid #e2e8f0 !important;
        font-size: 12px !important;
      }
      .print-grid-2col {
        display: grid !important;
        grid-template-columns: 1.15fr 0.85fr !important;
        gap: 16px !important;
        align-items: start !important;
      }
      .print-signatures {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 24px !important;
        margin-top: 24px !important;
        padding-top: 16px !important;
        page-break-inside: avoid !important;
      }
    }

    /* PDF Rendering Mode (applied when html2pdf captures the paper) */
    .pdf-render {
      width: 794px !important;
      max-width: 794px !important;
      padding: 24px !important;
      background: white !important;
      box-shadow: none !important;
      border: none !important;
      border-radius: 0 !important;
    }
    .pdf-render .mobile-items {
      display: none !important;
    }
    .pdf-render .desktop-table {
      display: block !important;
      width: 100% !important;
    }
    .pdf-render .desktop-table table {
      width: 100% !important;
    }
    .pdf-render .desktop-table th {
      background-color: #1e293b !important;
      color: #ffffff !important;
    }
    .pdf-render .print-grid-2col {
      display: grid !important;
      grid-template-columns: 1.15fr 0.85fr !important;
      gap: 16px !important;
    }
    .pdf-render .print-signatures {
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
      gap: 24px !important;
      margin-top: 24px !important;
      page-break-inside: avoid !important;
    }
  </style>
</head>
<body class="bg-slate-100/90 min-h-screen py-4 sm:py-8 text-slate-800 antialiased">
  <!-- Top LINE Notice Banner -->
  <div id="lineTopBanner" class="max-w-4xl mx-auto px-3 sm:px-4 mb-2 hidden no-print">
    <div class="bg-amber-50 border border-amber-200/90 rounded-xl p-3 flex items-center justify-between gap-3 text-xs text-amber-900 shadow-xs">
      <div class="flex items-center gap-2">
        <span class="text-base">💡</span>
        <span>เปิดผ่าน LINE: หากต้องการบันทึก PDF หรือ Word แนะนำให้เปิดในเบราว์เซอร์เครื่องค่ะ</span>
      </div>
      <a href="/doc/quotation/${id}?openExternalBrowser=1" class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shrink-0 no-underline text-[11px] shadow-xs active:scale-95 transition">
        เปิดใน Chrome
      </a>
    </div>
  </div>

  <!-- Top Action Controls Bar -->
  <div class="max-w-4xl mx-auto px-3 sm:px-4 mb-2.5 sm:mb-4 no-print">
    <div class="bg-white/95 backdrop-blur-md p-2.5 sm:p-3 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-2.5">
      <div class="flex items-center justify-between w-full md:w-auto">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full ${isAccepted ? 'bg-emerald-500' : 'bg-amber-500'} ${isAccepted ? '' : 'animate-pulse'}"></span>
          <span class="text-xs sm:text-sm font-bold text-slate-800">
            ${isAccepted ? 'ใบเสนอราคา (อนุมัติแล้ว)' : 'ใบเสนอราคา (รออนุมัติ)'}
          </span>
        </div>
        <span class="text-[11px] font-mono font-bold text-blue-800 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200 sm:ml-2">
          ${docNo}
        </span>
      </div>

      <div class="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full md:w-auto justify-end">
        <!-- 1-Click LINE Share -->
        <a href="${lineShareUrl}" target="_blank" rel="noopener noreferrer" class="flex-1 sm:flex-none px-3 py-2 bg-[#06C755]/10 hover:bg-[#06C755]/20 text-[#05963F] font-bold text-xs rounded-xl border border-[#06C755]/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer no-underline active:scale-95 text-center shadow-xs">
          <svg class="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24"><path d="M24 10.304c0-5.369-5.383-9.738-12-9.738-6.616 0-12 4.369-12 9.738 0 4.814 4.269 8.846 10.019 9.572.391.084.922.258 1.057.592.121.303.079.778.039 1.085l-.171 1.027c-.053.303-.242 1.186 1.039.647 1.281-.54 6.911-4.069 9.428-6.967 1.739-1.907 2.589-3.844 2.589-5.956z"/></svg>
          <span>แชร์ LINE</span>
        </a>

        <!-- Copy Link -->
        <button onclick="handleCopyQuotationLink()" class="flex-1 sm:flex-none px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 text-center shadow-xs">
          <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
          <span id="copyLinkText">คัดลอกลิงก์</span>
        </button>

        <!-- Word -->
        <a href="/api/doc/${id}/download?format=docx" download="Quotation_${safeDocNo}.docx" onclick="handleDocDownload(event, 'docx')" class="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-xl border border-indigo-200/80 transition-all flex items-center justify-center gap-1.5 cursor-pointer no-underline active:scale-95 text-center shadow-xs">
          <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          <span>Word</span>
        </a>

        <!-- Excel -->
        <a href="/api/doc/${id}/download?format=xlsx" download="Quotation_${safeDocNo}.xlsx" onclick="handleDocDownload(event, 'xlsx')" class="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs rounded-xl border border-emerald-200/80 transition-all flex items-center justify-center gap-1.5 cursor-pointer no-underline active:scale-95 text-center shadow-xs">
          <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          <span>Excel</span>
        </a>

        <!-- พิมพ์/PDF -->
        <button onclick="handlePrintOrPdf()" class="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 text-center">
          <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
          <span>พิมพ์/PDF</span>
        </button>
      </div>
    </div>
  </div>

  <!-- Interactive Customer Approval Card (no-print) -->
  <div class="max-w-4xl mx-auto px-3 sm:px-4 mb-3 sm:mb-5 no-print">
    ${!isAccepted ? `
      <div id="customerApprovalSection" class="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 border border-emerald-500/30">
        <div class="space-y-1 text-center sm:text-left">
          <h4 class="font-bold text-sm sm:text-base flex items-center justify-center sm:justify-start gap-2">
            <span class="text-xl">🤝</span> ตกลงสั่งซื้อตามใบเสนอราคานี้?
          </h4>
          <p class="text-xs text-emerald-100 max-w-xl leading-relaxed">
            หากตรวจสอบรายการสินค้าและยอดเงินถูกต้องแล้ว สามารถกดยืนยันเพื่อสั่งซื้อได้ทันที ทางร้านค้าจะได้รับแจ้งเตือนเพื่อเตรียมจัดส่งหรือเริ่มงานให้ค่ะ
          </p>
        </div>
        <button id="btnAcceptQuote" onclick="handleAcceptQuotation()" class="w-full sm:w-auto px-6 py-3 bg-white hover:bg-emerald-50 text-emerald-800 font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all active:scale-95 shrink-0 flex items-center justify-center gap-2 cursor-pointer">
          <svg class="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
          <span>✅ ยืนยันตกลงสั่งซื้อ (Approve)</span>
        </button>
      </div>
    ` : `
      <div class="p-3.5 sm:p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 shadow-xs flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-xs">
            ✓
          </div>
          <div>
            <div class="font-bold text-xs sm:text-sm">ลูกค้ายืนยันตกลงสั่งซื้อตามใบเสนอราคาเรียบร้อยแล้ว</div>
            <div class="text-[11px] text-emerald-700 font-mono">
              สถานะ: อนุมัติแล้ว (Accepted) ${acceptedDateStr ? `• ${acceptedDateStr} น.` : ''}
            </div>
          </div>
        </div>
        <span class="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg shrink-0 shadow-xs">
          อนุมัติแล้ว
        </span>
      </div>
    `}
  </div>

  <!-- Document Paper Container -->
  <div class="paper-container max-w-4xl mx-auto bg-white p-5 sm:p-10 md:p-12 sm:rounded-2xl shadow-xl sm:border border-slate-200/90 space-y-5 sm:space-y-6">
    <!-- Header: Company Profile & Document Details -->
    <div class="flex flex-col sm:flex-row justify-between items-start border-b border-slate-200/90 pb-5 sm:pb-6 gap-4 sm:gap-6">
      <!-- Left: Logo & Company Address -->
      <div class="flex items-start gap-3.5 sm:gap-4 w-full sm:w-auto">
        ${companyLogo ? `
          <div class="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-xs shrink-0 flex items-center justify-center overflow-hidden">
            <img src="${companyLogo}" alt="${companyName}" class="max-w-full max-h-full object-contain rounded-xl" />
          </div>
        ` : `
          <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-800 text-white flex items-center justify-center font-extrabold text-2xl sm:text-3xl shadow-md shrink-0">
            ${initialLetter}
          </div>
        `}
        <div class="flex-1 min-w-0 space-y-1">
          <div class="flex items-center gap-2 flex-wrap">
            <h1 class="text-xl sm:text-2xl font-black text-slate-900 leading-tight tracking-tight">
              ${companyName}
            </h1>
            <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
              ผู้ให้บริการ
            </span>
          </div>

          <p class="text-xs sm:text-[13px] text-slate-600 leading-relaxed font-normal">
            ${companyAddress}
          </p>

          <div class="text-[11px] sm:text-xs text-slate-500 pt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            ${companyPhone && companyPhone !== '-' ? `
              <span class="inline-flex items-center gap-1 text-slate-700 font-medium">
                <svg class="w-3.5 h-3.5 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                <span>โทร: <strong class="font-mono text-slate-900 font-bold">${companyPhone}</strong></span>
              </span>
            ` : ''}

            ${companyTaxId && companyTaxId !== '-' ? `
              <span class="inline-flex items-center gap-1 text-slate-700 font-medium">
                <svg class="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                <span>เลขผู้เสียภาษี: <strong class="font-mono text-slate-800">${companyTaxId}</strong></span>
              </span>
            ` : ''}

            ${companyEmail && companyEmail !== '-' ? `
              <span class="inline-flex items-center gap-1 text-slate-700 font-medium">
                <svg class="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                <span>${companyEmail}</span>
              </span>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- Right: Document Meta Header -->
      <div class="w-full sm:w-auto text-left sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 flex flex-col sm:items-end">
        <div class="inline-block">
          <h2 class="text-2xl sm:text-3xl font-black text-blue-700 tracking-wider uppercase">
            ใบเสนอราคา
          </h2>
          <p class="text-[11px] sm:text-xs font-bold text-slate-400 tracking-[0.25em] uppercase text-right">
            QUOTATION
          </p>
        </div>

        <div class="mt-2.5 bg-slate-50 border border-slate-200/90 rounded-xl p-2.5 sm:p-3 text-xs text-slate-700 space-y-1.5 min-w-[210px] text-left">
          <div class="flex items-center justify-between gap-3">
            <span class="text-slate-500 text-[11px] font-semibold">เลขที่เอกสาร:</span>
            <span class="font-mono font-bold text-blue-900 bg-white px-2 py-0.5 rounded border border-blue-100 text-xs shadow-2xs">
              ${doc.doc_number || doc.doc_no}
            </span>
          </div>
          <div class="flex items-center justify-between gap-3">
            <span class="text-slate-500 text-[11px] font-semibold">วันที่ออกเอกสาร:</span>
            <span class="font-medium text-slate-800 text-[11px]">${issueDate}</span>
          </div>
          <div class="flex items-center justify-between gap-3 pt-1 border-t border-slate-200/70">
            <span class="text-slate-500 text-[11px] font-semibold">กำหนดยืนราคา:</span>
            <span class="font-semibold text-emerald-700 text-[11px]">30 วัน</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Customer Details Card -->
    <div class="p-4 sm:p-5 bg-gradient-to-br from-slate-50 via-white to-blue-50/20 rounded-2xl border border-slate-200 flex flex-col sm:flex-row justify-between gap-4">
      <div class="space-y-1.5 flex-1">
        <div class="flex items-center gap-2">
          <span class="text-[10px] sm:text-[11px] font-extrabold text-blue-700 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60">
            ลูกค้าผู้รับการเสนอราคา / Customer
          </span>
        </div>
        <p class="text-base sm:text-lg font-black text-slate-900 leading-snug">
          ${doc.customer_name || 'ลูกค้าผู้มีอุปการคุณ'}
        </p>
        <div class="text-xs text-slate-600 space-y-0.5 pt-0.5">
          ${doc.customer_phone ? `
            <p class="flex items-center gap-1.5">
              <span class="text-slate-400 font-medium">เบอร์โทรศัพท์:</span>
              <strong class="font-mono text-slate-900">${doc.customer_phone}</strong>
            </p>
          ` : ''}
          ${doc.customer_address ? `
            <p class="flex items-start gap-1.5">
              <span class="text-slate-400 font-medium shrink-0">ที่อยู่ / หน้างาน:</span>
              <span class="text-slate-700">${doc.customer_address}</span>
            </p>
          ` : ''}
        </div>
      </div>

      <div class="flex flex-col justify-between items-start sm:items-end gap-2 shrink-0">
        <span class="inline-flex items-center px-3 py-1 bg-amber-50 text-amber-800 text-xs font-bold rounded-full border border-amber-200/70 shadow-2xs">
          ● รออนุมัติการสั่งซื้อ (Pending)
        </span>
        <div class="text-[11px] text-slate-400 text-left sm:text-right">
          <span>ผู้ออกเอกสาร: <strong class="text-slate-600 font-medium">${companyName}</strong></span>
        </div>
      </div>
    </div>

    <!-- Mobile Items View (sm:hidden) -->
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

    <!-- Desktop & Print Table View -->
    <div class="desktop-table hidden sm:block rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
      <table class="w-full text-left text-sm border-collapse">
        <thead>
          <tr class="bg-slate-800 text-white text-xs font-bold uppercase tracking-wider">
            <th class="py-3 px-3 w-12 text-center text-slate-300 whitespace-nowrap">#</th>
            <th class="py-3 px-4 text-left whitespace-nowrap">รายการสินค้า</th>
            <th class="py-3 px-3 text-center w-20 text-slate-300 whitespace-nowrap">จำนวน</th>
            <th class="py-3 px-3 text-center w-20 text-slate-300 whitespace-nowrap">หน่วย</th>
            <th class="py-3 px-3 text-right w-28 whitespace-nowrap">ราคา/หน่วย</th>
            <th class="py-3 px-4 text-right w-36 whitespace-nowrap">จำนวนเงิน (บาท)</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">
          ${items.length > 0 ? items.map((item, idx) => {
            const rowTotal = Number((item.price || 0) * (item.qty || 1))
            return `
              <tr class="${idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'} hover:bg-blue-50/40 transition">
                <td class="py-3.5 px-3 text-center text-xs text-slate-400 font-medium">${idx + 1}</td>
                <td class="py-3.5 px-4 font-semibold text-slate-900">${item.name || '(ยังไม่ได้ระบุชื่อสินค้า)'}</td>
                <td class="py-3.5 px-3 text-center font-mono font-medium text-xs text-slate-800">${item.qty || 1}</td>
                <td class="py-3.5 px-3 text-center text-xs text-slate-500">${item.unit || 'ชิ้น'}</td>
                <td class="py-3.5 px-4 text-right font-mono text-xs text-slate-700">${Number(item.price || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td class="py-3.5 px-4 text-right font-mono font-bold text-slate-900">${rowTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            `
          }).join('') : `
            <tr>
              <td colspan="6" class="py-10 text-center text-slate-400 text-xs">ไม่มีรายการสินค้า</td>
            </tr>
          `}
        </tbody>
      </table>
    </div>

    <!-- Calculations & Payment Terms -->
    <div class="grid grid-cols-1 sm:grid-cols-2 print-grid-2col gap-4 sm:gap-6 pt-1">
      <div class="space-y-3">
        <!-- Bank / Payment Info -->
        ${(bankAccountNumber || promptpayId) ? `
          <div class="p-3.5 bg-gradient-to-br from-blue-50/80 to-indigo-50/40 rounded-xl border border-blue-200/70 text-xs text-slate-700 space-y-2 shadow-2xs">
            <div class="flex items-center gap-1.5 text-blue-900 font-bold text-xs border-b border-blue-200/60 pb-1.5">
              <svg class="w-4 h-4 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
              <span>ช่องทางการชำระเงิน (Payment Details)</span>
            </div>
            <div class="space-y-1 text-slate-800">
              ${bankName ? `<p class="flex items-center justify-between"><span class="text-slate-500">ธนาคาร:</span> <strong class="font-semibold text-slate-900">${bankName}</strong></p>` : ''}
              ${bankAccountNumber ? `
                <p class="flex items-center justify-between">
                  <span class="text-slate-500">เลขที่บัญชี:</span>
                  <strong class="font-mono font-bold text-blue-950 text-sm tracking-wide bg-white px-2 py-0.5 rounded border border-blue-100">${bankAccountNumber}</strong>
                </p>
                ${bankAccountName ? `<p class="flex items-center justify-between"><span class="text-slate-500">ชื่อบัญชี:</span> <span class="font-medium text-slate-700">${bankAccountName}</span></p>` : ''}
              ` : ''}
              ${promptpayId ? `
                <p class="flex items-center justify-between pt-1 border-t border-blue-100/80">
                  <span class="text-slate-500">PromptPay:</span>
                  <strong class="font-mono font-bold text-slate-900">${promptpayId}</strong>
                </p>
              ` : ''}
            </div>
          </div>
        ` : ''}

        <!-- Terms and Notes -->
        <div class="bg-slate-50 p-3 rounded-xl border border-slate-200/90 text-xs text-slate-600 space-y-1">
          <h4 class="font-bold text-slate-700 flex items-center gap-1 text-[11px] uppercase tracking-wide">
            <span>เงื่อนไขการเสนอราคาและข้อกำหนด:</span>
          </h4>
          <div class="text-[11px] leading-relaxed whitespace-pre-line text-slate-600 pl-1">
            ${doc.notes || '• กำหนดยืนราคาภายใน 30 วันนับจากวันที่ออกเอกสาร\n• กรุณาชำระเงินตามเงื่อนไขที่ระบุข้างต้น\n• สินค้าหรือบริการจะเริ่มดำเนินการหลังได้รับหลักฐานการชำระเงิน'}
          </div>
        </div>
      </div>

      <!-- Totals Table -->
      <div class="space-y-2">
        <div class="bg-slate-50 p-4 rounded-xl border border-slate-200/90 space-y-2 text-xs sm:text-sm shadow-2xs">
          <div class="flex justify-between text-slate-600">
            <span>ยอดรวมก่อนภาษี (Subtotal):</span>
            <span class="font-mono font-semibold text-slate-900">
              ${subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
            </span>
          </div>

          ${discount > 0 ? `
            <div class="flex justify-between text-rose-600 font-medium">
              <span>ส่วนลด (Discount):</span>
              <span class="font-mono font-semibold">
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

          <div class="pt-2 border-t border-slate-300">
            <div class="bg-blue-600 text-white rounded-xl p-3 flex justify-between items-center shadow-xs">
              <span class="text-xs sm:text-sm font-bold tracking-wide">ยอดสุทธิทั้งสิ้น (Grand Total):</span>
              <span class="font-mono text-lg sm:text-2xl font-black tracking-tight">
                ฿${total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div class="text-right text-xs font-bold text-slate-600 pt-1.5 pr-1">
              ( ${thaiBahtText} )
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Signature Blocks -->
    <div class="print-signatures grid grid-cols-2 gap-6 sm:gap-12 pt-6 sm:pt-8 border-t border-slate-200 text-center text-xs text-slate-600">
      <!-- Seller Signature -->
      <div class="p-4 bg-slate-50/60 rounded-xl border border-slate-200/80 space-y-3 flex flex-col justify-between">
        <p class="font-bold text-slate-800 text-xs">ในนาม ${companyName}</p>
        <div class="h-12 sm:h-14 flex items-center justify-center">
          ${companySignature ? `
            <img src="${companySignature}" alt="ลายเซ็นผู้มีอำนาจลงนาม" class="max-h-12 max-w-[160px] object-contain mx-auto" />
          ` : `
            <span class="text-slate-300 text-[10px] italic">[ ลงลายมือชื่อ / ประทับตรา ]</span>
          `}
        </div>
        <div class="w-40 sm:w-48 mx-auto border-b-2 border-slate-400"></div>
        <div class="space-y-0.5 text-[11px]">
          <p class="font-semibold text-slate-800">( ผู้มีอำนาจลงนาม / ผู้เสนอราคา )</p>
          <p class="text-slate-400 font-mono">วันที่: ...... / ...... / ..........</p>
        </div>
      </div>

      <!-- Customer Approval Signature -->
      <div class="p-4 bg-slate-50/60 rounded-xl border border-slate-200/80 space-y-3 flex flex-col justify-between">
        <p class="font-bold text-slate-800 text-xs">ผู้สั่งซื้อ / ผู้อนุมัติ (Customer Approval)</p>
        <div class="h-12 sm:h-14 flex flex-col items-center justify-center">
          ${isAccepted ? `
            <div class="flex items-center gap-1 text-emerald-600 font-bold text-xs">
              <span>✅</span>
              <span>อนุมัติสั่งซื้อเรียบร้อยแล้ว</span>
            </div>
            <div class="text-[10px] text-emerald-700 font-mono mt-0.5">
              ${acceptedDateStr ? `ยืนยันเมื่อ ${acceptedDateStr} น.` : 'ยืนยันสั่งซื้อออนไลน์'}
            </div>
          ` : `
            <span class="text-slate-300 text-[10px] italic">[ ตกลงสั่งซื้อตามรายการข้างต้น ]</span>
          `}
        </div>
        <div class="w-40 sm:w-48 mx-auto border-b-2 ${isAccepted ? 'border-emerald-500' : 'border-slate-400'}"></div>
        <div class="space-y-0.5 text-[11px]">
          <p class="font-semibold text-slate-800">( ${doc.customer_name || '...........................................'} )</p>
          <p class="text-slate-400 font-mono">${isAccepted && acceptedDateStr ? `วันที่อนุมัติ: ${acceptedDateStr} น.` : 'วันที่: ...... / ...... / ..........'}</p>
        </div>
      </div>
    </div>

    <!-- Quotation Bottom Guarantee / Footer -->
    <div class="text-center pt-2 border-t border-slate-100 text-[11px] text-slate-400">
      <p>ขอบคุณที่ให้ความไว้วางใจในบริการของเรา • Thank you for your business</p>
    </div>
  </div>

  <!-- Modal for PDF & Print Options (Solves Issue 3 everywhere) -->
  <div id="linePrintModal" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 hidden no-print">
    <div class="bg-white rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4">
      <div class="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
      </div>
      
      <div class="text-center space-y-1">
        <h3 class="text-base sm:text-lg font-bold text-slate-900">บันทึกหรือพิมพ์ใบเสนอราคา</h3>
        <p class="text-xs text-slate-500 leading-relaxed">
          เลือกวิธีที่สะดวกสำหรับอุปกรณ์ของคุณได้เลยค่ะ:
        </p>
      </div>

      <div class="space-y-2 pt-1">
        <!-- Direct External Browser Option for LINE users -->
        <div id="lineOpenExternalBox" class="hidden">
          <a href="/doc/quotation/${id}?openExternalBrowser=1&autoDownloadPdf=1" target="_blank" class="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer no-underline active:scale-95 text-center mb-1">
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
            <span>🌐 เปิดใน Chrome เพื่อบันทึก PDF ทันที</span>
          </a>
        </div>

        <!-- Success box with direct open link after PDF is generated -->
        <div id="pdfSuccessBox" class="hidden p-3 bg-emerald-50 border border-emerald-200/90 rounded-xl space-y-2 text-center">
          <div class="text-xs font-bold text-emerald-800 flex items-center justify-center gap-1.5">
            <span>✅ ดาวน์โหลดไฟล์ PDF สำเร็จแล้ว</span>
          </div>
          <a id="btnOpenPdfDirect" href="#" target="_blank" class="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 no-underline active:scale-95">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
            <span>👁️ คลิกที่นี่เพื่อเปิดดูไฟล์ PDF ทันที</span>
          </a>
        </div>

        <!-- Direct PDF Download (Works in Chrome, Safari, etc.) -->
        <button id="btnSavePdf" onclick="downloadPdfFile()" class="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 text-center">
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
          <span id="btnSavePdfText">📥 บันทึกเป็นไฟล์ PDF (A4) ลงเครื่องทันที</span>
        </button>

        <!-- Native Print for PC / Android system -->
        <button onclick="triggerPrint()" class="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 text-center">
          <svg class="w-4 h-4 text-slate-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
          <span>🖨️ สั่งพิมพ์ออกกระดาษ (Print)</span>
        </button>

        <!-- Word & Excel Options Grid -->
        <div class="grid grid-cols-2 gap-2 pt-1">
          <div class="flex flex-col gap-1">
            <a href="/api/doc/${id}/download?format=docx" download="Quotation_${safeDocNo}.docx" class="py-2.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1.5 no-underline active:scale-95 text-center border border-indigo-200/60 shadow-xs">
              <svg class="w-3.5 h-3.5 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              <span>โหลด Word</span>
            </a>
            <a href="https://docs.google.com/viewer?url=https%3A%2F%2Fapp.dealmee.app%2Fapi%2Fdoc%2F${id}%2Fdownload%3Fformat%3Ddocx" target="_blank" class="text-[11px] text-indigo-600 hover:text-indigo-800 text-center py-1 no-underline flex items-center justify-center gap-1 font-medium">
              <span>👁️ ดู Word ออนไลน์</span>
            </a>
          </div>

          <div class="flex flex-col gap-1">
            <a href="/api/doc/${id}/download?format=xlsx" download="Quotation_${safeDocNo}.xlsx" class="py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1.5 no-underline active:scale-95 text-center border border-emerald-200/60 shadow-xs">
              <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              <span>โหลด Excel</span>
            </a>
            <a href="https://docs.google.com/viewer?url=https%3A%2F%2Fapp.dealmee.app%2Fapi%2Fdoc%2F${id}%2Fdownload%3Fformat%3Dxlsx" target="_blank" class="text-[11px] text-emerald-600 hover:text-emerald-800 text-center py-1 no-underline flex items-center justify-center gap-1 font-medium">
              <span>👁️ ดู Excel ออนไลน์</span>
            </a>
          </div>
        </div>

        <!-- Quick LINE & Copy Share inside Modal -->
        <div class="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
          <a href="${lineShareUrl}" target="_blank" rel="noopener noreferrer" class="py-2.5 px-3 bg-[#06C755]/10 hover:bg-[#06C755]/20 text-[#05963F] font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 no-underline active:scale-95 text-center border border-[#06C755]/30">
            <svg class="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24"><path d="M24 10.304c0-5.369-5.383-9.738-12-9.738-6.616 0-12 4.369-12 9.738 0 4.814 4.269 8.846 10.019 9.572.391.084.922.258 1.057.592.121.303.079.778.039 1.085l-.171 1.027c-.053.303-.242 1.186 1.039.647 1.281-.54 6.911-4.069 9.428-6.967 1.739-1.907 2.589-3.844 2.589-5.956z"/></svg>
            <span>แชร์ LINE</span>
          </a>
          <button onclick="handleCopyQuotationLink()" class="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 text-center">
            <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
            <span id="modalCopyLinkText">คัดลอกลิงก์</span>
          </button>
        </div>
      </div>

      <div class="p-3 bg-amber-50 rounded-xl border border-amber-200/70 text-[11px] text-amber-800 space-y-1">
        <p class="font-bold flex items-center gap-1 text-amber-900">
          <span>💡 เคล็ดลับเพิ่มเติม:</span>
        </p>
        <p class="text-amber-700 leading-normal">
          หากเปิดผ่าน LINE แนะนำให้แตะ "เปิดใน Chrome" ด้านบนเพื่อดาวน์โหลด หรือแตะ "ดูออนไลน์" เพื่อเปิดดูได้ทันทีโดยไม่ต้องติดตั้งแอป Office ค่ะ
        </p>
      </div>

      <button onclick="closeLineModal()" class="w-full py-1.5 text-xs text-slate-400 hover:text-slate-600 font-medium cursor-pointer">
        ปิดหน้าต่างนี้
      </button>
    </div>
  </div>

  <script>
    function handleCopyQuotationLink() {
      const url = window.location.href.split('?')[0];
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
          showCopySuccess();
        }).catch(() => fallbackCopy(url));
      } else {
        fallbackCopy(url);
      }
    }

    function fallbackCopy(text) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showCopySuccess();
    }

    function showCopySuccess() {
      const el1 = document.getElementById('copyLinkText');
      const el2 = document.getElementById('modalCopyLinkText');
      [el1, el2].forEach(el => {
        if (el) {
          const old = el.innerText;
          el.innerText = '✓ คัดลอกแล้ว!';
          setTimeout(() => { el.innerText = old; }, 2000);
        }
      });
    }

    async function handleAcceptQuotation() {
      if (!confirm('ยืนยันตกลงสั่งซื้อตามรายการและยอดเงินในใบเสนอราคานี้ใช่หรือไม่?')) return;
      const btn = document.getElementById('btnAcceptQuote');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⏳ กำลังบันทึกการยืนยัน...';
      }
      try {
        const res = await fetch('/api/doc/${id}/accept', { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.success) {
          alert('🎉 ขอบพระคุณค่ะ! ยืนยันตกลงสั่งซื้อตามใบเสนอราคาเรียบร้อยแล้ว ทางร้านค้าจะดำเนินการต่อไปให้ทันทีค่ะ');
          window.location.reload();
        } else {
          alert(data.error || 'เกิดข้อผิดพลาดในการยืนยัน กรุณาลองใหม่อีกครั้งค่ะ');
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = '✅ ยืนยันตกลงสั่งซื้อ (Approve)';
          }
        }
      } catch (err) {
        alert('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้งค่ะ');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '✅ ยืนยันตกลงสั่งซื้อ (Approve)';
        }
      }
    }
    function isLineApp() {
      return navigator.userAgent.toLowerCase().includes('line');
    }

    function handleDocDownload(event, format) {
      if (isLineApp()) {
        event.preventDefault();
        const box = document.getElementById('lineOpenExternalBox');
        if (box) box.classList.remove('hidden');
        document.getElementById('linePrintModal').classList.remove('hidden');
        return;
      }

      const target = event.currentTarget;
      if (target && !target.dataset.loading) {
        target.dataset.loading = 'true';
        const originalText = target.innerHTML;
        target.innerHTML = '⏳ กำลังโหลด...';
        setTimeout(() => {
          target.innerHTML = originalText;
          delete target.dataset.loading;
        }, 3000);
      }
    }

    function handlePrintOrPdf() {
      if (isLineApp()) {
        const box = document.getElementById('lineOpenExternalBox');
        if (box) box.classList.remove('hidden');
      }
      document.getElementById('linePrintModal').classList.remove('hidden');
    }

    function closeLineModal() {
      document.getElementById('linePrintModal').classList.add('hidden');
    }

    function triggerPrint() {
      try {
        closeLineModal();
        setTimeout(() => {
          window.print();
        }, 150);
      } catch (err) {
        alert('อุปกรณ์ไม่รองรับการสั่งพิมพ์โดยตรง กรุณากดปุ่ม "บันทึกเป็นไฟล์ PDF ลงเครื่อง" ด้านบนแทนค่ะ');
      }
    }

    async function downloadPdfFile() {
      if (typeof html2pdf === 'undefined') {
        alert('ระบบกำลังโหลดตัวแปลง PDF กรุณารอสักครู่แล้วกดใหม่อีกครั้งค่ะ');
        return;
      }

      const btn = document.getElementById('btnSavePdf');
      const btnText = document.getElementById('btnSavePdfText');
      const oldText = btnText ? btnText.innerText : '';
      if (btnText) btnText.innerText = '⏳ กำลังสร้างไฟล์ PDF A4...';
      if (btn) btn.disabled = true;

      const paper = document.querySelector('.paper-container');
      const mobileItems = document.querySelector('.mobile-items');
      const desktopTable = document.querySelector('.desktop-table');

      // Add pdf-render class to format exact A4 desktop layout
      if (paper) paper.classList.add('pdf-render');
      if (mobileItems) mobileItems.style.display = 'none';
      if (desktopTable) desktopTable.style.display = 'block';

      try {
        // ASCII filename ensures Chrome & Windows preserve .pdf extension
        const pdfFilename = 'Quotation_' + '${safeDocNo}' + '.pdf';
        const opt = {
          margin: [10, 10, 10, 10],
          filename: pdfFilename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { 
            scale: 2, 
            useCORS: true, 
            allowTaint: true, 
            logging: false, 
            scrollY: 0,
            windowWidth: 1024
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        const pdfBlob = await html2pdf().set(opt).from(paper).outputPdf('blob');
        const pdfFile = new Blob([pdfBlob], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(pdfFile);

        // 1. Download as Quotation_XXX.pdf
        const downloadLink = document.createElement('a');
        downloadLink.href = blobUrl;
        downloadLink.download = pdfFilename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        // 2. Show instant view link in modal
        const successBox = document.getElementById('pdfSuccessBox');
        const openLink = document.getElementById('btnOpenPdfDirect');
        if (successBox && openLink) {
          openLink.href = blobUrl;
          successBox.classList.remove('hidden');
        }
      } catch (err) {
        console.error('PDF error:', err);
        alert('เกิดข้อผิดพลาดในการสร้าง PDF กรุณาลองใช้ฟังก์ชันพิมพ์ หรือดาวน์โหลดเป็นไฟล์ Word แทนค่ะ');
      } finally {
        if (paper) paper.classList.remove('pdf-render');
        if (mobileItems) mobileItems.style.display = '';
        if (desktopTable) desktopTable.style.display = '';
        if (btnText) btnText.innerText = oldText;
        if (btn) btn.disabled = false;
      }
    }

    // Auto-detect LINE & handle auto-actions
    window.addEventListener('DOMContentLoaded', () => {
      if (isLineApp()) {
        const banner = document.getElementById('lineTopBanner');
        if (banner) banner.classList.remove('hidden');
        const box = document.getElementById('lineOpenExternalBox');
        if (box) box.classList.remove('hidden');
      }

      const params = new URLSearchParams(window.location.search);
      if (params.get('autoDownloadPdf') === '1') {
        setTimeout(() => {
          downloadPdfFile();
        }, 800);
      }
    });
  </script>
</body>
</html>`

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (err: any) {
    console.error('[Quotation Route Exception]:', err)
    return new NextResponse('เกิดข้อผิดพลาดในการโหลดใบเสนอราคา', { status: 500 })
  }
}
