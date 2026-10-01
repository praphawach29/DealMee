import path from 'path'
import fs from 'fs'
import os from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/**
 * Resolves the path to the officecli executable.
 * Prioritizes the pre-downloaded vendor binary inside node_modules/@officecli/officecli/vendor.
 */
function getOfficeCliBinary(): string {
  const isWin = process.platform === 'win32'
  const binaryName = isWin ? 'officecli.exe' : 'officecli'
  const vendorPath = path.join(process.cwd(), 'node_modules', '@officecli', 'officecli', 'vendor', binaryName)

  if (fs.existsSync(vendorPath)) {
    return vendorPath
  }

  const shimPath = path.join(process.cwd(), 'node_modules', '.bin', isWin ? 'officecli.cmd' : 'officecli')
  if (fs.existsSync(shimPath)) {
    return shimPath
  }

  return 'officecli'
}

/**
 * Clean helper to close/release an office document handle so it doesn't get EBUSY on Windows.
 */
async function closeOfficeDoc(bin: string, filePath: string) {
  try {
    await execFileAsync(bin, ['close', filePath])
  } catch {
    // Ignore close errors if document was already flushed or not resident
  }
}

export interface QuotationDocData {
  id?: string
  doc_number: string
  created_at?: string
  customer_name?: string
  customer_phone?: string
  customer_address?: string
  items: Array<{ name: string; price: number; qty: number; unit?: string; total?: number }>
  subtotal: number
  discount_amount?: number
  vat_amount?: number
  total_amount: number
  notes?: string
}

export interface ShopProfileData {
  name?: string
  company_name?: string
  company_tax_id?: string
  company_address?: string
  company_phone?: string
  company_email?: string
  bank_name?: string
  bank_account_number?: string
  bank_account_name?: string
  promptpay_id?: string
}

/**
 * Generates a Word (.docx) Quotation using OfficeCLI
 */
