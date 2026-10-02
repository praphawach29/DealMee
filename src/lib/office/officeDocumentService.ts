import path from 'path'
import fs from 'fs'
import os from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
  BorderStyle,
  ShadingType,
  ImageRun,
} from 'docx'
import ExcelJS from 'exceljs'

/**
 * Executes officecli with required environment variables.
 * Specifically sets DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1 for Vercel/Linux serverless compatibility.
 */
async function runOfficeCli(bin: string, args: string[]) {
  return promisify(execFile)(bin, args, {
    env: {
      ...process.env,
      DOTNET_SYSTEM_GLOBALIZATION_INVARIANT: '1',
    },
    maxBuffer: 10 * 1024 * 1024,
  })
}

/**
 * Resolves the path to the officecli executable.
 * Prioritizes the pre-downloaded vendor binary inside node_modules/@officecli/officecli/vendor.
 */
function getOfficeCliBinary(): string {
  const isWin = process.platform === 'win32'
  const binaryName = isWin ? 'officecli.exe' : 'officecli'
  const vendorPath = path.join(process.cwd(), 'node_modules', '@officecli', 'officecli', 'vendor', binaryName)

  if (fs.existsSync(vendorPath)) {
    if (!isWin) {
      try {
        fs.chmodSync(vendorPath, 0o755)
      } catch {}
    }
    return vendorPath
  }

  const shimPath = path.join(process.cwd(), 'node_modules', '.bin', isWin ? 'officecli.cmd' : 'officecli')
  if (fs.existsSync(shimPath)) {
    if (!isWin) {
      try {
        fs.chmodSync(shimPath, 0o755)
      } catch {}
    }
    return shimPath
  }

  return 'officecli'
}

/**
 * Helper to close/release an office document handle so it doesn't get EBUSY on Windows.
 */
async function closeOfficeDoc(bin: string, filePath: string) {
  try {
    await runOfficeCli(bin, ['close', filePath])
  } catch {
    // Ignore close errors
  }
}

export interface QuotationDocData {
  id?: string
  doc_number?: string
  doc_no?: string
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
  logo_buffer?: Buffer
  signature_buffer?: Buffer
}

// Helper: Convert total number to Thai Baht text
function formatThaiBahtText(num: number): string {
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
      if (digit === 0) continue
      const pos = len - 1 - i
      if (pos === 0 && digit === 1 && len > 1 && str[len - 2] !== '0') {
        result += 'เอ็ด'
      } else if (pos === 1 && digit === 1) {
        result += 'สิบ'
      } else if (pos === 1 && digit === 2) {
        result += 'ยี่สิบ'
      } else {
        result += numbers[digit] + units[pos]
      }
    }
    return result
  }

  let text = ''
  if (baht.length > 6) {
    const millions = baht.slice(0, baht.length - 6)
    const rest = baht.slice(baht.length - 6)
    text += readGroup(millions) + 'ล้าน' + readGroup(rest) + 'บาท'
  } else {
    text += readGroup(baht) + 'บาท'
  }

  if (satang === '00') {
    text += 'ถ้วน'
  } else {
    text += readGroup(satang) + 'สตางค์'
  }
  return text
}

/**
 * Generates a Word (.docx) Quotation using pure JavaScript (docx library) with rich brand design matching web/PDF.
 */
