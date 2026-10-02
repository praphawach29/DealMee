import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createAdminClient()

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single()

    if (docError || !doc) {
      return new NextResponse('ไม่พบเอกสารราชการที่ต้องการ', { status: 404 })
    }

    let letterData: any = {}
    try {
      letterData = JSON.parse(doc.notes || '{}')
    } catch {
      letterData = {
        subject: doc.items?.[0]?.name || 'หนังสือราชการ',
        recipient: doc.customer_name || '',
        body_facts: doc.notes || '',
      }
    }

    const { data: shop } = await supabase
      .from('shops')
      .select('name, company_name, company_address, company_phone, company_email, company_logo_url')
      .eq('id', doc.shop_id)
      .single()

    const department = letterData.department || shop?.company_name || shop?.name || 'หน่วยงาน'
    const docNumber = doc.doc_number || letterData.doc_number || 'ที่ กท ......... / .........'
    const dateStr = letterData.date_str || new Date(doc.created_at).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    const subject = letterData.subject || '-'
    const recipient = letterData.recipient || doc.customer_name || '-'
    const referenceTo = letterData.reference_to || ''
    const enclosures = letterData.enclosures || ''
    const bodyFacts = letterData.body_facts || ''
    const bodyConsiderations = letterData.body_considerations || ''
    const bodyResolution = letterData.body_resolution || ''
    const signatoryName = letterData.signatory_name || '( .................................................... )'
    const signatoryPosition = letterData.signatory_position || 'ผู้อำนวยการ / หัวหน้าหน่วยงาน'
    const contactInfo = letterData.contact_info || `${shop?.company_phone || ''} ${shop?.company_email || ''}`.trim()
    const safeDocNo = String(docNumber || 'official').replace(/[^a-zA-Z0-9_-]/g, '_')

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject} - ${docNumber}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
  <style>
    body { font-family: 'Sarabun', sans-serif; }
    @media print {
      .no-print { display: none !important; }
      body { background: white; margin: 0; padding: 0; }
      .page-sheet { box-shadow: none !important; margin: 0 !important; max-width: 100% !important; padding: 2.5cm 2cm 2cm 3cm !important; }
    }
  </style>