export async function generateQuotationDocx(
  doc: QuotationDocData,
  shop: ShopProfileData = {}
): Promise<Buffer> {
  const bin = getOfficeCliBinary()
  const randomSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`
  const tempDocPath = path.join(os.tmpdir(), `quotation_${randomSuffix}.docx`)
  const tempJsonPath = path.join(os.tmpdir(), `quotation_batch_${randomSuffix}.json`)

  try {
    const companyName = shop.company_name || shop.name || 'บริษัท / ร้านค้า'
    const taxId = shop.company_tax_id || '-'
    const address = shop.company_address || '-'
    const phone = shop.company_phone || '-'
    const email = shop.company_email || '-'

    const issueDate = new Date(doc.created_at || Date.now()).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const customerName = doc.customer_name || 'ลูกค้าผู้มีอุปการคุณ'
    const customerPhone = doc.customer_phone || '-'
    const customerAddress = doc.customer_address || '-'

    // Build items table data in CSV format: H1,H2;R1C1,R1C2...
    // Header
    const tableHeader = ['ลำดับ', 'รายการสินค้า / บริการ', 'จำนวน', 'ราคาต่อหน่วย (บาท)', 'จำนวนเงิน (บาท)']
    const tableRows = [tableHeader.join(',')]

    const items = Array.isArray(doc.items) && doc.items.length > 0 ? doc.items : []
    items.forEach((item, idx) => {
      const rowNum = idx + 1
      const safeName = `"${String(item.name || 'สินค้า').replace(/"/g, '""').replace(/;/g, ' ')}"`
      const qty = Number(item.qty || 1)
      const price = Number(item.price || 0)
      const lineTotal = price * qty
      tableRows.push(`${rowNum},${safeName},${qty},${price.toLocaleString('th-TH', { minimumFractionDigits: 2 })},${lineTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`)
    })

    const tableDataString = tableRows.join(';')

    const subtotal = Number(doc.subtotal || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })
    const discount = Number(doc.discount_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })
    const vat = Number(doc.vat_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })
    const total = Number(doc.total_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })

    let paymentInfo = ''
    if (shop.bank_name || shop.bank_account_number) {
      paymentInfo += `โอนเงินผ่านบัญชี: ธนาคาร${shop.bank_name || ''} เลขที่ ${shop.bank_account_number || ''} ชื่อบัญชี ${shop.bank_account_name || companyName} `
    }
    if (shop.promptpay_id) {
      paymentInfo += `| พร้อมเพย์: ${shop.promptpay_id}`
    }

    const batchCommands: any[] = [
      {
        command: 'add',
        parent: '/body',
        type: 'paragraph',
        props: {
          text: 'ใบเสนอราคา (QUOTATION)',
          bold: 'true',
          fontSize: '20pt',
          align: 'center',
          color: '1E3A8A',
        },
      },
      {
        command: 'add',
        parent: '/body',
        type: 'paragraph',
        props: {
          text: `${companyName}\nที่อยู่: ${address}\nเลขประจำตัวผู้เสียภาษี: ${taxId} | โทร: ${phone} | อีเมล: ${email}`,
          fontSize: '10pt',
          color: '334155',
        },
      },
      {
        command: 'add',
        parent: '/body',
        type: 'paragraph',
        props: {
          text: `------------------------------------------------------------------------------------------------------------------------`,
          color: 'CBD5E1',
        },
      },
      {
        command: 'add',
        parent: '/body',
        type: 'paragraph',
        props: {
          text: `ข้อมูลลูกค้า:\nชื่อผู้ติดต่อ/บริษัท: ${customerName}\nเบอร์โทรศัพท์: ${customerPhone}\nที่อยู่: ${customerAddress}`,
          fontSize: '11pt',
          bold: 'false',
        },
      },
      {
        command: 'add',
        parent: '/body',
        type: 'paragraph',
        props: {
          text: `เลขที่เอกสาร: ${doc.doc_number}\nวันที่ออกเอกสาร: ${issueDate}\nกำหนดยืนราคา: 30 วัน`,
          fontSize: '11pt',
          color: '1E293B',
        },
      },
      {
        command: 'add',
        parent: '/body',
        type: 'table',
        props: {
          style: 'medium1',
          width: '16.5cm',
          data: tableDataString,
        },
      },
      {
        command: 'add',
        parent: '/body',
        type: 'paragraph',
        props: {
          text: `ยอดรวมก่อนภาษี (Subtotal): ${subtotal} บาท` +
            (Number(doc.discount_amount || 0) > 0 ? `\nส่วนลด (Discount): -${discount} บาท` : '') +
            (Number(doc.vat_amount || 0) > 0 ? `\nภาษีมูลค่าเพิ่ม 7% (VAT): ${vat} บาท` : '') +
            `\nยอดสุทธิทั้งสิ้น (Total Amount): ${total} บาท`,
          bold: 'true',
          fontSize: '12pt',
          align: 'right',
          color: '1E293B',
        },
      },
    ]

    if (doc.notes) {
      batchCommands.push({
        command: 'add',
        parent: '/body',
        type: 'paragraph',
        props: {
          text: `หมายเหตุเพิ่มเติม:\n${doc.notes}`,
          fontSize: '10pt',
          color: '64748B',
        },
      })
    }

    if (paymentInfo) {
      batchCommands.push({
        command: 'add',
        parent: '/body',
        type: 'paragraph',
        props: {
          text: `ข้อมูลการชำระเงิน:\n${paymentInfo}`,
          fontSize: '10pt',
          color: '2563EB',
        },
      })
    }

    batchCommands.push({
      command: 'add',
      parent: '/body',
      type: 'paragraph',
      props: {
        text: `\n\n\nลงชื่อ .................................................... ผู้เสนอราคา              ลงชื่อ .................................................... ผู้สั่งซื้อ / อนุมัติ\n     (                                                    )                   (                                                    )\n       วันที่ ...... / ...... / ..........                                       วันที่ ...... / ...... / ..........`,
        fontSize: '10pt',
        align: 'center',
        color: '475569',
      },
    })

    // Write batch commands
    fs.writeFileSync(tempJsonPath, JSON.stringify(batchCommands), 'utf8')

    // 1. Create blank docx
    await execFileAsync(bin, ['create', tempDocPath, '--force'])
    // 2. Run batch operations
    await execFileAsync(bin, ['batch', tempDocPath, '--input', tempJsonPath])
    // 3. Flush & close
    await closeOfficeDoc(bin, tempDocPath)

    // 4. Read back
    const fileBuffer = fs.readFileSync(tempDocPath)
    return fileBuffer
  } finally {
    try {
      if (fs.existsSync(tempDocPath)) fs.unlinkSync(tempDocPath)
      if (fs.existsSync(tempJsonPath)) fs.unlinkSync(tempJsonPath)
    } catch {
      // Ignore cleanup error
    }
  }
}