export async function generateQuotationDocxWithJs(
  doc: QuotationDocData,
  shop: ShopProfileData = {}
): Promise<Buffer> {
  const companyName = shop.company_name || shop.name || 'บริษัท / ร้านค้า'
  const taxId = shop.company_tax_id || '-'
  const address = shop.company_address || '-'
  const phone = shop.company_phone || '-'
  const email = shop.company_email || '-'

  const docNo = doc.doc_number || doc.doc_no || 'QT'
  const issueDate = new Date(doc.created_at || Date.now()).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const customerName = doc.customer_name || 'ลูกค้าผู้มีอุปการคุณ'
  const customerPhone = doc.customer_phone || '-'

  const subtotal = Number(doc.subtotal || 0)
  const discount = Number(doc.discount_amount || 0)
  const vat = Number(doc.vat_amount || 0)
  const total = Number(doc.total_amount || 0)

  let logoRun: ImageRun | undefined
  if (shop.logo_buffer && shop.logo_buffer.length > 0) {
    const isPng = shop.logo_buffer[0] === 0x89 && shop.logo_buffer[1] === 0x50
    logoRun = new ImageRun({
      data: shop.logo_buffer,
      transformation: { width: 55, height: 55 },
      type: isPng ? 'png' : 'jpg',
    })
  }

  let signatureRun: ImageRun | undefined
  if (shop.signature_buffer && shop.signature_buffer.length > 0) {
    const isPng = shop.signature_buffer[0] === 0x89 && shop.signature_buffer[1] === 0x50
    signatureRun = new ImageRun({
      data: shop.signature_buffer,
      transformation: { width: 110, height: 42 },
      type: isPng ? 'png' : 'jpg',
    })
  }

  const borderNone = {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  }

  const lightCardBorder = {
    top: { style: BorderStyle.SINGLE, size: 6, color: 'E2E8F0' },
    bottom: { style: BorderStyle.SINGLE, size: 6, color: 'E2E8F0' },
    left: { style: BorderStyle.SINGLE, size: 6, color: 'E2E8F0' },
    right: { style: BorderStyle.SINGLE, size: 6, color: 'E2E8F0' },
  }

  // 1. Header Section: Logo + Company Info (Left) & Quotation Title + Meta (Right)
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderNone,
    rows: [
      new TableRow({
        children: [
          // Left: Logo + Shop Details
          new TableCell({
            width: { size: 58, type: WidthType.PERCENTAGE },
            borders: borderNone,
            children: [
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: borderNone,
                rows: [
                  new TableRow({
                    children: [
                      ...(logoRun ? [
                        new TableCell({
                          width: { size: 22, type: WidthType.PERCENTAGE },
                          borders: borderNone,
                          children: [new Paragraph({ children: [logoRun] })],
                        })
                      ] : []),
                      new TableCell({
                        width: { size: logoRun ? 78 : 100, type: WidthType.PERCENTAGE },
                        borders: borderNone,
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({ text: companyName, bold: true, size: 26, color: '0F172A', font: 'Sarabun' }),
                              new TextRun({ text: '  ผู้ให้บริการ', size: 18, color: '2563EB', bold: true, font: 'Sarabun' }),
                            ],
                            spacing: { after: 60 },
                          }),
                          new Paragraph({
                            children: [
                              new TextRun({ text: address, size: 18, color: '475569', font: 'Sarabun' }),
                              new TextRun({ text: `โทร: ${phone}`, size: 18, color: '2563EB', bold: true, break: 1, font: 'Sarabun' }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          // Right: Title & Document Metadata
          new TableCell({
            width: { size: 42, type: WidthType.PERCENTAGE },
            borders: borderNone,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'ใบเสนอราคา', bold: true, size: 38, color: '2563EB', font: 'Sarabun' }),
                  new TextRun({ text: 'QUOTATION', bold: true, size: 18, color: '64748B', break: 1, font: 'Sarabun' }),
                ],
                alignment: AlignmentType.RIGHT,
                spacing: { after: 100 },
              }),
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: borderNone,
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        borders: borderNone,
                        children: [new Paragraph({ children: [new TextRun({ text: 'เลขที่เอกสาร:', size: 18, color: '64748B', font: 'Sarabun' })], alignment: AlignmentType.RIGHT })],
                      }),
                      new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        borders: borderNone,
                        children: [new Paragraph({ children: [new TextRun({ text: docNo, bold: true, size: 18, color: '1E40AF', font: 'Sarabun' })], alignment: AlignmentType.RIGHT })],
                      }),
                    ],
                  }),
                  new TableRow({
                    children: [
                      new TableCell({
                        borders: borderNone,
                        children: [new Paragraph({ children: [new TextRun({ text: 'วันที่ออกเอกสาร:', size: 18, color: '64748B', font: 'Sarabun' })], alignment: AlignmentType.RIGHT })],
                      }),
                      new TableCell({
                        borders: borderNone,
                        children: [new Paragraph({ children: [new TextRun({ text: issueDate, size: 18, color: '0F172A', font: 'Sarabun' })], alignment: AlignmentType.RIGHT })],
                      }),
                    ],
                  }),
                  new TableRow({
                    children: [
                      new TableCell({
                        borders: borderNone,
                        children: [new Paragraph({ children: [new TextRun({ text: 'กำหนดยืนราคา:', size: 18, color: '64748B', font: 'Sarabun' })], alignment: AlignmentType.RIGHT })],
                      }),
                      new TableCell({
                        borders: borderNone,
                        children: [new Paragraph({ children: [new TextRun({ text: '30 วัน', bold: true, size: 18, color: '059669', font: 'Sarabun' })], alignment: AlignmentType.RIGHT })],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  })

  // 2. Customer Card Table
  const customerCard = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: lightCardBorder,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 65, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
            borders: lightCardBorder,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'ลูกค้าผู้รับการเสนอราคา / CUSTOMER', bold: true, size: 17, color: '2563EB', font: 'Sarabun' }),
                  new TextRun({ text: customerName, bold: true, size: 24, color: '0F172A', break: 1, font: 'Sarabun' }),
                  new TextRun({ text: `เบอร์โทรศัพท์: ${customerPhone}`, size: 18, color: '475569', break: 1, font: 'Sarabun' }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
            borders: lightCardBorder,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: '● รออนุมัติการสั่งซื้อ (Pending)', bold: true, size: 18, color: 'D97706', font: 'Sarabun' }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        ],
      }),
    ],
  })

  // 3. Products Table with Brand Slate Header & Single-line column titles
  const tableBorder = {
    top: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' },
    bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' },
    left: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' },
    right: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' },
  }

  const items = Array.isArray(doc.items) && doc.items.length > 0 ? doc.items : []
  const itemTableRows = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 8, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: '1E293B' },
          borders: tableBorder,
          children: [new Paragraph({ children: [new TextRun({ text: '#', bold: true, color: 'FFFFFF', size: 19, font: 'Sarabun' })], alignment: AlignmentType.CENTER })],
        }),
        new TableCell({
          width: { size: 44, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: '1E293B' },
          borders: tableBorder,
          children: [new Paragraph({ children: [new TextRun({ text: 'รายการสินค้า', bold: true, color: 'FFFFFF', size: 19, font: 'Sarabun' })] })],
        }),
        new TableCell({
          width: { size: 12, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: '1E293B' },
          borders: tableBorder,
          children: [new Paragraph({ children: [new TextRun({ text: 'จำนวน', bold: true, color: 'FFFFFF', size: 19, font: 'Sarabun' })], alignment: AlignmentType.CENTER })],
        }),
        new TableCell({
          width: { size: 12, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: '1E293B' },
          borders: tableBorder,
          children: [new Paragraph({ children: [new TextRun({ text: 'หน่วย', bold: true, color: 'FFFFFF', size: 19, font: 'Sarabun' })], alignment: AlignmentType.CENTER })],
        }),
        new TableCell({
          width: { size: 12, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: '1E293B' },
          borders: tableBorder,
          children: [new Paragraph({ children: [new TextRun({ text: 'ราคา/หน่วย', bold: true, color: 'FFFFFF', size: 19, font: 'Sarabun' })], alignment: AlignmentType.RIGHT })],
        }),
        new TableCell({
          width: { size: 12, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: '1E293B' },
          borders: tableBorder,
          children: [new Paragraph({ children: [new TextRun({ text: 'จำนวนเงิน (บาท)', bold: true, color: 'FFFFFF', size: 19, font: 'Sarabun' })], alignment: AlignmentType.RIGHT })],
        }),
      ],
    }),
  ]

  items.forEach((item, idx) => {
    const qty = Number(item.qty || 1)
    const price = Number(item.price || 0)
    const lineTotal = qty * price
    const isEven = idx % 2 === 1
    const rowFill = isEven ? 'F8FAFC' : 'FFFFFF'

    itemTableRows.push(
      new TableRow({
        children: [
          new TableCell({
            borders: tableBorder,
            shading: { type: ShadingType.CLEAR, fill: rowFill },
            children: [new Paragraph({ children: [new TextRun({ text: String(idx + 1), size: 19, color: '475569', font: 'Sarabun' })], alignment: AlignmentType.CENTER })],
          }),
          new TableCell({
            borders: tableBorder,
            shading: { type: ShadingType.CLEAR, fill: rowFill },
            children: [new Paragraph({ children: [new TextRun({ text: item.name || 'สินค้า', size: 19, bold: true, color: '0F172A', font: 'Sarabun' })] })],
          }),
          new TableCell({
            borders: tableBorder,
            shading: { type: ShadingType.CLEAR, fill: rowFill },
            children: [new Paragraph({ children: [new TextRun({ text: String(qty), size: 19, color: '0F172A', font: 'Sarabun' })], alignment: AlignmentType.CENTER })],
          }),
          new TableCell({
            borders: tableBorder,
            shading: { type: ShadingType.CLEAR, fill: rowFill },
            children: [new Paragraph({ children: [new TextRun({ text: item.unit || 'ชิ้น', size: 19, color: '475569', font: 'Sarabun' })], alignment: AlignmentType.CENTER })],
          }),
          new TableCell({
            borders: tableBorder,
            shading: { type: ShadingType.CLEAR, fill: rowFill },
            children: [new Paragraph({ children: [new TextRun({ text: price.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), size: 19, color: '0F172A', font: 'Sarabun' })], alignment: AlignmentType.RIGHT })],
          }),
          new TableCell({
            borders: tableBorder,
            shading: { type: ShadingType.CLEAR, fill: rowFill },
            children: [new Paragraph({ children: [new TextRun({ text: lineTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), bold: true, size: 19, color: '0F172A', font: 'Sarabun' })], alignment: AlignmentType.RIGHT })],
          }),
        ],
      })
    )
  })

  const itemsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorder,
    rows: itemTableRows,
  })

  // 4. Bottom 2-Column Section: Payment Card (Left) & Totals / Blue Grand Total Box (Right)
  const bottomSectionTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderNone,
    rows: [
      new TableRow({
        children: [
          // Left: Payment Box
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: borderNone,
            children: [
              ...(shop.bank_account_number || shop.promptpay_id ? [
                new Table({
                  width: { size: 96, type: WidthType.PERCENTAGE },
                  borders: lightCardBorder,
                  rows: [
                    new TableRow({
                      children: [
                        new TableCell({
                          borders: lightCardBorder,
                          shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
                          children: [
                            new Paragraph({
                              children: [
                                new TextRun({ text: '💳 ช่องทางการชำระเงิน (Payment Details)', bold: true, size: 19, color: '1E40AF', font: 'Sarabun' }),
                                new TextRun({ text: `ธนาคาร: ${shop.bank_name || '-'}`, size: 18, color: '0F172A', break: 1, font: 'Sarabun' }),
                                new TextRun({ text: `เลขที่บัญชี: ${shop.bank_account_number || '-'}`, bold: true, size: 20, color: '1E40AF', break: 1, font: 'Sarabun' }),
                                new TextRun({ text: `ชื่อบัญชี: ${shop.bank_account_name || companyName}`, size: 18, color: '475569', break: 1, font: 'Sarabun' }),
                                ...(shop.promptpay_id ? [new TextRun({ text: `PromptPay: ${shop.promptpay_id}`, bold: true, size: 19, color: '0F172A', break: 1, font: 'Sarabun' })] : []),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ] : []),
            ],
          }),
          // Right: Summary & Blue Grand Total Box
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: borderNone,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `ยอดรวมก่อนภาษี (Subtotal):  ${subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`, size: 19, color: '475569', font: 'Sarabun' }),
                  ...(discount > 0 ? [new TextRun({ text: `ส่วนลด (Discount):  -${discount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`, size: 19, color: 'DC2626', break: 1, font: 'Sarabun' })] : []),
                  ...(vat > 0 ? [new TextRun({ text: `ภาษีมูลค่าเพิ่ม VAT 7%:  ${vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`, size: 19, color: '475569', break: 1, font: 'Sarabun' })] : []),
                ],
                alignment: AlignmentType.RIGHT,
                spacing: { after: 100 },
              }),
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: lightCardBorder,
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        borders: lightCardBorder,
                        shading: { type: ShadingType.CLEAR, fill: '2563EB' },
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({ text: 'ยอดสุทธิทั้งสิ้น (Grand Total):  ', bold: true, size: 20, color: 'FFFFFF', font: 'Sarabun' }),
                              new TextRun({ text: `฿${total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`, bold: true, size: 28, color: 'FFFFFF', font: 'Sarabun' }),
                            ],
                            alignment: AlignmentType.CENTER,
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: `( ${formatThaiBahtText(total)} )`, size: 17, color: '64748B', italics: true, font: 'Sarabun' }),
                ],
                alignment: AlignmentType.RIGHT,
                spacing: { before: 80 },
              }),
            ],
          }),
        ],
      }),
    ],
  })

  // 5. Signatures Section
  const signatureTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderNone,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: borderNone,
            children: [
              new Paragraph({
                children: [
                  ...(signatureRun ? [
                    signatureRun,
                    new TextRun({ text: '', break: 1 }),
                  ] : [
                    new TextRun({ text: 'ลงชื่อ ................................................................', size: 18, color: '64748B', font: 'Sarabun' }),
                  ]),
                  new TextRun({ text: `( ${companyName} )`, bold: true, size: 18, color: '0F172A', break: signatureRun ? 1 : 1, font: 'Sarabun' }),
                  new TextRun({ text: 'ผู้มีอำนาจลงนาม / ผู้เสนอราคา', size: 17, color: '64748B', break: 1, font: 'Sarabun' }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: borderNone,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'ลงชื่อ ................................................................', size: 18, color: '64748B', font: 'Sarabun' }),
                  new TextRun({ text: `( ${customerName} )`, bold: true, size: 18, color: '0F172A', break: 1, font: 'Sarabun' }),
                  new TextRun({ text: 'ผู้สั่งซื้อ / ผู้อนุมัติ', size: 17, color: '64748B', break: 1, font: 'Sarabun' }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        ],
      }),
    ],
  })

  const wordDoc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,    // 0.5 inch
              bottom: 720,
              left: 720,
              right: 720,
            },
          },
        },
        children: [
          headerTable,
          new Paragraph({ spacing: { after: 150 } }),
          customerCard,
          new Paragraph({ spacing: { after: 150 } }),
          itemsTable,
          new Paragraph({ spacing: { after: 150 } }),
          bottomSectionTable,
          new Paragraph({ spacing: { after: 350 } }),
          signatureTable,
        ],
      },
    ],
  })

  return await Packer.toBuffer(wordDoc)
}

