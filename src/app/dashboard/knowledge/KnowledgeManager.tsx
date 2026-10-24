'use client'

import { useState, useRef } from 'react'
import {
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  Search,
  X,
  Save,
  RefreshCw,
  Globe,
  UploadCloud,
  FileText,
  HelpCircle,
  Package,
  ShieldCheck,
  Lightbulb,
  Trophy,
  Coins,
  Calendar,
  PauseCircle,
  ArrowRight,
  Bot,
  User,
  ExternalLink,
  Layers,
  FileSpreadsheet,
  FileType,
} from 'lucide-react'
import {
  createKnowledgeItem,
  deleteKnowledgeItem,
  approveDraftFaq,
  updateKnowledgeItem,
  triggerChatFaqScan,
  deleteTrajectory,
  toggleTrajectoryStatus,
  triggerScanGoldenClosers,
  importKnowledgeFromUrl,
  importKnowledgeFromFile,
} from './actions'

export interface KnowledgeItem {
  id: string
  shop_id: string
  title: string
  content: string
  category: string
  status: string
  source?: string | null
  source_ref?: string | null
  created_at: string
}

export interface GoldenTrajectory {
  id: string
  shop_id: string
  conversation_id: string | null
  order_id: string | null
  customer_objection_type: string
  customer_intent_summary: string
  winning_turn_dialogue: Array<{ sender: 'customer' | 'bot' | 'agent'; text: string }>
  closing_technique: string
  revenue: number
  status: 'active' | 'archived'
  created_at: string
}