/**
 * Generates an Excel (.xlsx) Quotation using OfficeCLI
 */
export async function generateQuotationXlsx(
  doc: QuotationDocData,
  shop: ShopProfileData = {}
): Promise<Buffer> {
  const bin = getOfficeCliBinary()
  const randomSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`
  const tempXlsxPath = path.join(os.tmpdir(), `quotation_${randomSuffix}.xlsx`)
  const tempCsvPath = path.join(os.tmpdir(), `quotation_${randomSuffix}.csv`)

  try {
    const companyName = shop.company_name || shop.name || 'บริษัท / ร้านค้า'
    const customerName = doc.customer_name || 'ลูกค้าผู้มีอุปการคุณ'

    // Build CSV with BOM for Thai encoding
    const csvLines: string[] = []
    csvLines.push(`ใบเสนอราคา: ${doc.doc_number},ร้านค้า: ${companyName},ลูกค้า: ${customerName}`)
    csvLines.push('ลำดับ,รายการสินค้า / บริการ,จำนวน,ราคาต่อหน่วย,จำนวนเงิน')

    const items = Array.isArray(doc.items) && doc.items.length > 0 ? doc.items : []
    items.forEach((item, idx) => {
      const row = idx + 1
      const safeName = `"${String(item.name || 'สินค้า').replace(/"/g, '""')}"`
      const qty = Number(item.qty || 1)
      const price = Number(item.price || 0)
      const total = qty * price
      csvLines.push(`${row},${safeName},${qty},${price},${total}`)
    })

    const csvContent = '\uFEFF' + csvLines.join('\n')
    fs.writeFileSync(tempCsvPath, csvContent, 'utf8')

    // Create blank xlsx
    await execFileAsync(bin, ['create', tempXlsxPath, '--force'])
    // Import CSV to sheet 1
    await execFileAsync(bin, ['import', tempXlsxPath, '/sheet[1]', tempCsvPath])
    // Close to flush
    await closeOfficeDoc(bin, tempXlsxPath)

    const fileBuffer = fs.readFileSync(tempXlsxPath)
    return fileBuffer
  } finally {
    try {
      if (fs.existsSync(tempXlsxPath)) fs.unlinkSync(tempXlsxPath)
      if (fs.existsSync(tempCsvPath)) fs.unlinkSync(tempCsvPath)
    } catch {
      // Ignore cleanup error
    }
  }
}

export interface OfficialLetterDocData {
  id?: string
  doc_number?: string
  department?: string
  date_str?: string
  subject?: string
  recipient?: string
  reference_to?: string
  enclosures?: string
  body_facts?: string
  body_considerations?: string
  body_resolution?: string
  signatory_name?: string
  signatory_position?: string
  contact_info?: string
  notes?: string
  customer_name?: string
  created_at?: string
}

/**
 * Generates an Official Thai Government Letter (.docx) using OfficeCLI
 * Formatted in strict compliance with the Thai Prime Minister's Office Correspondence Regulations
 */