</head>
<body class="bg-slate-100 min-h-screen py-4 sm:py-8 text-gray-900 antialiased">
  <!-- Print Controls Bar -->
  <div class="max-w-4xl mx-auto px-3 sm:px-4 mb-3 sm:mb-4 no-print">
    <div class="bg-white/95 backdrop-blur-md p-2.5 sm:p-3 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2.5">
      <div class="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-start">
        <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
          หนังสือราชการภายนอก (งานสารบรรณ)
        </span>
        <span class="text-xs text-gray-500 font-mono">${docNumber}</span>
      </div>
      <div class="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center">
        <a href="/api/doc/${id}/download?format=docx&openExternalBrowser=1" download class="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs sm:text-sm font-semibold border border-indigo-200/80 transition flex items-center justify-center gap-1.5 cursor-pointer no-underline active:scale-95 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Word (.docx)
        </a>
        <button onclick="handlePrintOrPdf()" class="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          พิมพ์ / PDF
        </button>
      </div>
    </div>
  </div>

  <!-- A4 Document Sheet -->
  <div class="page-sheet max-w-4xl mx-auto bg-white p-6 sm:p-16 shadow-lg rounded-sm text-[15px] sm:text-[16px] leading-[1.8] min-h-[1100px]">
    <!-- Garuda Emblem (ตราครุฑ) -->
    <div class="text-center mb-6">
      <svg class="mx-auto w-24 h-24 text-red-700 fill-current" viewBox="0 0 100 100">
        <!-- Stylized Garuda Emblem Icon -->
        <circle cx="50" cy="50" r="46" fill="#8B0000" />
        <path d="M50 15 L58 35 L78 38 L62 52 L68 72 L50 60 L32 72 L38 52 L22 38 L42 35 Z" fill="#DAA520" />
      </svg>
      <div class="text-xs font-semibold text-gray-400 mt-1 uppercase tracking-widest">ครุฑตราตั้ง</div>
    </div>

    <!-- Header info: Document Number & Department -->
    <div class="grid grid-cols-2 gap-4 mb-6">
      <div>
        <p class="font-normal"><span class="font-bold">ที่</span> ${docNumber}</p>
      </div>
      <div class="text-right">
        <p class="font-bold">${department}</p>
        <p class="text-sm text-gray-700">${shop?.company_address || ''}</p>
      </div>
    </div>

    <!-- Date (Centered-ish or Right-aligned as per saraban) -->
    <div class="text-center mb-6 pl-10 sm:pl-20">
      <p class="font-normal">${dateStr}</p>
    </div>

    <!-- Subject, Recipient, References -->
    <div class="space-y-2 mb-6">
      <p><span class="font-bold">เรื่อง</span>&nbsp;&nbsp;&nbsp;&nbsp;${subject}</p>
      <p><span class="font-bold">เรียน</span>&nbsp;&nbsp;&nbsp;&nbsp;${recipient}</p>
      ${referenceTo ? `<p><span class="font-bold">อ้างถึง</span>&nbsp;&nbsp;&nbsp;${referenceTo}</p>` : ''}
      ${enclosures ? `<p><span class="font-bold">สิ่งที่ส่งมาด้วย</span>&nbsp;&nbsp;${enclosures}</p>` : ''}
    </div>

    <!-- Body Paragraphs (Indented) -->
    <div class="space-y-4 mb-12 text-justify">
      ${bodyFacts ? `<p class="indent-8 sm:indent-12">${bodyFacts}</p>` : ''}
      ${bodyConsiderations ? `<p class="indent-8 sm:indent-12">${bodyConsiderations}</p>` : ''}
      ${bodyResolution ? `<p class="indent-8 sm:indent-12">${bodyResolution}</p>` : ''}
    </div>

    <!-- Signoff (Closing) -->
    <div class="w-full sm:w-1/2 ml-auto text-center space-y-10 sm:space-y-12 mb-16">
      <p>ขอแสดงความนับถือ</p>
      <div class="pt-6 sm:pt-8">
        <p class="font-bold">${signatoryName}</p>
        <p class="text-sm text-gray-600">${signatoryPosition}</p>
      </div>
    </div>

    <!-- Department Contact Footer -->
    <div class="border-t border-gray-200 pt-4 text-xs text-gray-500 space-y-1">
      <p class="font-medium text-gray-700">${department}</p>
      ${contactInfo ? `<p>โทรศัพท์/ติดต่อ: ${contactInfo}</p>` : ''}
    </div>
  </div>

  <!-- Modal for PDF & Print Options -->
  <div id="linePrintModal" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 hidden no-print">
    <div class="bg-white rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4">
      <div class="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
      </div>
      
      <div class="text-center space-y-1">
        <h3 class="text-base sm:text-lg font-bold text-slate-900">บันทึกหรือพิมพ์หนังสือราชการ</h3>
        <p class="text-xs text-slate-500 leading-relaxed">
          เลือกวิธีที่สะดวกสำหรับอุปกรณ์ของคุณได้เลยค่ะ:
        </p>
      </div>

      <div class="space-y-2 pt-1">
        <!-- Direct External Browser Option for LINE users -->
        <div id="lineOpenExternalBox" class="hidden">
          <a href="/doc/official/${id}?openExternalBrowser=1&autoDownloadPdf=1" target="_blank" class="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer no-underline active:scale-95 text-center mb-1">
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
            <span>🌐 เปิดใน Chrome เพื่อบันทึก PDF ทันที</span>
          </a>
        </div>

        <button id="btnSavePdf" onclick="downloadPdfFile()" class="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 text-center">
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
          <span id="btnSavePdfText">📥 บันทึกเป็นไฟล์ PDF (A4) ลงเครื่องทันที</span>
        </button>

        <button onclick="triggerPrint()" class="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 text-center">
          <svg class="w-4 h-4 text-slate-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
          <span>🖨️ สั่งพิมพ์ออกกระดาษ (Print)</span>
        </button>

        <a href="/api/doc/${id}/download?format=docx&openExternalBrowser=1" download class="w-full py-2 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer no-underline active:scale-95 text-center">
          <svg class="w-4 h-4 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          <span>ดาวน์โหลดไฟล์ Word (.docx)</span>
        </a>
      </div>

      <div class="p-3 bg-amber-50 rounded-xl border border-amber-200/70 text-[11px] text-amber-800 space-y-1">
        <p class="font-bold flex items-center gap-1 text-amber-900">
          <span>💡 เคล็ดลับเพิ่มเติม:</span>
        </p>
        <p class="text-amber-700 leading-normal">
          บน Android Chrome สามารถแตะจุด 3 จุด (⋮) มุมขวาบน &gt; <b>แชร์ (Share)</b> &gt; <b>พิมพ์ (Print)</b> เพื่อบันทึกเป็น PDF ผ่านระบบ Android ได้เช่นกันค่ะ
        </p>
      </div>

      <button onclick="closeLineModal()" class="w-full py-1.5 text-xs text-slate-400 hover:text-slate-600 font-medium cursor-pointer">
        ปิดหน้าต่างนี้
      </button>
    </div>
  </div>

  <script>
    function isLineApp() {
      return navigator.userAgent.toLowerCase().includes('line');
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
        window.print();
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

      const sheet = document.querySelector('.page-sheet');
      const origWidth = sheet ? sheet.style.width : '';
      const origMaxWidth = sheet ? sheet.style.maxWidth : '';
      if (sheet) {
        sheet.style.width = '794px';
        sheet.style.maxWidth = '794px';
      }

      try {
        const opt = {
          margin: [8, 8, 8, 8],
          filename: 'หนังสือราชการ_' + '${safeDocNo}' + '.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, allowTaint: true, logging: false, scrollY: 0 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        await html2pdf().set(opt).from(sheet).save();
        closeLineModal();
      } catch (err) {
        console.error('PDF error:', err);
        alert('เกิดข้อผิดพลาดในการสร้าง PDF กรุณาลองใช้ฟังก์ชันพิมพ์ หรือดาวน์โหลดเป็นไฟล์ Word แทนค่ะ');
      } finally {
        if (sheet) {
          sheet.style.width = origWidth;
          sheet.style.maxWidth = origMaxWidth;
        }
        if (btnText) btnText.innerText = oldText;
        if (btn) btn.disabled = false;
      }
    }

    // Auto-detect LINE & handle auto-actions
    window.addEventListener('DOMContentLoaded', () => {
      if (isLineApp()) {
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
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (err: any) {
    console.error('[doc/official error]:', err)
    return new NextResponse('เกิดข้อผิดพลาดในการแสดงเอกสาร', { status: 500 })
  }
}
