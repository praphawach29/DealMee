'use client'

import { useState } from 'react'
import {
  FileSpreadsheet,
  FileText,
  UploadCloud,
  Sparkles,
  Plus,
  Trash2,
  Copy,
  ExternalLink,
  Printer,
  Check,
  AlertCircle,
  Clock,
  Building2,
  Search,
  ArrowRight,
  RefreshCw,
} from 'lucide-react'
import {
  parseDocumentToQuotationAction,
  saveQuotationAction,
  draftOfficialLetterAction,
  saveOfficialLetterAction,
  deleteDocumentAction,
  OfficialLetterDraft,
} from './actions'

interface DocumentItem {
  id: string
  doc_number: string
  doc_type: string
  customer_name: string | null
  total_amount: number | null
  created_at: string
  items?: any
  notes?: string | null
}

interface DocumentStudioProps {
  initialDocuments: DocumentItem[]
  shopName: string
  companyName?: string
  vatEnabled?: boolean
}

type TabType = 'quotations' | 'official' | 'archive'

export default function DocumentStudioClient({
  initialDocuments,
  shopName,
  companyName,
  vatEnabled = false,
}: DocumentStudioProps) {
  const [activeTab, setActiveTab] = useState<TabType>('quotations')
  const [documents, setDocuments] = useState<DocumentItem[]>(initialDocuments)
  const [searchQuery, setSearchQuery] = useState('')

  // ── Quotation State ──
  const [parsingQuote, setParsingQuote] = useState(false)
  const [quoteFile, setQuoteFile] = useState<File | null>(null)
  const [quoteCustomerName, setQuoteCustomerName] = useState('')
  const [quoteCustomerPhone, setQuoteCustomerPhone] = useState('')
  const [quoteCustomerAddress, setQuoteCustomerAddress] = useState('')
  const [quoteItems, setQuoteItems] = useState<Array<{ name: string; qty: number; price: number; unit?: string }>>([
    { name: '', qty: 1, price: 0, unit: 'ชิ้น' },
  ])
  const [quoteNotes, setQuoteNotes] = useState('')
  const [quoteDiscount, setQuoteDiscount] = useState(0)
  const [quoteApplyVat, setQuoteApplyVat] = useState(vatEnabled)
  const [quoteSaving, setQuoteSaving] = useState(false)
  const [quoteSavedUrl, setQuoteSavedUrl] = useState<string | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  // ── Official Letter State ──
  const [draftingLetter, setDraftingLetter] = useState(false)
  const [letterFile, setLetterFile] = useState<File | null>(null)
  const [letterInstructions, setLetterInstructions] = useState('')
  const [letterDraft, setLetterDraft] = useState<OfficialLetterDraft | null>(null)
  const [rawSourceMarkdown, setRawSourceMarkdown] = useState<string | null>(null)
  const [letterSaving, setLetterSaving] = useState(false)
  const [letterSavedUrl, setLetterSavedUrl] = useState<string | null>(null)
  const [letterError, setLetterError] = useState<string | null>(null)

  // Calculations for Quotation
  const subtotal = quoteItems.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 1), 0)
  const afterDiscount = Math.max(0, subtotal - (Number(quoteDiscount) || 0))
  const vatAmount = quoteApplyVat ? Math.round(afterDiscount * 0.07 * 100) / 100 : 0
  const totalAmount = afterDiscount + vatAmount

  // Handle Quotation File Upload & Parsing
  const handleQuoteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setQuoteFile(file)
    setParsingQuote(true)
    setQuoteError(null)
    setQuoteSavedUrl(null)

    const fd = new FormData()
    fd.append('file', file)

    const res = await parseDocumentToQuotationAction(fd)
    setParsingQuote(false)

    if (res.error) {
      setQuoteError(res.error)
      return
    }

    if (res.quotation) {
      const q = res.quotation
      if (q.customer_name) setQuoteCustomerName(q.customer_name)
      if (q.customer_phone) setQuoteCustomerPhone(q.customer_phone)
      if (q.customer_address) setQuoteCustomerAddress(q.customer_address)
      if (q.items && q.items.length > 0) {
        setQuoteItems(q.items.map((it) => ({
          name: it.name,
          qty: it.qty,
          price: it.price,
          unit: it.unit || 'ชิ้น',
        })))
      }
      if (q.notes) setQuoteNotes(q.notes)
      if (q.discount_amount) setQuoteDiscount(q.discount_amount)
    }
  }

  // Handle Save Quotation
  const handleSaveQuotation = async () => {
    setQuoteSaving(true)
    setQuoteError(null)

    const res = await saveQuotationAction({
      customer_name: quoteCustomerName,
      customer_phone: quoteCustomerPhone,
      customer_address: quoteCustomerAddress,
      items: quoteItems,
      subtotal,
      discount_amount: quoteDiscount,
      vat_amount: vatAmount,
      total_amount: totalAmount,
      notes: quoteNotes,
    })

    setQuoteSaving(false)
    if (res.error) {
      setQuoteError(res.error)
      return
    }

    if (res.docUrl) {
      setQuoteSavedUrl(res.docUrl)
      // Append to list
      setDocuments((prev) => [
        {
          id: res.docId!,
          doc_number: res.docNumber!,
          doc_type: 'quotation',
          customer_name: quoteCustomerName || 'ลูกค้าผู้มีอุปการคุณ',
          total_amount: totalAmount,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ])
    }
  }

  // Handle Official Letter Drafting
  const handleDraftLetter = async () => {
    if (!letterFile) {
      setLetterError('กรุณาเลือกไฟล์เอกสารต้นเรื่อง')
      return
    }
    setDraftingLetter(true)
    setLetterError(null)
    setLetterSavedUrl(null)

    const fd = new FormData()
    fd.append('file', letterFile)
    fd.append('template_type', 'external_letter')
    fd.append('instructions', letterInstructions)

    const res = await draftOfficialLetterAction(fd)
    setDraftingLetter(false)

    if (res.error) {
      setLetterError(res.error)
      return
    }

    if (res.letterDraft) {
      setLetterDraft(res.letterDraft)
      setRawSourceMarkdown(res.markdownSource || null)
    }
  }

  // Handle Save Official Letter
  const handleSaveLetter = async () => {
    if (!letterDraft) return
    setLetterSaving(true)
    setLetterError(null)

    const res = await saveOfficialLetterAction(letterDraft)
    setLetterSaving(false)

    if (res.error) {
      setLetterError(res.error)
      return
    }

    if (res.docUrl) {
      setLetterSavedUrl(res.docUrl)
      setDocuments((prev) => [
        {
          id: res.docId!,
          doc_number: res.docNumber!,
          doc_type: 'official_letter',
          customer_name: letterDraft.recipient,
          total_amount: 0,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ])
    }
  }

  // Delete Document
  const handleDeleteDoc = async (id: string) => {
    if (!confirm('ยืนยันการลบเอกสารฉบับนี้?')) return
    const res = await deleteDocumentAction(id)
    if (res.success) {
      setDocuments((prev) => prev.filter((d) => d.id !== id))
    } else {
      alert(res.error || 'ลบไม่สำเร็จ')
    }
  }

  // Add Item row in Quote
  const handleAddItem = () => {
    setQuoteItems([...quoteItems, { name: '', qty: 1, price: 0, unit: 'ชิ้น' }])
  }

  // Remove Item row in Quote
  const handleRemoveItem = (index: number) => {
    if (quoteItems.length === 1) return
    setQuoteItems(quoteItems.filter((_, i) => i !== index))
  }

  // Apply Margin Markup %
  const handleApplyMargin = (percent: number) => {
    setQuoteItems((prev) =>
      prev.map((it) => ({
        ...it,
        price: Math.round(it.price * (1 + percent / 100)),
      }))
    )
  }

  const filteredDocs = documents.filter((d) => {
    const q = searchQuery.toLowerCase()
    return (
      d.doc_number?.toLowerCase().includes(q) ||
      d.customer_name?.toLowerCase().includes(q) ||
      d.doc_type?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/40 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-on-surface flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-electric-blue/10 text-electric-blue">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            เอกสารและใบเสนอราคาอัจฉริยะ (Smart Document Studio)
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
            นำเข้าเอกสาร Excel, Word, PDF หรือภาพถ่าย เพื่อแปลงเป็นใบเสนอราคา BOQ หรือร่างหนังสือราชการตามระเบียบสารบรรณอัตโนมัติ
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center bg-surface-container-high p-1 rounded-xl border border-outline-variant/50 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('quotations')}
            className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'quotations'
                ? 'bg-surface text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            สร้างใบเสนอราคา / BOQ
          </button>
          <button
            onClick={() => setActiveTab('official')}
            className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'official'
                ? 'bg-surface text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Building2 className="w-4 h-4 text-emerald-500" />
            ร่างหนังสือราชการ
          </button>
          <button
            onClick={() => setActiveTab('archive')}
            className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'archive'
                ? 'bg-surface text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <FileText className="w-4 h-4 text-sky-500" />
            คลังเอกสาร ({documents.length})
          </button>
        </div>
      </div>

      {/* ── TAB 1: SMART QUOTATION / BOQ STUDIO ─────────────────────────────────── */}
      {activeTab === 'quotations' && (
        <div className="space-y-6">
          {/* Dropzone Card */}
          <div className="bg-surface rounded-2xl border border-outline-variant/60 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
                  <UploadCloud className="w-5 h-5 text-electric-blue" />
                  อัปโหลดเอกสารต้นฉบับ (Excel, PDF, Word, รูปภาพ)
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  AI + MarkItDown จะถอดรหัสตารางสินค้า ปริมาณ และราคา ออกมาใส่ฟอร์มให้อัตโนมัติ
                </p>
              </div>

              {/* Quick sample indicator */}
              {quoteFile && (
                <span className="text-xs font-mono bg-electric-blue/10 text-electric-blue px-3 py-1 rounded-full flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  {quoteFile.name}
                </span>
              )}
            </div>

            <label className="border-2 border-dashed border-outline-variant/80 hover:border-electric-blue/60 rounded-xl p-6 sm:p-8 flex flex-col items-center justify-center cursor-pointer transition bg-surface-container-high/30 hover:bg-surface-container-high/60 group">
              <input
                type="file"
                accept=".xlsx,.xls,.pdf,.docx,.doc,.csv,.png,.jpg,.jpeg"
                onChange={handleQuoteUpload}
                disabled={parsingQuote}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-full bg-electric-blue/10 text-electric-blue flex items-center justify-center mb-3 group-hover:scale-110 transition">
                {parsingQuote ? (
                  <RefreshCw className="w-6 h-6 animate-spin" />
                ) : (
                  <UploadCloud className="w-6 h-6" />
                )}
              </div>
              <p className="text-sm font-semibold text-on-surface text-center">
                {parsingQuote ? 'กำลังถอดรหัสเอกสารด้วย MarkItDown...' : 'ลากไฟล์ใบเสนอราคา / BOQ มาวาง หรือคลิกเพื่อเลือก'}
              </p>
              <p className="text-xs text-on-surface-variant mt-1 text-center">
                รองรับไฟล์ .xlsx (BOQ ก่อสร้าง), .pdf, .docx, .csv และภาพถ่ายสเปก
              </p>
            </label>

            {quoteError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{quoteError}</span>
              </div>
            )}
          </div>

          {/* Quotation Editor Sheet */}
          <div className="bg-surface rounded-2xl border border-outline-variant/60 p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant/40 pb-4">
              <div>
                <h3 className="text-base font-bold text-on-surface">ฟอร์มปรับแต่งใบเสนอราคา (Interactive Quotation Editor)</h3>
                <p className="text-xs text-on-surface-variant">
                  ตรวจทานข้อมูลที่ AI สกัดได้ เพิ่มกำไร (Margin) หรือแก้ไขตัวเลขก่อนออกเอกสาร
                </p>
              </div>

              {/* Quick Margin Presets */}
              <div className="flex items-center gap-1.5 bg-surface-container-high p-1 rounded-lg border border-outline-variant/40">
                <span className="text-[11px] text-on-surface-variant px-2 font-medium">บวกกำไร:</span>
                <button
                  onClick={() => handleApplyMargin(5)}
                  className="px-2 py-0.5 rounded text-xs bg-surface text-on-surface hover:bg-surface-container-highest cursor-pointer font-medium"
                >
                  +5%
                </button>
                <button
                  onClick={() => handleApplyMargin(10)}
                  className="px-2 py-0.5 rounded text-xs bg-surface text-on-surface hover:bg-surface-container-highest cursor-pointer font-medium"
                >
                  +10%
                </button>
                <button
                  onClick={() => handleApplyMargin(15)}
                  className="px-2 py-0.5 rounded text-xs bg-surface text-on-surface hover:bg-surface-container-highest cursor-pointer font-medium"
                >
                  +15%
                </button>
                <button
                  onClick={() => handleApplyMargin(20)}
                  className="px-2 py-0.5 rounded text-xs bg-surface text-on-surface hover:bg-surface-container-highest cursor-pointer font-medium"
                >
                  +20%
                </button>
              </div>
            </div>

            {/* Customer Information Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1.5">ชื่อลูกค้า / บริษัท</label>
                <input
                  type="text"
                  value={quoteCustomerName}
                  onChange={(e) => setQuoteCustomerName(e.target.value)}
                  placeholder="เช่น บริษัท สยามคอนสตรัคชั่น จำกัด"
                  className="w-full px-3.5 py-2 rounded-xl border border-outline-variant bg-surface text-xs sm:text-sm text-on-surface focus:outline-electric-blue"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1.5">เบอร์โทรศัพท์</label>
                <input
                  type="text"
                  value={quoteCustomerPhone}
                  onChange={(e) => setQuoteCustomerPhone(e.target.value)}
                  placeholder="081-234-5678"
                  className="w-full px-3.5 py-2 rounded-xl border border-outline-variant bg-surface text-xs sm:text-sm text-on-surface focus:outline-electric-blue"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1.5">ที่อยู่ / หน้างาน</label>
                <input
                  type="text"
                  value={quoteCustomerAddress}
                  onChange={(e) => setQuoteCustomerAddress(e.target.value)}
                  placeholder="เขตจตุจักร กรุงเทพฯ"
                  className="w-full px-3.5 py-2 rounded-xl border border-outline-variant bg-surface text-xs sm:text-sm text-on-surface focus:outline-electric-blue"
                />
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-outline-variant/60 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-surface-container-high border-b border-outline-variant/60 text-on-surface-variant font-semibold">
                  <tr>
                    <th className="py-2.5 px-3 w-8 text-center">#</th>
                    <th className="py-2.5 px-3">รายการสินค้า / วัสดุ</th>
                    <th className="py-2.5 px-3 w-24">หน่วย</th>
                    <th className="py-2.5 px-3 w-28 text-right">จำนวน</th>
                    <th className="py-2.5 px-3 w-36 text-right">ราคาต่อหน่วย (บาท)</th>
                    <th className="py-2.5 px-3 w-36 text-right">รวมเงิน (บาท)</th>
                    <th className="py-2.5 px-3 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40 bg-surface">
                  {quoteItems.map((item, idx) => {
                    const rowTotal = (Number(item.price) || 0) * (Number(item.qty) || 1)
                    return (
                      <tr key={idx} className="hover:bg-surface-container-high/20 transition">
                        <td className="py-2 px-3 text-center text-on-surface-variant">{idx + 1}</td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => {
                              const updated = [...quoteItems]
                              updated[idx].name = e.target.value
                              setQuoteItems(updated)
                            }}
                            placeholder="ระบุชื่อสินค้าหรือสเปก..."
                            className="w-full px-2.5 py-1.5 rounded-lg border border-outline-variant/60 bg-surface text-xs sm:text-sm text-on-surface focus:outline-electric-blue"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={item.unit || ''}
                            onChange={(e) => {
                              const updated = [...quoteItems]
                              updated[idx].unit = e.target.value
                              setQuoteItems(updated)
                            }}
                            placeholder="ชิ้น/ถุง/ม."
                            className="w-full px-2.5 py-1.5 rounded-lg border border-outline-variant/60 bg-surface text-xs sm:text-sm text-on-surface text-center"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => {
                              const updated = [...quoteItems]
                              updated[idx].qty = Math.max(1, Number(e.target.value) || 1)
                              setQuoteItems(updated)
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-outline-variant/60 bg-surface text-xs sm:text-sm text-on-surface text-right font-mono"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.price}
                            onChange={(e) => {
                              const updated = [...quoteItems]
                              updated[idx].price = Math.max(0, Number(e.target.value) || 0)
                              setQuoteItems(updated)
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-outline-variant/60 bg-surface text-xs sm:text-sm text-on-surface text-right font-mono"
                          />
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-on-surface">
                          {rowTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => handleRemoveItem(idx)}
                            className="text-on-surface-variant hover:text-rose-500 transition cursor-pointer p-1"
                            title="ลบแถว"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div className="p-3 bg-surface-container-high/40 border-t border-outline-variant/40 flex justify-between items-center">
                <button
                  onClick={handleAddItem}
                  className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-container-high text-xs font-semibold text-on-surface border border-outline-variant/60 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5 text-electric-blue" />
                  เพิ่มรายการสินค้า
                </button>
                <span className="text-xs text-on-surface-variant">
                  รวม {quoteItems.length} รายการ
                </span>
              </div>
            </div>

            {/* Calculations & Summary Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1.5">เงื่อนไขการชำระเงินและหมายเหตุ</label>
                <textarea
                  rows={4}
                  value={quoteNotes}
                  onChange={(e) => setQuoteNotes(e.target.value)}
                  placeholder="เช่น ยืนราคาภายใน 30 วัน, มัดจำ 50% ก่อนเริ่มงาน, จัดส่งฟรีในเขตกรุงเทพฯ..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface text-xs sm:text-sm text-on-surface focus:outline-electric-blue resize-none"
                />
              </div>

              <div className="bg-surface-container-high/50 rounded-xl p-4 border border-outline-variant/40 space-y-2.5 text-xs sm:text-sm">
                <div className="flex justify-between text-on-surface-variant">
                  <span>ยอดรวมก่อนภาษี (Subtotal):</span>
                  <span className="font-mono font-semibold text-on-surface">
                    {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท
                  </span>
                </div>

                <div className="flex justify-between items-center text-on-surface-variant">
                  <span>ส่วนลด (Discount):</span>
                  <div className="flex items-center gap-1.5 w-32">
                    <input
                      type="number"
                      min="0"
                      value={quoteDiscount}
                      onChange={(e) => setQuoteDiscount(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-2 py-1 rounded border border-outline-variant bg-surface text-right font-mono text-xs"
                    />
                    <span className="text-xs">บ.</span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-on-surface-variant pt-1 border-t border-outline-variant/40">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={quoteApplyVat}
                      onChange={(e) => setQuoteApplyVat(e.target.checked)}
                      className="rounded border-outline-variant text-electric-blue focus:ring-0"
                    />
                    <span>คิดภาษีมูลค่าเพิ่ม (VAT 7%)</span>
                  </label>
                  <span className="font-mono text-on-surface">
                    {vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท
                  </span>
                </div>

                <div className="flex justify-between text-sm sm:text-base font-bold text-on-surface pt-2 border-t border-outline-variant/60">
                  <span>ยอดสุทธิทั้งสิ้น (Total):</span>
                  <span className="font-mono text-electric-blue text-lg">
                    {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท
                  </span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-outline-variant/40">
              <div className="flex items-center gap-2">
                {quoteSavedUrl && (
                  <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3.5 py-1.5 rounded-xl text-xs font-semibold">
                    <Check className="w-4 h-4" />
                    <span>บันทึกเรียบร้อย!</span>
                    <a
                      href={quoteSavedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-2 underline flex items-center gap-1 hover:text-emerald-900"
                    >
                      เปิดดูเอกสาร <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                {quoteSavedUrl && (
                  <button
                    onClick={() => {
                      const fullUrl = `${window.location.origin}${quoteSavedUrl}`
                      navigator.clipboard.writeText(fullUrl)
                      setCopiedLink(true)
                      setTimeout(() => setCopiedLink(false), 2500)
                    }}
                    className="px-4 py-2.5 rounded-xl border border-outline-variant bg-surface hover:bg-surface-container-high text-xs sm:text-sm font-semibold text-on-surface flex items-center gap-2 cursor-pointer shadow-2xs"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? 'คัดลอกลิงก์แล้ว' : 'คัดลอกลิงก์ส่ง LINE'}</span>
                  </button>
                )}

                <button
                  onClick={handleSaveQuotation}
                  disabled={quoteSaving || quoteItems.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-electric-blue hover:bg-primary text-white text-xs sm:text-sm font-bold shadow-sm transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {quoteSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                  <span>{quoteSaving ? 'กำลังบันทึก...' : 'บันทึกและสร้างใบเสนอราคา (PDF)'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: GOVTECH & OFFICIAL LETTER SCRIBE ─────────────────────────────── */}
      {activeTab === 'official' && (
        <div className="space-y-6">
          <div className="bg-surface rounded-2xl border border-outline-variant/60 p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-600" />
                ระบบร่างหนังสือราชการและเอกสารทางการ (GovTech Official Scribe)
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                อัปโหลด "หนังสือต้นเรื่อง" (เช่น หนังสือขออนุญาต, หนังสือสั่งการ) แล้วให้ AI ร่างหนังสือตอบรับหรือคำสั่งตามระเบียบงานสารบรรณ
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">เทมเพลตมาตรฐาน</label>
                <select className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-xs sm:text-sm text-on-surface">
                  <option value="external_letter">หนังสือราชการภายนอก (ตราครุฑ)</option>
                  <option value="internal_memo">บันทึกข้อความภายใน</option>
                  <option value="order">คำสั่งการ / ประกาศ</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-on-surface mb-1">คำสั่งหรือเงื่อนไขเพิ่มเติม (Prompt Directions)</label>
                <input
                  type="text"
                  value={letterInstructions}
                  onChange={(e) => setLetterInstructions(e.target.value)}
                  placeholder="เช่น เห็นชอบอนุญาต แต่ต้องรื้อถอนและรักษาความสะอาดทันทีหลังเสร็จงาน..."
                  className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-xs sm:text-sm text-on-surface focus:outline-emerald-500"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <input
                type="file"
                accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
                onChange={(e) => setLetterFile(e.target.files?.[0] || null)}
                className="flex-1 text-xs text-on-surface-variant file:mr-3 file:px-3.5 file:py-2 file:rounded-xl file:border-0 file:bg-surface-container-high file:text-on-surface file:text-xs file:font-semibold file:cursor-pointer"
              />
              <button
                onClick={handleDraftLetter}
                disabled={draftingLetter || !letterFile}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-sm transition disabled:opacity-50 flex items-center gap-2 cursor-pointer shrink-0"
              >
                {draftingLetter ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>{draftingLetter ? 'กำลังร่างหนังสือราชการ...' : 'วิเคราะห์และร่างหนังสือ'}</span>
              </button>
            </div>

            {letterError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{letterError}</span>
              </div>
            )}
          </div>

          {/* Official Letter Split View Preview */}
          {letterDraft && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Form Editor */}
              <div className="bg-surface rounded-2xl border border-outline-variant/60 p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-on-surface flex items-center justify-between border-b border-outline-variant/40 pb-3">
                  <span>แก้ไขข้อมูลในหนังสือราชการ</span>
                  <span className="text-[11px] font-normal text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    AI Auto-drafted
                  </span>
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">ที่ (เลขที่หนังสือ)</label>
                    <input
                      type="text"
                      value={letterDraft.doc_number}
                      onChange={(e) => setLetterDraft({ ...letterDraft, doc_number: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-outline-variant bg-surface text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">ส่วนราชการ / องค์กร</label>
                    <input
                      type="text"
                      value={letterDraft.department}
                      onChange={(e) => setLetterDraft({ ...letterDraft, department: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-outline-variant bg-surface text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">เรื่อง</label>
                  <input
                    type="text"
                    value={letterDraft.subject}
                    onChange={(e) => setLetterDraft({ ...letterDraft, subject: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-outline-variant bg-surface text-xs font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">เรียน (ผู้รับ)</label>
                    <input
                      type="text"
                      value={letterDraft.recipient}
                      onChange={(e) => setLetterDraft({ ...letterDraft, recipient: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-outline-variant bg-surface text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">อ้างถึง (ถ้ามี)</label>
                    <input
                      type="text"
                      value={letterDraft.reference_to}
                      onChange={(e) => setLetterDraft({ ...letterDraft, reference_to: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-outline-variant bg-surface text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">๑. ย่อหน้าข้อเท็จจริง (ต้นเรื่อง)</label>
                  <textarea
                    rows={3}
                    value={letterDraft.body_facts}
                    onChange={(e) => setLetterDraft({ ...letterDraft, body_facts: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface text-xs leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">๒. ย่อหน้าข้อพิจารณาและการตัดสินใจ</label>
                  <textarea
                    rows={3}
                    value={letterDraft.body_considerations}
                    onChange={(e) => setLetterDraft({ ...letterDraft, body_considerations: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface text-xs leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">๓. ย่อหน้าคำสั่งการ / การอนุญาต / สรุป</label>
                  <textarea
                    rows={2}
                    value={letterDraft.body_resolution}
                    onChange={(e) => setLetterDraft({ ...letterDraft, body_resolution: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface text-xs leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">ผู้ลงนาม</label>
                    <input
                      type="text"
                      value={letterDraft.signatory_name}
                      onChange={(e) => setLetterDraft({ ...letterDraft, signatory_name: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-outline-variant bg-surface text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">ตำแหน่ง</label>
                    <input
                      type="text"
                      value={letterDraft.signatory_position}
                      onChange={(e) => setLetterDraft({ ...letterDraft, signatory_position: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-outline-variant bg-surface text-xs"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-outline-variant/40 flex justify-end gap-2">
                  <button
                    onClick={handleSaveLetter}
                    disabled={letterSaving}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    {letterSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>{letterSaving ? 'กำลังบันทึก...' : 'บันทึกและออกลิงก์เอกสารทางการ'}</span>
                  </button>
                </div>
              </div>

              {/* Right Column: Live A4 Visual Preview */}
              <div className="bg-surface rounded-2xl border border-outline-variant/60 p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-outline-variant/40 pb-3 mb-4">
                    <span className="text-xs font-bold text-on-surface">พรีวิวรูปแบบหนังสือราชการมาตรฐาน (A4 Preview)</span>
                    {letterSavedUrl && (
                      <a
                        href={letterSavedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1"
                      >
                        เปิดหน้าพิมพ์เต็มจอ <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {/* Visual Paper Simulation */}
                  <div className="bg-white text-gray-900 border border-gray-300 rounded p-8 font-serif shadow-xs text-xs leading-relaxed space-y-4 select-none">
                    <div className="text-center">
                      <div className="w-8 h-8 rounded-full bg-red-900 text-amber-400 mx-auto flex items-center justify-center font-bold text-[10px]">
                        ครุฑ
                      </div>
                      <span className="text-[9px] text-gray-400">ตราครุฑ</span>
                    </div>

                    <div className="flex justify-between">
                      <span><strong>ที่</strong> {letterDraft.doc_number}</span>
                      <span className="text-right"><strong>{letterDraft.department}</strong></span>
                    </div>

                    <div className="text-center">
                      <span>{letterDraft.date_str}</span>
                    </div>

                    <div className="space-y-1">
                      <p><strong>เรื่อง</strong>&nbsp;&nbsp;{letterDraft.subject}</p>
                      <p><strong>เรียน</strong>&nbsp;&nbsp;{letterDraft.recipient}</p>
                      {letterDraft.reference_to && <p><strong>อ้างถึง</strong>&nbsp;&nbsp;{letterDraft.reference_to}</p>}
                    </div>

                    <div className="space-y-2 text-justify">
                      <p className="indent-6">{letterDraft.body_facts}</p>
                      <p className="indent-6">{letterDraft.body_considerations}</p>
                      <p className="indent-6">{letterDraft.body_resolution}</p>
                    </div>

                    <div className="w-1/2 ml-auto text-center pt-4 space-y-4">
                      <p>ขอแสดงความนับถือ</p>
                      <div className="pt-2">
                        <p className="font-bold">{letterDraft.signatory_name}</p>
                        <p className="text-[10px] text-gray-500">{letterDraft.signatory_position}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-outline-variant/40 text-[11px] text-on-surface-variant flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  <span>สามารถบันทึกเพื่อนำลิงก์ไปพิมพ์ด้วยฟอนต์ TH Sarabun 16pt พร้อมระยะขอบ 3 ซม. มาตรฐานได้ทันที</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: ARCHIVE & DOCUMENTS LIST ─────────────────────────────────────── */}
      {activeTab === 'archive' && (
        <div className="bg-surface rounded-2xl border border-outline-variant/60 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
                <FileText className="w-5 h-5 text-sky-500" />
                คลังเอกสารและประวัติใบเสนอราคา ({filteredDocs.length} ฉบับ)
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                ดูตัวอย่าง คัดลอกลิงก์ส่งลูกค้าใน LINE หรือพิมพ์เอกสารทางการ
              </p>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-on-surface-variant absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาเลขที่, ชื่อลูกค้า..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-outline-variant bg-surface text-xs text-on-surface focus:outline-electric-blue"
              />
            </div>
          </div>

          {filteredDocs.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-outline-variant/40 rounded-xl">
              <FileSpreadsheet className="w-10 h-10 text-on-surface-variant/40 mx-auto mb-2" />
              <p className="text-sm font-semibold text-on-surface">ยังไม่มีเอกสารในระบบ</p>
              <p className="text-xs text-on-surface-variant mt-1">
                คลิกแท็บ &quot;สร้างใบเสนอราคา / BOQ&quot; หรือ &quot;ร่างหนังสือราชการ&quot; ด้านบนเพื่อเริ่มสร้างเอกสารฉบับแรก
              </p>
            </div>
          ) : (
            <div className="border border-outline-variant/60 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-surface-container-high border-b border-outline-variant/60 text-on-surface-variant font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">เลขที่เอกสาร</th>
                    <th className="py-2.5 px-3">ประเภท</th>
                    <th className="py-2.5 px-3">ลูกค้า / ผู้รับ</th>
                    <th className="py-2.5 px-3 text-right">ยอดเงิน</th>
                    <th className="py-2.5 px-3">วันที่สร้าง</th>
                    <th className="py-2.5 px-3 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40 bg-surface">
                  {filteredDocs.map((doc) => {
                    const isQuotation = doc.doc_type === 'quotation'
                    const docUrl = isQuotation ? `/doc/quotation/${doc.id}` : `/doc/official/${doc.id}`

                    return (
                      <tr key={doc.id} className="hover:bg-surface-container-high/20 transition">
                        <td className="py-3 px-3 font-mono font-bold text-on-surface">
                          {doc.doc_number}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                              isQuotation
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {isQuotation ? 'ใบเสนอราคา (Quotation)' : 'หนังสือราชการ (Official)'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-on-surface font-medium">
                          {doc.customer_name || '-'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-on-surface">
                          {isQuotation && doc.total_amount
                            ? `${Number(doc.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} บ.`
                            : '-'}
                        </td>
                        <td className="py-3 px-3 text-on-surface-variant text-xs flex items-center gap-1 pt-3.5">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(doc.created_at).toLocaleDateString('th-TH')}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <a
                              href={docUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg text-on-surface-variant hover:text-electric-blue hover:bg-surface-container-high transition"
                              title="เปิดดูเอกสาร / สั่งพิมพ์"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                            <button
                              onClick={() => {
                                const fullUrl = `${window.location.origin}${docUrl}`
                                navigator.clipboard.writeText(fullUrl)
                                alert('คัดลอกลิงก์เรียบร้อยแล้ว สามารถส่งให้ลูกค้าในแชตได้ทันที')
                              }}
                              className="p-1.5 rounded-lg text-on-surface-variant hover:text-emerald-600 hover:bg-surface-container-high transition cursor-pointer"
                              title="คัดลอกลิงก์ส่งแชท"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteDoc(doc.id)}
                              className="p-1.5 rounded-lg text-on-surface-variant hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              title="ลบเอกสาร"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