/**
 * Generates an Excel (.xlsx) Quotation using pure JavaScript (ExcelJS) as reliable fallback.
 */
export async function generateQuotationXlsxWithJs(
  doc: QuotationDocData,
  shop: ShopProfileData = {}
): Promise<Buffer> {
  const companyName = shop.company_name || shop.name || 'บริษัท / ร้านค้า'
  const customerName = doc.customer_name || 'ลูกค้าผู้มีอุปการคุณ'
  const docNo = doc.doc_number || doc.doc_no || '-'
  const issueDate = new Date(doc.created_at || Date.now()).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const subtotal = Number(doc.subtotal || 0)
  const discount = Number(doc.discount_amount || 0)
  const vat = Number(doc.vat_amount || 0)
  const total = Number(doc.total_amount || 0)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'DealMee AI'
  const sheet = workbook.addWorksheet('ใบเสนอราคา', {
    views: [{ showGridLines: true }],
  })

  // 6 Columns aligned 1:1 with Web and Word:
  // Col A: #
  // Col B: รายการสินค้า
  // Col C: จำนวน
  // Col D: หน่วย
  // Col E: ราคา/หน่วย (บาท)
  // Col F: จำนวนเงิน (บาท)
  sheet.columns = [
    { key: 'col1', width: 6 },
    { key: 'col2', width: 38 },
    { key: 'col3', width: 12 },
    { key: 'col4', width: 12 },
    { key: 'col5', width: 18 },
    { key: 'col6', width: 22 },
  ]

  // 1. Header Title & Document Number
  sheet.mergeCells('A1:D1')
  const titleCell = sheet.getCell('A1')
  titleCell.value = 'ใบเสนอราคา (QUOTATION)'
  titleCell.font = { size: 16, bold: true, color: { argb: 'FF1E3A8A' } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' }

  sheet.mergeCells('E1:F1')
  const docNoCell = sheet.getCell('E1')
  docNoCell.value = `เลขที่: ${docNo}`
  docNoCell.font = { size: 12, bold: true, color: { argb: 'FF2563EB' } }
  docNoCell.alignment = { vertical: 'middle', horizontal: 'right' }
  sheet.getRow(1).height = 32

  // 2. Company & Issue Date
  sheet.mergeCells('A2:D2')
  const sellerCell = sheet.getCell('A2')
  sellerCell.value = `ผู้ให้บริการ: ${companyName}`
  sellerCell.font = { size: 11, bold: true, color: { argb: 'FF0F172A' } }
  sellerCell.alignment = { vertical: 'middle' }

  sheet.mergeCells('E2:F2')
  const dateCell = sheet.getCell('E2')
  dateCell.value = `วันที่: ${issueDate}`
  dateCell.font = { size: 10, color: { argb: 'FF475569' } }
  dateCell.alignment = { vertical: 'middle', horizontal: 'right' }
  sheet.getRow(2).height = 20

  // 3. Address & Validity
  sheet.mergeCells('A3:D3')
  const addressCell = sheet.getCell('A3')
  addressCell.value = `ที่อยู่: ${shop.company_address || '-'}${shop.company_phone ? ' | โทร: ' + shop.company_phone : ''}`
  addressCell.font = { size: 10, color: { argb: 'FF475569' } }
  addressCell.alignment = { vertical: 'middle' }

  sheet.mergeCells('E3:F3')
  const validCell = sheet.getCell('E3')
  validCell.value = 'กำหนดยืนราคา: 30 วัน'
  validCell.font = { size: 10, color: { argb: 'FF475569' } }
  validCell.alignment = { vertical: 'middle', horizontal: 'right' }
  sheet.getRow(3).height = 20

  // 4. Customer Details
  sheet.mergeCells('A4:D4')
  const customerCell = sheet.getCell('A4')
  customerCell.value = `ลูกค้า: ${customerName}${doc.customer_phone ? ' | โทร: ' + doc.customer_phone : ''}`
  customerCell.font = { size: 11, bold: true, color: { argb: 'FF1E40AF' } }
  customerCell.alignment = { vertical: 'middle' }

  sheet.mergeCells('E4:F4')
  const taxCell = sheet.getCell('E4')
  taxCell.value = shop.company_tax_id ? `เลขประจำตัวผู้เสียภาษี: ${shop.company_tax_id}` : ''
  taxCell.font = { size: 9, color: { argb: 'FF64748B' } }
  taxCell.alignment = { vertical: 'middle', horizontal: 'right' }
  sheet.getRow(4).height = 22

  // 5. Spacer Row
  sheet.getRow(5).height = 10

  // 6. Table Header (Single line, matching Word & Web: #, รายการสินค้า, จำนวน, หน่วย, ราคา/หน่วย, จำนวนเงิน)
  const headerRow = sheet.getRow(6)
  headerRow.values = ['#', 'รายการสินค้า', 'จำนวน', 'หน่วย', 'ราคา/หน่วย (บาท)', 'จำนวนเงิน (บาท)']
  headerRow.height = 26
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    }
  })
  headerRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' }
  headerRow.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' }
  headerRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' }

  // 7. Table Item Rows
  let currentRowIdx = 7
  const items = Array.isArray(doc.items) && doc.items.length > 0 ? doc.items : []
  items.forEach((item, idx) => {
    const qty = Number(item.qty || 1)
    const price = Number(item.price || 0)
    const lineTotal = qty * price
    const row = sheet.getRow(currentRowIdx)
    row.values = [
      idx + 1,
      item.name || 'สินค้า',
      qty,
      item.unit || 'ชิ้น',
      price,
      lineTotal,
    ]
    row.height = 24

    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' }
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' }
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' }
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' }
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' }
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' }

    row.getCell(2).font = { bold: true, color: { argb: 'FF0F172A' }, size: 10 }
    row.getCell(3).numFmt = '#,##0'
    row.getCell(5).numFmt = '#,##0.00'
    row.getCell(6).numFmt = '#,##0.00'
    row.getCell(6).font = { bold: true, color: { argb: 'FF0F172A' }, size: 10 }

    const isEven = idx % 2 === 1
    const bgFill = isEven ? 'FFF8FAFC' : 'FFFFFFFF'
    row.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgFill } }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
    })

    currentRowIdx++
  })

  // 8. Spacer Row
  sheet.getRow(currentRowIdx).height = 10
  currentRowIdx++

  // 9. Subtotal
  const subtotalRow = sheet.getRow(currentRowIdx)
  subtotalRow.getCell(5).value = 'ยอดรวมก่อนภาษี:'
  subtotalRow.getCell(5).font = { size: 10, color: { argb: 'FF475569' } }
  subtotalRow.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' }
  subtotalRow.getCell(6).value = subtotal
  subtotalRow.getCell(6).font = { size: 10, color: { argb: 'FF0F172A' } }
  subtotalRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' }
  subtotalRow.getCell(6).numFmt = '#,##0.00'
  subtotalRow.height = 20
  currentRowIdx++

  // Discount (if any)
  if (discount > 0) {
    const discRow = sheet.getRow(currentRowIdx)
    discRow.getCell(5).value = 'ส่วนลด:'
    discRow.getCell(5).font = { size: 10, color: { argb: 'FFDC2626' } }
    discRow.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' }
    discRow.getCell(6).value = -discount
    discRow.getCell(6).font = { size: 10, color: { argb: 'FFDC2626' } }
    discRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' }
    discRow.getCell(6).numFmt = '#,##0.00'
    discRow.height = 20
    currentRowIdx++
  }

  // VAT (if any)
  if (vat > 0) {
    const vatRow = sheet.getRow(currentRowIdx)
    vatRow.getCell(5).value = 'ภาษีมูลค่าเพิ่ม 7%:'
    vatRow.getCell(5).font = { size: 10, color: { argb: 'FF475569' } }
    vatRow.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' }
    vatRow.getCell(6).value = vat
    vatRow.getCell(6).font = { size: 10, color: { argb: 'FF0F172A' } }
    vatRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' }
    vatRow.getCell(6).numFmt = '#,##0.00'
    vatRow.height = 20
    currentRowIdx++
  }

  // 10. Grand Total Box (Electric Blue background)
  const grandTotalRow = sheet.getRow(currentRowIdx)
  grandTotalRow.getCell(5).value = 'ยอดสุทธิทั้งสิ้น (บาท):'
  grandTotalRow.getCell(5).font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
  grandTotalRow.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' }
  grandTotalRow.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }

  grandTotalRow.getCell(6).value = total
  grandTotalRow.getCell(6).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
  grandTotalRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' }
  grandTotalRow.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
  grandTotalRow.getCell(6).numFmt = '#,##0.00'
  grandTotalRow.height = 26

  ;[5, 6].forEach((col) => {
    grandTotalRow.getCell(col).border = {
      top: { style: 'medium', color: { argb: 'FF1D4ED8' } },
      bottom: { style: 'medium', color: { argb: 'FF1D4ED8' } },
      left: { style: 'medium', color: { argb: 'FF1D4ED8' } },
      right: { style: 'medium', color: { argb: 'FF1D4ED8' } },
    }
  })
  currentRowIdx++

  // 11. Thai Baht Text
  sheet.mergeCells(`D${currentRowIdx}:F${currentRowIdx}`)
  const bahtCell = sheet.getCell(`D${currentRowIdx}`)
  bahtCell.value = `( ${formatThaiBahtText(total)} )`
  bahtCell.font = { italic: true, size: 9, color: { argb: 'FF64748B' } }
  bahtCell.alignment = { vertical: 'middle', horizontal: 'right' }
  sheet.getRow(currentRowIdx).height = 18
  currentRowIdx++

  // 12. Payment Details Card
  if (shop.bank_account_number || shop.promptpay_id) {
    sheet.getRow(currentRowIdx).height = 12
    currentRowIdx++

    sheet.mergeCells(`A${currentRowIdx}:D${currentRowIdx}`)
    const payTitleCell = sheet.getCell(`A${currentRowIdx}`)
    payTitleCell.value = '💳 ข้อมูลการชำระเงิน (Payment Details)'
    payTitleCell.font = { bold: true, size: 10, color: { argb: 'FF1E40AF' } }
    payTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } }
    payTitleCell.alignment = { vertical: 'middle' }
    payTitleCell.border = {
      top: { style: 'thin', color: { argb: 'FFBFDBFE' } },
      left: { style: 'thin', color: { argb: 'FFBFDBFE' } },
      right: { style: 'thin', color: { argb: 'FFBFDBFE' } },
    }
    sheet.getRow(currentRowIdx).height = 22
    currentRowIdx++

    sheet.mergeCells(`A${currentRowIdx}:D${currentRowIdx}`)
    const bankCell = sheet.getCell(`A${currentRowIdx}`)
    bankCell.value = `ธนาคาร: ${shop.bank_name || '-'}  |  เลขที่บัญชี: ${shop.bank_account_number || '-'}  |  ชื่อบัญชี: ${shop.bank_account_name || companyName}`
    bankCell.font = { size: 9, color: { argb: 'FF1E293B' } }
    bankCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
    bankCell.alignment = { vertical: 'middle' }
    bankCell.border = {
      left: { style: 'thin', color: { argb: 'FFBFDBFE' } },
      right: { style: 'thin', color: { argb: 'FFBFDBFE' } },
      bottom: shop.promptpay_id ? undefined : { style: 'thin', color: { argb: 'FFBFDBFE' } },
    }
    sheet.getRow(currentRowIdx).height = 20
    currentRowIdx++

    if (shop.promptpay_id) {
      sheet.mergeCells(`A${currentRowIdx}:D${currentRowIdx}`)
      const ppCell = sheet.getCell(`A${currentRowIdx}`)
      ppCell.value = `พร้อมเพย์ (PromptPay): ${shop.promptpay_id}`
      ppCell.font = { bold: true, size: 9, color: { argb: 'FF1E3A8A' } }
      ppCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
      ppCell.alignment = { vertical: 'middle' }
      ppCell.border = {
        left: { style: 'thin', color: { argb: 'FFBFDBFE' } },
        right: { style: 'thin', color: { argb: 'FFBFDBFE' } },
        bottom: { style: 'thin', color: { argb: 'FFBFDBFE' } },
      }
      sheet.getRow(currentRowIdx).height = 20
      currentRowIdx++
    }
  }

  // 13. Signatures Section
  sheet.getRow(currentRowIdx).height = 24
  currentRowIdx++

  const sigRow1 = currentRowIdx
  sheet.mergeCells(`A${sigRow1}:C${sigRow1}`)
  sheet.mergeCells(`D${sigRow1}:F${sigRow1}`)

  if (shop.signature_buffer && shop.signature_buffer.length > 0) {
    try {
      const isPng = shop.signature_buffer[0] === 0x89 && shop.signature_buffer[1] === 0x50
      const sigImgId = workbook.addImage({
        buffer: shop.signature_buffer as any,
        extension: isPng ? 'png' : 'jpeg',
      })
      sheet.addImage(sigImgId, {
        tl: { col: 1.0, row: sigRow1 - 1 },
        ext: { width: 130, height: 44 },
      })
      sheet.getRow(sigRow1).height = 42
    } catch {
      sheet.getCell(`A${sigRow1}`).value = 'ลงชื่อ ................................................................'
      sheet.getCell(`A${sigRow1}`).font = { size: 9, color: { argb: 'FF64748B' } }
      sheet.getCell(`A${sigRow1}`).alignment = { horizontal: 'center', vertical: 'middle' }
      sheet.getRow(sigRow1).height = 20
    }
  } else {
    sheet.getCell(`A${sigRow1}`).value = 'ลงชื่อ ................................................................'
    sheet.getCell(`A${sigRow1}`).font = { size: 9, color: { argb: 'FF64748B' } }
    sheet.getCell(`A${sigRow1}`).alignment = { horizontal: 'center', vertical: 'middle' }
    sheet.getRow(sigRow1).height = 20
  }

  sheet.getCell(`D${sigRow1}`).value = 'ลงชื่อ ................................................................'
  sheet.getCell(`D${sigRow1}`).font = { size: 9, color: { argb: 'FF64748B' } }
  sheet.getCell(`D${sigRow1}`).alignment = { horizontal: 'center', vertical: 'middle' }
  currentRowIdx++

  const sigRow2 = currentRowIdx
  sheet.mergeCells(`A${sigRow2}:C${sigRow2}`)
  sheet.getCell(`A${sigRow2}`).value = `( ${companyName} )`
  sheet.getCell(`A${sigRow2}`).font = { bold: true, size: 10, color: { argb: 'FF0F172A' } }
  sheet.getCell(`A${sigRow2}`).alignment = { horizontal: 'center', vertical: 'middle' }

  sheet.mergeCells(`D${sigRow2}:F${sigRow2}`)
  sheet.getCell(`D${sigRow2}`).value = `( ${customerName} )`
  sheet.getCell(`D${sigRow2}`).font = { bold: true, size: 10, color: { argb: 'FF0F172A' } }
  sheet.getCell(`D${sigRow2}`).alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getRow(sigRow2).height = 20
  currentRowIdx++

  const sigRow3 = currentRowIdx
  sheet.mergeCells(`A${sigRow3}:C${sigRow3}`)
  sheet.getCell(`A${sigRow3}`).value = 'ผู้เสนอราคา'
  sheet.getCell(`A${sigRow3}`).font = { size: 9, color: { argb: 'FF64748B' } }
  sheet.getCell(`A${sigRow3}`).alignment = { horizontal: 'center', vertical: 'middle' }

  sheet.mergeCells(`D${sigRow3}:F${sigRow3}`)
  sheet.getCell(`D${sigRow3}`).value = 'ผู้สั่งซื้อ / ผู้อนุมัติ'
  sheet.getCell(`D${sigRow3}`).font = { size: 9, color: { argb: 'FF64748B' } }
  sheet.getCell(`D${sigRow3}`).alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getRow(sigRow3).height = 20

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * Generates a Word (.docx) Quotation using pure JS (fast, reliable, zero-crash in serverless)
 */