export default function KnowledgeManager({
  items,
  trajectories = [],
}: {
  items: KnowledgeItem[]
  trajectories?: GoldenTrajectory[]
}) {
  const [isOpenModal, setIsOpenModal] = useState(false)
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [scanningChat, setScanningChat] = useState(false)
  const [scanningClosers, setScanningClosers] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Auto-import states
  const [importTab, setImportTab] = useState<'file' | 'url' | 'ai'>('file')
  const [importing, setImporting] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const draftsCount = items.filter((i) => i.status === 'draft' || i.source === 'ai_synthesis').length
  const totalCharacters = items.reduce((acc, curr) => acc + (curr.content?.length || 0), 0)

  const faqCount = items.filter((i) => i.category === 'faq').length
  const productCount = items.filter((i) => i.category === 'product').length
  const policyCount = items.filter((i) => i.category === 'policy').length
  const generalCount = items.filter(
    (i) => i.category === 'general' || (!['faq', 'product', 'policy'].includes(i.category))
  ).length

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.content.toLowerCase().includes(searchTerm.toLowerCase())
    if (selectedCategory === 'draft') {
      return (item.status === 'draft' || item.source === 'ai_synthesis') && matchesSearch
    }
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  async function handleApprove(id: string) {
    setLoading(true)
    setMessage(null)
    const res = await approveDraftFaq(id)
    setLoading(false)
    if (res?.error) {
      setMessage({ type: 'error', text: res.error })
    } else if (res?.success) {
      setMessage({ type: 'success', text: res.success })
    }
  }

  async function handleScanChat() {
    setScanningChat(true)
    setMessage(null)
    const res = await triggerChatFaqScan()
    setScanningChat(false)
    if (res?.error) {
      setMessage({ type: 'error', text: res.error })
    } else if (res?.success) {
      setMessage({ type: 'success', text: res.success })
    }
  }

  async function handleScanGoldenClosers() {
    setScanningClosers(true)
    setMessage(null)
    const res = await triggerScanGoldenClosers()
    setScanningClosers(false)
    if (res?.error) {
      setMessage({ type: 'error', text: res.error })
    } else if (res?.success) {
      setMessage({ type: 'success', text: res.success })
    }
  }

  async function handleToggleTrajectory(id: string, currentStatus: string) {
    setLoading(true)
    setMessage(null)
    const res = await toggleTrajectoryStatus(id, currentStatus)
    setLoading(false)
    if (res?.error) {
      setMessage({ type: 'error', text: res.error })
    } else if (res?.success) {
      setMessage({ type: 'success', text: res.success })
    }
  }

  async function handleDeleteTrajectory(id: string) {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบตัวอย่างบทสนทนาปิดการขายนี้?')) return
    setLoading(true)
    setMessage(null)
    const res = await deleteTrajectory(id)
    setLoading(false)
    if (res?.error) {
      setMessage({ type: 'error', text: res.error })
    } else if (res?.success) {
      setMessage({ type: 'success', text: res.success })
    }
  }

  async function handleEditSubmit(formData: FormData) {
    if (!editingItem) return
    setLoading(true)
    setMessage(null)
    const res = await updateKnowledgeItem(editingItem.id, formData)
    setLoading(false)
    if (res?.error) {
      setMessage({ type: 'error', text: res.error })
    } else if (res?.success) {
      setMessage({ type: 'success', text: res.success })
      setEditingItem(null)
    }
  }

  async function handleAddSubmit(formData: FormData) {
    setLoading(true)
    setMessage(null)
    const res = await createKnowledgeItem(formData)
    setLoading(false)
    if (res?.error) {
      setMessage({ type: 'error', text: res.error })
    } else if (res?.success) {
      setMessage({ type: 'success', text: res.success })
      setIsOpenModal(false)
    }
  }

  async function handleImport(formData: FormData, run: (fd: FormData) => Promise<any>) {
    setImporting(true)
    setMessage(null)
    const res = await run(formData)
    setImporting(false)
    if (res?.error) {
      setMessage({ type: 'error', text: res.error })
    } else if (res?.success) {
      setMessage({ type: 'success', text: res.success })
      setImportUrl('')
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลชุดนี้?')) return
    setLoading(true)
    const res = await deleteKnowledgeItem(id)
    setLoading(false)
    if (res?.error) {
      alert(res.error)
    }
  }

  const categoryLabel = (cat: string) => {
    switch (cat) {
      case 'faq':
        return { label: 'ถาม-ตอบ (FAQ)', icon: HelpCircle }
      case 'product':
        return { label: 'สินค้า/บริการ', icon: Package }
      case 'policy':
        return { label: 'เงื่อนไข/นโยบาย', icon: ShieldCheck }
      default:
        return { label: 'ข้อมูลทั่วไป', icon: Lightbulb }
    }
  }

  const categoryBadgeColor = (cat: string) => {
    switch (cat) {
      case 'faq':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
      case 'product':
        return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
      case 'policy':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
    }
  }

  const objectionBadge = (obj: string) => {
    switch (obj) {
      case 'price_hesitation':
        return {
          label: '💰 ลังเลราคา/ขอส่วนลด',
          color:
            'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
        }
      case 'product_comparison':
        return {
          label: '⚖️ เปรียบเทียบสินค้า/รุ่น',
          color:
            'bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
        }
      case 'shipping_doubt':
        return {
          label: '🚚 การจัดส่ง/รอบส่ง',
          color:
            'bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
        }
      case 'trust_building':
        return {
          label: '🛡️ ความมั่นใจ/รับประกัน',
          color:
            'bg-indigo-50 text-indigo-800 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
        }
      case 'urgency_promotion':
        return {
          label: '🎁 โปรโมชั่น/ของแถม',
          color:
            'bg-pink-50 text-pink-800 border-pink-300 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800',
        }
      default:
        return {
          label: '🛍️ ปิดการขายทั่วไป',
          color:
            'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
        }
    }
  }

  return (
    <div className="flex flex-col w-full relative space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-heading text-xl sm:text-2xl font-semibold text-on-surface tracking-tight">
              คลังความรู้ AI (Knowledge Base)
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              RAG 2.0
            </span>
          </div>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
            เพิ่มข้อมูลเอกสาร ถาม-ตอบ หรือเงื่อนไขร้านค้า เพื่อให้ AI นำไปใช้อ้างอิงตอบคำถามลูกค้าได้อย่างแม่นยำ 24 ชม.
          </p>
        </div>

        <button
          onClick={() => setIsOpenModal(true)}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-xl transition-all shadow-sm shadow-blue-500/20 hover:-translate-y-0.5 cursor-pointer shrink-0 text-xs sm:text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มข้อมูลใหม่</span>
        </button>
      </div>

      {/* ── Alert / Toast Notification ── */}
      {message && (
        <div
          className={`p-4 rounded-xl text-xs sm:text-sm flex items-center justify-between transition-all ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <p className="font-medium">{message.text}</p>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Smart Ingestion Hub (ศูนย์นำเข้าข้อมูลอัจฉริยะ) ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        {/* Hub Header with Segmented Tabs */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-heading text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
                นำเข้าข้อมูลอัตโนมัติ (Smart Ingestion)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                ดึงข้อมูลจากเอกสาร เว็บไซต์ หรือบทสนทนาจริง ให้ AI แปลงเป็นชุดความรู้พร้อมตอบทันที
              </p>
            </div>
          </div>

          {/* Import Channel Tabs */}
          <div className="flex items-center gap-1 bg-slate-200/60 dark:bg-slate-800/80 p-1 rounded-xl shrink-0 self-start md:self-auto">
            <button
              onClick={() => setImportTab('file')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                importTab === 'file'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>อัปโหลดเอกสาร</span>
            </button>
            <button
              onClick={() => setImportTab('url')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                importTab === 'url'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>ดึงจากเว็บ</span>
            </button>
            <button
              onClick={() => setImportTab('ai')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                importTab === 'ai'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>สแกนแชทจริง</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Universal Document Upload (MarkItDown) */}
        {importTab === 'file' && (
          <div className="p-5 sm:p-6 space-y-4">
            <form action={(fd) => handleImport(fd, importKnowledgeFromFile)} className="space-y-4">
              <input
                type="file"
                name="file"
                ref={fileInputRef}
                accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.csv,.md,.markdown,.txt,.png,.jpg,.jpeg,.webp"
                disabled={importing}
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="hidden"
                id="kb-file-upload"
              />

              {!selectedFile ? (
                <label
                  htmlFor="kb-file-upload"
                  className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-slate-50/50 hover:bg-blue-50/20 dark:bg-slate-900/30 group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <h3 className="font-heading text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200">
                    คลิกเพื่อเลือกไฟล์เอกสาร หรือลากไฟล์มาวางที่นี่
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                    ระบบจะใช้เทคโนโลยี MarkItDown ถอดตารางราคา สเปกสินค้า และแปลงเป็นคำถาม-คำตอบ (FAQ) ให้ AI โดยอัตโนมัติ
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-1.5 mt-4">
                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300">
                      PDF
                    </span>
                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300">
                      Word (.docx)
                    </span>
                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                      Excel (.xlsx, .csv)
                    </span>
                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/40 dark:text-teal-300">
                      Markdown (.md, .txt)
                    </span>
                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300">
                      PowerPoint (.pptx)
                    </span>
                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300">
                      รูปภาพ / สแกน
                    </span>
                  </div>
                </label>
              ) : (
                <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        ขนาด {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • พร้อมแปลงข้อมูล
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null)
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                      className="px-3 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      disabled={importing}
                    >
                      เปลี่ยนไฟล์
                    </button>
                    <button
                      type="submit"
                      disabled={importing}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                    >
                      {importing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>กำลังอ่านเอกสาร & แปลงข้อมูล...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>แปลงไฟล์เข้าคลังความรู้</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        )}

        {/* Tab 2: Web URL Ingestion */}
        {importTab === 'url' && (
          <div className="p-5 sm:p-6 space-y-4">
            <form action={(fd) => handleImport(fd, importKnowledgeFromUrl)} className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    name="url"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    placeholder="https://ร้านค้าของคุณ.com/about-us หรือ /faq"
                    required
                    disabled={importing}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={importing}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold shadow-sm shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  {importing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>กำลังดูดข้อมูลเว็บ...</span>
                    </>
                  ) : (
                    <>
                      <span>ดึงข้อมูลจากเว็บไซต์</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">💡 แนะนำ:</span>
                <span>ใส่ลิงก์หน้า FAQ, หน้าเงื่อนไขการจัดส่ง, ข้อมูลสินค้า, หรือหน้ารายละเอียดร้านค้า</span>
              </div>
            </form>
          </div>
        )}

        {/* Tab 3: Continuous Learning & Sales Extraction */}
        {importTab === 'ai' && (
          <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* AI Action 1: Chat FAQ Discovery */}
            <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 flex flex-col justify-between space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>สแกนแชทหา FAQ ใหม่ (Hermes Learning)</span>
                  </span>
                  {draftsCount > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                      {draftsCount} ร่างรออนุมัติ
                    </span>
                  )}
                </div>
                <p className="text-xs text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                  AI วิเคราะห์ประวัติแชทจริงเมื่อลูกค้าถามคำถามใหม่ๆ หรือเมื่อแอดมินคนจริงตอบแชท เพื่อสกัดเป็นชุดถาม-ตอบให้ตรวจสอบ
                </p>
              </div>

              <button
                onClick={handleScanChat}
                disabled={scanningChat || loading}
                className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2 rounded-lg transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${scanningChat ? 'animate-spin' : ''}`} />
                <span>{scanningChat ? 'กำลังสแกนแชท...' : 'สแกนแชทหา FAQ ตอนนี้'}</span>
              </button>
            </div>

            {/* AI Action 2: Golden Closers Synthesis */}
            <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/40 dark:bg-purple-950/20 flex flex-col justify-between space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-purple-600" />
                    <span>ถอดรหัสบทสนทนาปิดการขาย (Golden Closers)</span>
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-200 text-purple-900 dark:bg-purple-900 dark:text-purple-200">
                    {trajectories.length} สคริปต์
                  </span>
                </div>
                <p className="text-xs text-purple-800/80 dark:text-purple-300/80 leading-relaxed">
                  สแกนออเดอร์ที่ลูกค้าเคยลังเลแล้วชำระเงินสำเร็จ เพื่อนำสคริปต์เทคนิคปิดการขายมาเป็นตัวอย่างให้ AI ใช้เลียนแบบในแชทสด
                </p>
              </div>

              <button
                onClick={handleScanGoldenClosers}
                disabled={scanningClosers || loading}
                className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-2 rounded-lg transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${scanningClosers ? 'animate-spin' : ''}`} />
                <span>{scanningClosers ? 'กำลังถอดรหัสสคริปต์...' : 'สแกนออเดอร์ถอดรหัสขาย'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 3-Column Metrics Stats Grid (Fit cleanly without overflow) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Metric 1: Total Knowledge Items */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between min-h-[120px] overflow-hidden group">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
              ข้อมูลทั้งหมด
            </span>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <BookOpen className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
            </div>
          </div>

          <div className="my-1.5 flex items-baseline gap-1.5">
            <span className="font-heading text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
              {items.length}
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              รายการ
            </span>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
              FAQ {faqCount} • สินค้า {productCount} • เงื่อนไข {policyCount}
            </p>
          </div>
        </div>

        {/* Metric 2: RAG Status */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between min-h-[120px] overflow-hidden group">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
              สถานะ RAG
            </span>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
            </div>
          </div>

          <div className="my-1.5 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-heading text-xl sm:text-2xl font-semibold text-emerald-600 dark:text-emerald-400 tracking-tight">
              พร้อมใช้งาน
            </span>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
              ซิงค์เรียลไทม์กับบอท LINE & FB
            </p>
          </div>
        </div>

        {/* Metric 3: Total Characters */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between min-h-[120px] overflow-hidden group">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
              รวมตัวอักษร
            </span>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Sparkles className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
            </div>
          </div>

          <div className="my-1.5 flex items-baseline gap-1.5">
            <span className="font-heading text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
              {totalCharacters.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              ตัวอักษร
            </span>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
              ~{Math.round(totalCharacters / 4).toLocaleString()} Tokens ในสมอง AI
            </p>
          </div>
        </div>
      </div>

      {/* ── Main Data View (Search, Filters, and Knowledge Cards) ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden flex flex-col">
        {/* Search & Category Filter Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
          {/* Search Bar */}
          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาหัวข้อ หรือเนื้อหาคำตอบ..."
              className="w-full pl-10 pr-8 py-2 text-xs sm:text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border shrink-0 cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60'
              }`}
            >
              ทั้งหมด ({items.length})
            </button>
            <button
              onClick={() => setSelectedCategory('faq')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border shrink-0 cursor-pointer ${
                selectedCategory === 'faq'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60'
              }`}
            >
              ❓ ถาม-ตอบ ({faqCount})
            </button>
            <button
              onClick={() => setSelectedCategory('product')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border shrink-0 cursor-pointer ${
                selectedCategory === 'product'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60'
              }`}
            >
              📦 สินค้า ({productCount})
            </button>
            <button
              onClick={() => setSelectedCategory('policy')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border shrink-0 cursor-pointer ${
                selectedCategory === 'policy'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60'
              }`}
            >
              📜 เงื่อนไข ({policyCount})
            </button>
            <button
              onClick={() => setSelectedCategory('general')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border shrink-0 cursor-pointer ${
                selectedCategory === 'general'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60'
              }`}
            >
              💡 ทั่วไป ({generalCount})
            </button>

            {draftsCount > 0 && (
              <button
                onClick={() => setSelectedCategory('draft')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all border shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  selectedCategory === 'draft'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                    : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>ร่างจาก AI ({draftsCount})</span>
              </button>
            )}

            <button
              onClick={() => setSelectedCategory('closers')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all border shrink-0 flex items-center gap-1.5 cursor-pointer ${
                selectedCategory === 'closers'
                  ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                  : 'bg-purple-50 text-purple-800 border-purple-300 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>🏆 ปิดการขายจริง ({trajectories.length})</span>
            </button>
          </div>
        </div>

        {/* ── Banner: Golden Closers View ── */}
        {selectedCategory === 'closers' && (
          <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-50/80 to-indigo-50/80 dark:from-purple-950/30 dark:to-indigo-950/20 border-b border-purple-200 dark:border-purple-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0 mt-0.5">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-purple-900 dark:text-purple-200 flex items-center gap-2">
                  <span>ถอดรหัสบทสนทนาปิดการขาย (Golden Closers)</span>
                  <span className="text-[10px] bg-purple-200 text-purple-900 dark:bg-purple-900 dark:text-purple-200 px-2 py-0.5 rounded-full font-bold">
                    {trajectories.filter((t) => t.status === 'active').length} สคริปต์ใช้งานอยู่
                  </span>
                </h4>
                <p className="text-xs text-purple-800/80 dark:text-purple-300/80 mt-0.5">
                  ระบบถอดรหัสจังหวะที่ลูกค้าลังเลแล้วบอทหรือแอดมินตอบจนปิดยอดโอนเงินได้สำเร็จ เพื่อนำมาสอน AI เป็นตัวอย่างเลียนแบบไหวพริบการขายแบบเรียลไทม์
                </p>
              </div>
            </div>

            <button
              onClick={handleScanGoldenClosers}
              disabled={scanningClosers || loading}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-xs cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanningClosers ? 'animate-spin' : ''}`} />
              <span>{scanningClosers ? 'กำลังถอดรหัสสคริปต์...' : 'สแกนออเดอร์ถอดรหัสขาย'}</span>
            </button>
          </div>
        )}

        {/* ── Banner: Drafts FAQ View ── */}
        {selectedCategory === 'draft' && (
          <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-50/80 to-orange-50/80 dark:from-amber-950/30 dark:to-orange-950/20 border-b border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                  <span>คำถามแนะนำจาก AI (Continuous Learning)</span>
                  <span className="text-[10px] bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200 px-2 py-0.5 rounded-full font-bold">
                    {draftsCount} รายการรออนุมัติ
                  </span>
                </h4>
                <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                  AI วิเคราะห์บทสนทนาจริงเมื่อลูกค้าถามคำถามใหม่ๆ หรือเมื่อแอดมินตอบแชท เพื่อสกัดเป็น FAQ พร้อมใช้ คุณสามารถตรวจสอบ แก้ไข หรือกดอนุมัติเข้าคลังได้ทันที
                </p>
              </div>
            </div>

            <button
              onClick={handleScanChat}
              disabled={scanningChat || loading}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-xs cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanningChat ? 'animate-spin' : ''}`} />
              <span>{scanningChat ? 'กำลังสแกนแชท...' : 'สแกนแชทหา FAQ ตอนนี้'}</span>
            </button>
          </div>
        )}

        {/* ── Content View: Closers or Knowledge Items ── */}
        {selectedCategory === 'closers' ? (
          trajectories.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {trajectories.map((traj) => {
                const badge = objectionBadge(traj.customer_objection_type)
                const isActive = traj.status === 'active'
                return (
                  <div
                    key={traj.id}
                    className={`p-5 sm:p-6 transition-colors flex flex-col gap-3.5 ${
                      isActive
                        ? 'bg-white hover:bg-slate-50/50 dark:bg-slate-900 dark:hover:bg-slate-800/40'
                        : 'bg-slate-50/60 dark:bg-slate-900/30 opacity-75'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-0.5 text-xs font-bold rounded-md border ${badge.color}`}>
                          {badge.label}
                        </span>
                        {traj.revenue > 0 && (
                          <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1.5">
                            <Coins className="w-3.5 h-3.5" />
                            <span>ปิดยอดได้ {Number(traj.revenue).toLocaleString()} ฿</span>
                          </span>
                        )}
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          เทคนิค:{' '}
                          <strong className="text-slate-800 dark:text-slate-200">{traj.closing_technique}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          onClick={() => handleToggleTrajectory(traj.id, traj.status)}
                          disabled={loading}
                          className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all border flex items-center gap-1.5 cursor-pointer ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                              : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {isActive ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>ใช้งานอยู่</span>
                            </>
                          ) : (
                            <>
                              <PauseCircle className="w-3.5 h-3.5" />
                              <span>พักไว้</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteTrajectory(traj.id)}
                          disabled={loading}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-all cursor-pointer"
                          title="ลบตัวอย่างนี้"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                        💡 บริบท/สิ่งที่ลูกค้าถาม:{' '}
                        <span className="font-normal text-slate-600 dark:text-slate-400">
                          {traj.customer_intent_summary}
                        </span>
                      </p>
                    </div>

                    {/* Dialogue Turns Box */}
                    {Array.isArray(traj.winning_turn_dialogue) && traj.winning_turn_dialogue.length > 0 && (
                      <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5 text-xs">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          บทสนทนาจริงที่ปิดการขายได้ (Winning Dialogue Turns):
                        </div>
                        {traj.winning_turn_dialogue.map((turn, idx) => (
                          <div
                            key={idx}
                            className={`flex gap-2.5 items-start ${
                              turn.sender === 'customer'
                                ? 'text-slate-700 dark:text-slate-300'
                                : 'text-purple-900 dark:text-purple-200 font-medium'
                            }`}
                          >
                            <span className="font-bold shrink-0 flex items-center gap-1">
                              {turn.sender === 'customer' ? (
                                <>
                                  <User className="w-3.5 h-3.5 text-slate-500" />
                                  <span>ลูกค้า:</span>
                                </>
                              ) : (
                                <>
                                  <Bot className="w-3.5 h-3.5 text-purple-600" />
                                  <span>พนักงานขาย:</span>
                                </>
                              )}
                            </span>
                            <span className="leading-relaxed whitespace-pre-line">{turn.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="w-14 h-14 bg-purple-50 dark:bg-purple-950/60 rounded-2xl flex items-center justify-center mb-3 text-purple-600 dark:text-purple-400">
                <Trophy className="w-7 h-7" />
              </div>
              <h3 className="font-heading text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
                ยังไม่มีบทสนทนาปิดการขาย (Golden Closers)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-5">
                เมื่อมีลูกค้าสั่งซื้อและชำระเงินสำเร็จ ระบบจะถอดรหัสจังหวะปิดการขายมาเป็นตัวอย่างให้ AI โดยอัตโนมัติ หรือกดสแกนออเดอร์เดิมได้เลย
              </p>
              <button
                onClick={handleScanGoldenClosers}
                disabled={scanningClosers || loading}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm text-xs cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${scanningClosers ? 'animate-spin' : ''}`} />
                <span>{scanningClosers ? 'กำลังถอดรหัสสคริปต์...' : 'สแกนออเดอร์ถอดรหัสขาย'}</span>
              </button>
            </div>
          )
        ) : filteredItems.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredItems.map((item) => {
              const isDraft = item.status === 'draft' || item.source === 'ai_synthesis'
              const catMeta = categoryLabel(item.category)
              const CatIcon = catMeta.icon

              return (
                <div
                  key={item.id}
                  className={`p-4 sm:p-5 transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4 ${
                    isDraft
                      ? 'bg-amber-50/40 dark:bg-amber-950/10 hover:bg-amber-50/70 border-l-4 border-l-amber-500'
                      : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                  }`}
                >
                  <div className="space-y-2 max-w-3xl w-full min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isDraft ? (
                          <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-md bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-700 flex items-center gap-1 shrink-0">
                            <Sparkles className="w-3 h-3 text-amber-600" />
                            <span>AI ร่างจากแชทจริง (รออนุมัติ)</span>
                          </span>
                        ) : (
                          <span
                            className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md border flex items-center gap-1 shrink-0 ${categoryBadgeColor(
                              item.category
                            )}`}
                          >
                            <CatIcon className="w-3 h-3" />
                            <span>{catMeta.label}</span>
                          </span>
                        )}

                        {item.source && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {item.source === 'file' ? '📄 เอกสาร' : item.source === 'url' ? '🌐 เว็บไซต์' : item.source}
                          </span>
                        )}
                      </div>

                      {/* Mobile action buttons */}
                      <div className="md:hidden flex items-center gap-1.5 shrink-0">
                        {isDraft && (
                          <button
                            onClick={() => handleApprove(item.id)}
                            disabled={loading}
                            className="p-1.5 text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-all cursor-pointer"
                            title="อนุมัติเข้าคลังความรู้"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setEditingItem(item)}
                          disabled={loading}
                          className="p-1.5 text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-all cursor-pointer"
                          title="แก้ไขข้อมูล"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={loading}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                          title={isDraft ? 'ปฏิเสธ/ลบร่าง' : 'ลบข้อมูล'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <h3 className="font-heading text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                      {item.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed whitespace-pre-line">
                      {item.content}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap pt-0.5">
                      <span className="flex items-center gap-1" suppressHydrationWarning>
                        <Calendar className="w-3 h-3" />
                        {isDraft ? 'สังเคราะห์จากแชท: ' : 'เพิ่มเมื่อ: '}
                        {new Date(item.created_at).toLocaleDateString('th-TH', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>

                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span>{item.content.length.toLocaleString()} ตัวอักษร</span>

                      {item.source_ref && (
                        <>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <span className="line-clamp-1 text-slate-400">อ้างอิง: {item.source_ref}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Desktop action buttons */}
                  <div className="hidden md:flex items-center gap-2 self-center shrink-0">
                    {isDraft && (
                      <button
                        onClick={() => handleApprove(item.id)}
                        disabled={loading}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-xs cursor-pointer"
                        title="อนุมัติคำถาม-คำตอบนี้เข้าคลังความรู้จริง เพื่อให้บอทนำไปตอบลูกค้าทันที"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>อนุมัติ</span>
                      </button>
                    )}
                    <button
                      onClick={() => setEditingItem(item)}
                      disabled={loading}
                      className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                      title="แก้ไขหัวข้อหรือเนื้อหาคำตอบ"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>แก้ไข</span>
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={loading}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-all cursor-pointer"
                      title={isDraft ? 'ปฏิเสธ/ลบร่าง' : 'ลบข้อมูล'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4">
            <div className="w-14 h-14 bg-blue-50 dark:bg-blue-950/60 rounded-2xl flex items-center justify-center mb-3 text-blue-600 dark:text-blue-400">
              <BookOpen className="w-7 h-7" />
            </div>
            <h3 className="font-heading text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
              {searchTerm ? 'ไม่พบข้อมูลความรู้ที่ตรงกับการค้นหา' : 'ยังไม่มีข้อมูลในคลังความรู้'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-5">
              {searchTerm
                ? 'ลองเปลี่ยนคำค้นหา หรือเลือกหมวดหมู่อื่นเพื่อค้นหาข้อมูล'
                : 'เริ่มต้นโดยการอัปโหลดเอกสาร ดึงข้อมูลจากเว็บไซต์ หรือเพิ่มคำถาม-คำตอบ เพื่อให้ AI เรียนรู้'}
            </p>
            <button
              onClick={() => setIsOpenModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm text-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มข้อมูลชุดแรกของคุณ</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Modal: Add New Knowledge ── */}
      {isOpenModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[85vh] sm:max-h-[90vh] overflow-y-auto p-5 sm:p-7 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-5 animate-in slide-in-from-bottom-5 sm:zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-heading text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                    เพิ่มข้อมูลความรู้ให้ AI
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    สอนคำถาม-คำตอบ นโยบาย หรือรายละเอียดให้ AI เรียนรู้
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpenModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form action={handleAddSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  หมวดหมู่ข้อมูล
                </label>
                <select
                  name="category"
                  defaultValue="faq"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all cursor-pointer"
                >
                  <option value="faq">❓ FAQ (ถาม-ตอบที่พบบ่อย)</option>
                  <option value="product">📦 ข้อมูลสินค้า/บริการ</option>
                  <option value="policy">📜 เงื่อนไข/นโยบายการขาย</option>
                  <option value="general">💡 ข้อมูลทั่วไปของร้าน</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  หัวข้อ / คำถาม
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  placeholder="เช่น ค่าจัดส่งเท่าไหร่?, ร้านเปิดกี่โมง?"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs sm:text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  รายละเอียด / คำตอบ
                </label>
                <textarea
                  name="content"
                  rows={5}
                  required
                  placeholder="กรอกรายละเอียดข้อมูลหรือคำตอบที่ต้องการให้ AI ตอบลูกค้าอย่างละเอียด..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs sm:text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400 leading-relaxed"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsOpenModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>บันทึกข้อมูล</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Edit Knowledge / Draft FAQ ── */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[85vh] sm:max-h-[90vh] overflow-y-auto p-5 sm:p-7 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-5 animate-in slide-in-from-bottom-5 sm:zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                    editingItem.status === 'draft' || editingItem.source === 'ai_synthesis'
                      ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
                      : 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                  }`}
                >
                  {editingItem.status === 'draft' ? (
                    <Sparkles className="w-5 h-5" />
                  ) : (
                    <Edit3 className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h2 className="font-heading text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                    {editingItem.status === 'draft' || editingItem.source === 'ai_synthesis'
                      ? 'แก้ไขร่าง FAQ จาก AI'
                      : 'แก้ไขข้อมูลความรู้'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    ปรับปรุงคำถามและคำตอบให้ตรงกับนโยบายร้านค้า
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form action={handleEditSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  หมวดหมู่ข้อมูล
                </label>
                <select
                  name="category"
                  defaultValue={editingItem.category || 'faq'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all cursor-pointer"
                >
                  <option value="faq">❓ FAQ (ถาม-ตอบที่พบบ่อย)</option>
                  <option value="product">📦 ข้อมูลสินค้า/บริการ</option>
                  <option value="policy">📜 เงื่อนไข/นโยบายการขาย</option>
                  <option value="general">💡 ข้อมูลทั่วไปของร้าน</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  หัวข้อ / คำถาม
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  defaultValue={editingItem.title}
                  placeholder="เช่น ค่าจัดส่งเท่าไหร่?, ร้านเปิดกี่โมง?"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs sm:text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  รายละเอียด / คำตอบ
                </label>
                <textarea
                  name="content"
                  rows={5}
                  required
                  defaultValue={editingItem.content}
                  placeholder="กรอกรายละเอียดข้อมูลหรือคำตอบที่ต้องการให้ AI ตอบลูกค้า..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs sm:text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400 leading-relaxed"
                ></textarea>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs transition-all cursor-pointer text-center"
                >
                  ยกเลิก
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-xs shadow-xs transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingItem.status === 'draft' ? 'บันทึกร่าง' : 'บันทึกการแก้ไข'}</span>
                </button>

                {(editingItem.status === 'draft' || editingItem.source === 'ai_synthesis') && (
                  <button
                    type="submit"
                    name="approveImmediately"
                    value="true"
                    disabled={loading}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm shadow-emerald-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>บันทึกและอนุมัติทันที</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