export async function generateOfficialLetterDocx(
  rawDoc: any,
  shop: ShopProfileData = {}
): Promise<Buffer> {
  const bin = getOfficeCliBinary()
  const randomSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`
  const tempDocPath = path.join(os.tmpdir(), `official_${randomSuffix}.docx`)
  const tempJsonPath = path.join(os.tmpdir(), `official_batch_${randomSuffix}.json`)

  try {
    let letter: OfficialLetterDocData = {}
    if (typeof rawDoc.notes === 'string' && rawDoc.notes.trim().startsWith('{')) {
      try {
        letter = JSON.parse(rawDoc.notes)
      } catch {
        letter = {}
      }
    } else {
      letter = rawDoc
    }

    const docNumber = rawDoc.doc_number || letter.doc_number || 'ที่ กท ......... / .........'
    const department = letter.department || shop.company_name || shop.name || 'หน่วยงาน'
    const dateStr = letter.date_str || new Date(rawDoc.created_at || Date.now()).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const subject = letter.subject || rawDoc.items?.[0]?.name || 'หนังสือราชการ'
    const recipient = letter.recipient || rawDoc.customer_name || 'ผู้รับหนังสือ'
    const referenceTo = letter.reference_to || ''
    const enclosures = letter.enclosures || ''
    const bodyFacts = letter.body_facts || ''
    const bodyConsiderations = letter.body_considerations || ''
    const bodyResolution = letter.body_resolution || ''
    const signatoryName = letter.signatory_name || '( .................................................... )'
    const signatoryPosition = letter.signatory_position || 'ผู้อำนวยการ / หัวหน้าหน่วยงาน'
    const contactInfo = letter.contact_info || `${shop.company_phone || ''} ${shop.company_email || ''}`.trim()

    const batchCommands: any[] = [
      {
        command: 'add',
        parent: '/body',
        type: 'paragraph',
        props: {
          text: 'ตราครุฑ\n(หนังสือราชการภายนอก)',
          bold: 'true',
          fontSize: '14pt',
          align: 'center',
          color: '991B1B',
        },
      },
      {
        command: 'add',
        parent: '/body',
        type: 'paragraph',
        props: {
          text: `เลขที่: ${docNumber}                                                ${department}\n                                                                     วันที่: ${dateStr}`,
          fontSize: '16pt',
          color: '000000',
        },
      },
      {
        command: 'add',
        parent: '/body',
        type: 'paragraph',
        props: {
          text: `เรื่อง   ${subject}\nเรียน   ${recipient}` +
            (referenceTo ? `\nอ้างถึง  ${referenceTo}` : '') +
            (enclosures ? `\nสิ่งที่ส่งมาด้วย  ${enclosures}` : ''),
          fontSize: '16pt',
          bold: 'false',
          color: '000000',
        },
      },
    ]

    // ภาคเหตุ (Body Facts)
    if (bodyFacts) {
      batchCommands.push({
        command: 'add',
        parent: '/body',
        type: 'paragraph',
        props: {
          text: `        ${bodyFacts}`,
          fontSize: '16pt',
          color: '000000',
        },
      })
    }

    // ภาคประสงค์ / ข้อพิจารณา (Body Considerations)
    if (bodyConsiderations) {
      batchCommands.push({
        command: 'add',
        parent: '/body',
        type: 'paragraph',
        props: {
          text: `        ${bodyConsiderations}`,
          fontSize: '16pt',
          color: '000000',
        },
      })
    }

    // ภาคสรุป (Body Resolution)
    if (bodyResolution) {
      batchCommands.push({
        command: 'add',
        parent: '/body',
        type: 'paragraph',
        props: {
          text: `        ${bodyResolution}`,
          fontSize: '16pt',
          color: '000000',
        },
      })
    }

    // คำลงท้าย และ ลายมือชื่อ
    batchCommands.push(
      {
        command: 'add',
        parent: '/body',
        type: 'paragraph',
        props: {
          text: `                                                                     ขอแสดงความนับถือ\n\n\n                                                             ${signatoryName}\n                                                             ${signatoryPosition}`,
          fontSize: '16pt',
          color: '000000',
        },
      },
      {
        command: 'add',
        parent: '/body',
        type: 'paragraph',
        props: {
          text: `------------------------------------------------------------------------------------------------------------------------\n${department}\nติดต่อ: ${contactInfo}`,
          fontSize: '12pt',
          color: '475569',
        },
      }
    )

    // Write batch commands
    fs.writeFileSync(tempJsonPath, JSON.stringify(batchCommands), 'utf8')

    // Create blank docx
    await execFileAsync(bin, ['create', tempDocPath, '--force'])
    // Batch operations
    await execFileAsync(bin, ['batch', tempDocPath, '--input', tempJsonPath])
    // Close & flush
    await closeOfficeDoc(bin, tempDocPath)

    const fileBuffer = fs.readFileSync(tempDocPath)
    return fileBuffer
  } finally {
    try {
      if (fs.existsSync(tempDocPath)) fs.unlinkSync(tempDocPath)
      if (fs.existsSync(tempJsonPath)) fs.unlinkSync(tempJsonPath)
    } catch {
      // Ignore cleanup error
    }
  }
}