export async function generateQuotationDocx(
  doc: QuotationDocData,
  shop: ShopProfileData = {}
): Promise<Buffer> {
  return generateQuotationDocxWithJs(doc, shop)
}

/**
 * Generates an Excel (.xlsx) Quotation using pure JS (fast, reliable, zero-crash in serverless)
 */
export async function generateQuotationXlsx(
  doc: QuotationDocData,
  shop: ShopProfileData = {}
): Promise<Buffer> {
  return generateQuotationXlsxWithJs(doc, shop)
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
 * Generates an Official Thai Government Letter (.docx) using pure JavaScript (docx library) as fallback
 */
export async function generateOfficialLetterDocxWithJs(
  rawDoc: any,
  shop: ShopProfileData = {}
): Promise<Buffer> {
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

  const wordDoc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: 'ตราครุฑ', bold: true, size: 28, color: '991B1B' }),
              new TextRun({ text: '(หนังสือราชการภายนอก)', bold: true, size: 24, break: 1 }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `ที่ ${docNumber}`, bold: true }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: department, bold: true }),
              ...(shop.company_address ? [new TextRun({ text: shop.company_address, bold: true, break: 1 })] : []),
            ],
            alignment: AlignmentType.RIGHT,
          }),
          new Paragraph({
            children: [new TextRun({ text: dateStr })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `เรื่อง    ${subject}`, bold: true }),
              new TextRun({ text: `เรียน    ${recipient}`, bold: true, break: 1 }),
              ...(referenceTo ? [new TextRun({ text: `อ้างถึง   ${referenceTo}`, break: 1 })] : []),
              ...(enclosures ? [new TextRun({ text: `สิ่งที่ส่งมาด้วย   ${enclosures}`, break: 1 })] : []),
            ],
            spacing: { after: 200 },
          }),
          ...(bodyFacts ? [
            new Paragraph({
              children: [new TextRun({ text: `        ${bodyFacts}` })],
              spacing: { after: 150 },
            }),
          ] : []),
          ...(bodyConsiderations ? [
            new Paragraph({
              children: [new TextRun({ text: `        ${bodyConsiderations}` })],
              spacing: { after: 150 },
            }),
          ] : []),
          ...(bodyResolution ? [
            new Paragraph({
              children: [new TextRun({ text: `        ${bodyResolution}` })],
              spacing: { after: 300 },
            }),
          ] : []),
          new Paragraph({
            children: [
              new TextRun({ text: 'ขอแสดงความนับถือ' }),
              new TextRun({ text: signatoryName, bold: true, break: 2 }),
              new TextRun({ text: signatoryPosition, break: 1 }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 300 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '------------------------------------------------------------', size: 18, color: '64748B' }),
              new TextRun({ text: department, size: 18, color: '64748B', break: 1 }),
              new TextRun({ text: `ติดต่อ: ${contactInfo}`, size: 18, color: '64748B', break: 1 }),
            ],
          }),
        ],
      },
    ],
  })

  return await Packer.toBuffer(wordDoc)
}

/**
 * Generates an Official Thai Government Letter (.docx) using pure JS (fast, reliable, zero-crash in serverless)
 */
export async function generateOfficialLetterDocx(
  rawDoc: any,
  shop: ShopProfileData = {}
): Promise<Buffer> {
  return generateOfficialLetterDocxWithJs(rawDoc, shop)
}
