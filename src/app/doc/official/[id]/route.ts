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

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject} - ${docNumber}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Sarabun', sans-serif; }
    @media print {
      .no-print { display: none !important; }
      body { background: white; margin: 0; padding: 0; }
      .page-sheet { box-shadow: none !important; margin: 0 !important; max-width: 100% !important; padding: 2.5cm 2cm 2cm 3cm !important; }
    }
  </style>
</head>
<body class="bg-gray-100 min-h-screen py-8 text-gray-900">
  <!-- Print Controls -->
  <div class="max-w-4xl mx-auto px-4 mb-4 flex justify-between items-center no-print">
    <div class="flex items-center space-x-2">
      <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
        หนังสือราชการภายนอก (ตามระเบียบงานสารบรรณ)
      </span>
      <span class="text-xs text-gray-500 font-mono">${docNumber}</span>
    </div>
    <div class="flex space-x-2">
      <button onclick="window.print()" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm transition flex items-center gap-1.5 cursor-pointer">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        พิมพ์ / บันทึกเป็น PDF
      </button>
    </div>
  </div>

  <!-- A4 Document Sheet -->
  <div class="page-sheet max-w-4xl mx-auto bg-white p-12 sm:p-16 shadow-lg rounded-sm text-[16px] leading-[1.8] min-h-[1100px]">
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
    <div class="text-center mb-6 pl-20">
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
      ${bodyFacts ? `<p class="indent-12">${bodyFacts}</p>` : ''}
      ${bodyConsiderations ? `<p class="indent-12">${bodyConsiderations}</p>` : ''}
      ${bodyResolution ? `<p class="indent-12">${bodyResolution}</p>` : ''}
    </div>

    <!-- Signoff (Closing) -->
    <div class="w-1/2 ml-auto text-center space-y-12 mb-16">
      <p>ขอแสดงความนับถือ</p>
      <div class="pt-8">
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
