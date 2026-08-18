'use client'

import { useState } from 'react'
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
  const [importing, setImporting] = useState(false)
  const [importUrl, setImportUrl] = useState('')

  const draftsCount = items.filter((i) => i.status === 'draft' || i.source === 'ai_synthesis').length

  const filteredItems = items.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
      case 'faq': return '❓ FAQ (ถาม-ตอบ)'
      case 'product': return '📦 สินค้า/บริการ'
      case 'policy': return '📜 เงื่อนไข/นโยบาย'
      default: return '💡 ข้อมูลทั่วไป'
    }
  }

  const categoryBadgeColor = (cat: string) => {
    switch (cat) {
      case 'faq': return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'product': return 'bg-purple-50 text-purple-700 border-purple-200'
      case 'policy': return 'bg-amber-50 text-amber-700 border-amber-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const objectionBadge = (obj: string) => {
    switch (obj) {
      case 'price_hesitation':
        return { label: '💰 ลังเลราคา/ขอส่วนลด', color: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' }
      case 'product_comparison':
        return { label: '⚖️ เปรียบเทียบสินค้า/รุ่น', color: 'bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800' }
      case 'shipping_doubt':
        return { label: '🚚 การจัดส่ง/รอบส่ง', color: 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800' }
      case 'trust_building':
        return { label: '🛡️ ความมั่นใจ/รับประกัน', color: 'bg-indigo-50 text-indigo-800 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800' }
      case 'urgency_promotion':
        return { label: '🎁 โปรโมชั่น/ของแถม', color: 'bg-pink-50 text-pink-800 border-pink-300 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800' }
      default:
        return { label: '🛍️ ปิดการขายทั่วไป', color: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' }
    }
  }

  return (
    <div className="flex flex-col w-full relative space-y-5 sm:space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-on-surface font-headline-md leading-tight">คลังความรู้</h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5 font-body-md">
            เพิ่มข้อมูลเอกสาร ถาม-ตอบ หรือเงื่อนไขร้านค้า เพื่อให้ AI นำไปใช้อ้างอิงในการตอบคำถามลูกค้าได้อย่างแม่นยำ
          </p>
        </div>
        <button
          onClick={() => setIsOpenModal(true)}
          className="flex items-center justify-center gap-2 bg-electric-blue hover:bg-primary text-white font-label-md font-semibold px-4 py-2 rounded-xl transition-all shadow-md shadow-electric-blue/20 hover:-translate-y-0.5 cursor-pointer shrink-0 text-xs sm:text-sm"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>เพิ่มข้อมูลใหม่</span>
        </button>
      </div>

      {/* Alert Notification */}
      {message && (
        <div
          className={`p-3.5 rounded-xl text-xs sm:text-sm font-label-md flex items-center justify-between transition-all ${
            message.type === 'success'
              ? 'bg-success-green/10 text-success-green border border-success-green/20'
              : 'bg-error-red/10 text-error-red border border-error-red/20'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[18px]">
              {message.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <p>{message.text}</p>
          </div>
          <button onClick={() => setMessage(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Bulk import — most shops already have this written down somewhere,
          and retyping it by hand is the main reason the knowledge base sits
          empty. */}
      <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4 sm:p-5 space-y-4">
        <div>
          <h2 className="text-sm sm:text-base font-semibold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
            นำเข้าอัตโนมัติ
          </h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            ดึงข้อมูลจากเว็บไซต์หรือไฟล์ของร้าน แล้วให้ AI แปลงเป็นคำถาม-คำตอบให้อัตโนมัติ (สูงสุด 30 ข้อต่อการนำเข้า 1 ครั้ง)
          </p>
        </div>

        <form action={(fd) => handleImport(fd, importKnowledgeFromUrl)} className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            name="url"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            placeholder="https://ร้านของคุณ.com/about"
            required
            disabled={importing}
            className="flex-1 px-3 py-2 rounded-lg border border-outline-variant bg-surface text-xs sm:text-sm text-on-surface disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={importing}
            className="px-4 py-2 rounded-lg bg-electric-blue hover:bg-primary text-white text-xs sm:text-sm font-semibold disabled:opacity-50 cursor-pointer shrink-0"
          >
            {importing ? 'กำลังอ่าน...' : 'ดึงจากลิงก์'}
          </button>
        </form>

        <form action={(fd) => handleImport(fd, importKnowledgeFromFile)} className="flex flex-col sm:flex-row gap-2">
          <input
            type="file"
            name="file"
            accept=".pdf,.csv"
            required
            disabled={importing}
            className="flex-1 text-xs sm:text-sm text-on-surface-variant file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-surface-container-high file:text-on-surface file:text-xs file:cursor-pointer disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={importing}
            className="px-4 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs sm:text-sm font-semibold border border-outline-variant disabled:opacity-50 cursor-pointer shrink-0"
          >
            {importing ? 'กำลังอ่าน...' : 'อัปโหลด PDF / CSV'}
          </button>
        </form>

        <p className="text-[11px] text-on-surface-variant leading-relaxed">
          ไฟล์ CSV ที่มีคอลัมน์ <span className="font-mono">คำถาม</span> และ <span className="font-mono">คำตอบ</span> (หรือ question/answer) จะถูกนำเข้าตรงตามที่เขียนไว้ ไม่ผ่าน AI —
          ได้ข้อความตรงตามต้นฉบับทุกตัวอักษร ส่วนไฟล์อื่นจะให้ AI ช่วยสกัดให้ นำเข้าซ้ำจากต้นทางเดิมจะแทนที่ของเดิม ไม่ซ้อนกัน
        </p>
      </div>

      {/* Compact 3-Column Stats Grid on Mobile */}
      <div className="grid grid-cols-3 gap-2 sm:gap-5">
        <div className="bg-surface border border-outline-variant/40 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm flex flex-col justify-between h-full min-h-[90px] sm:min-h-[110px]">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h3 className="text-[11px] sm:text-xs font-bold text-on-surface-variant font-label-md">
              <span className="sm:hidden">ทั้งหมด</span>
              <span className="hidden sm:inline">ข้อมูลทั้งหมด</span>
            </h3>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-electric-blue/10 flex items-center justify-center text-electric-blue shrink-0">
              <span className="material-symbols-outlined text-[15px] sm:text-[18px]">description</span>
            </div>
          </div>
          <div>
            <span className="text-base sm:text-2xl font-bold text-on-surface font-headline-lg">{items.length}</span>
            <span className="text-[10px] sm:text-xs text-outline ml-1">รายการ</span>
          </div>
        </div>

        <div className="bg-surface border border-outline-variant/40 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm flex flex-col justify-between h-full min-h-[90px] sm:min-h-[110px]">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h3 className="text-[11px] sm:text-xs font-bold text-on-surface-variant font-label-md">
              <span className="sm:hidden">สถานะ</span>
              <span className="hidden sm:inline">สถานะ RAG</span>
            </h3>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-success-green/10 flex items-center justify-center text-success-green shrink-0">
              <span className="material-symbols-outlined text-[15px] sm:text-[18px]">check_circle</span>
            </div>
          </div>
          <div>
            <span className="text-xs sm:text-base font-bold text-success-green">พร้อมใช้งาน</span>
          </div>
        </div>

        <div className="bg-surface border border-outline-variant/40 rounded-xl sm:rounded-2xl p-2.5 sm:p-6 shadow-sm flex flex-col justify-between h-full min-h-[90px] sm:min-h-[110px]">
          <div className="flex items-center justify-between mb-2 sm:mb-4">
            <h3 className="text-[11px] sm:text-sm font-bold text-on-surface-variant font-label-md">
              <span className="sm:hidden">ตัวอักษร</span>
              <span className="hidden sm:inline">รวมตัวอักษร</span>
            </h3>
            <div className="w-6 h-6 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 shrink-0">
              <span className="material-symbols-outlined text-[15px] sm:text-[20px]">short_text</span>
            </div>
          </div>
          <div>
            <span className="text-sm sm:text-3xl font-bold text-on-surface font-headline-lg">
              {items.reduce((acc, curr) => acc + curr.content.length, 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Main Data Section */}
      <div className="bg-surface border border-outline-variant/40 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        
        {/* Search & Filter Toolbar */}
        <div className="p-3.5 sm:p-5 border-b border-outline-variant/30 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4 bg-surface-container-lowest">
          <div className="relative w-full sm:w-80">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px] sm:text-[20px]">search</span>
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาตามหัวข้อ หรือเนื้อหา..." 
              className="w-full pl-9 sm:pl-10 pr-4 py-2 text-xs sm:text-sm border border-outline-variant rounded-xl bg-merchant-bg text-on-surface focus:outline-none focus:border-electric-blue focus:ring-1 focus:ring-electric-blue transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {['all', 'faq', 'product', 'policy', 'general'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-electric-blue text-white border-electric-blue shadow-sm'
                    : 'bg-surface text-on-surface-variant border-outline-variant/50 hover:bg-surface-container'
                }`}
              >
                {cat === 'all' && `ทั้งหมด (${items.length})`}
                {cat === 'faq' && '❓ FAQ'}
                {cat === 'product' && '📦 สินค้า'}
                {cat === 'policy' && '📜 เงื่อนไข'}
                {cat === 'general' && '💡 ทั่วไป'}
              </button>
            ))}

            {draftsCount > 0 && (
              <button
                onClick={() => setSelectedCategory('draft')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all border shrink-0 flex items-center gap-1 ${
                  selectedCategory === 'draft'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                    : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">psychology</span>
                <span>💡 ร่างจาก AI ({draftsCount})</span>
              </button>
            )}

            <button
              onClick={() => setSelectedCategory('closers')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all border shrink-0 flex items-center gap-1 ${
                selectedCategory === 'closers'
                  ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                  : 'bg-purple-50 text-purple-800 border-purple-300 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">military_tech</span>
              <span>🏆 ปิดการขายจริง ({trajectories.length})</span>
            </button>
          </div>
        </div>
        
        {/* Golden Closers Banner when Closers tab is selected */}
        {selectedCategory === 'closers' && (
          <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-indigo-950/30 border-b border-purple-200 dark:border-purple-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[20px]">military_tech</span>
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                  <span>🏆 ถอดรหัสบทสนทนาปิดการขาย (Golden Closers / Sales Trajectories)</span>
                  <span className="text-[10px] bg-purple-200 text-purple-900 dark:bg-purple-900 dark:text-purple-200 px-1.5 py-0.2 rounded font-bold">
                    {trajectories.filter(t => t.status === 'active').length} สคริปต์ใช้งานอยู่
                  </span>
                </h4>
                <p className="text-[11px] sm:text-xs text-purple-800/80 dark:text-purple-300/80 mt-0.5">
                  ระบบถอดรหัสจังหวะที่ลูกค้าลังเลแล้วบอทหรือแอดมินตอบจนปิดยอดโอนเงินได้สำเร็จ เพื่อนำมาสอน AI เป็นตัวอย่างเลียนแบบไหวพริบการขายแบบเรียลไทม์
                </p>
              </div>
            </div>

            <button
              onClick={handleScanGoldenClosers}
              disabled={scanningClosers || loading}
              className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-xs cursor-pointer shrink-0"
              title="สั่งให้ AI สแกนบทสนทนาของออเดอร์ที่ปิดยอดได้สำเร็จเพื่อสกัดสคริปต์ใหม่"
            >
              <span className={`material-symbols-outlined text-[16px] ${scanningClosers ? 'animate-spin' : ''}`}>
                {scanningClosers ? 'sync' : 'auto_fix_high'}
              </span>
              <span>{scanningClosers ? 'กำลังถอดรหัสสคริปต์...' : 'สแกนออเดอร์ถอดรหัสขาย'}</span>
            </button>
          </div>
        )}

        {/* AI Auto-FAQ Synthesis Banner when Draft tab is selected */}
        {selectedCategory === 'draft' && (
          <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border-b border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <span>💡 คำถามแนะนำจาก AI (Hermes Continuous Learning)</span>
                  <span className="text-[10px] bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200 px-1.5 py-0.2 rounded font-bold">
                    {draftsCount} รายการรออนุมัติ
                  </span>
                </h4>
                <p className="text-[11px] sm:text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                  AI วิเคราะห์บทสนทนาจริงเมื่อลูกค้าถามคำถามใหม่ๆ หรือเมื่อแอดมินคนจริงตอบแชท เพื่อสกัดเป็น FAQ พร้อมใช้ คุณสามารถตรวจสอบ แก้ไข หรือกดอนุมัติเข้าคลัง
                </p>
              </div>
            </div>

            <button
              onClick={handleScanChat}
              disabled={scanningChat || loading}
              className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-xs cursor-pointer shrink-0"
              title="สั่งให้ AI ตรวจสอบบทสนทนาล่าสุดของร้านเพื่อสกัดคำถาม-คำตอบใหม่"
            >
              <span className={`material-symbols-outlined text-[16px] ${scanningChat ? 'animate-spin' : ''}`}>
                {scanningChat ? 'sync' : 'auto_fix_high'}
              </span>
              <span>{scanningChat ? 'กำลังสแกนแชท...' : 'สแกนแชทหา FAQ ตอนนี้'}</span>
            </button>
          </div>
        )}
        
        {/* Items List or Golden Closers List */}
        {selectedCategory === 'closers' ? (
          trajectories.length > 0 ? (
            <div className="divide-y divide-outline-variant/30">
              {trajectories.map((traj) => {
                const badge = objectionBadge(traj.customer_objection_type)
                const isActive = traj.status === 'active'
                return (
                  <div
                    key={traj.id}
                    className={`p-4 sm:p-6 transition-colors flex flex-col gap-3 sm:gap-4 ${
                      isActive ? 'bg-surface hover:bg-surface-container-lowest/50' : 'bg-slate-50/50 dark:bg-slate-900/30 opacity-75'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 text-[10px] sm:text-[11px] font-bold rounded-md border ${badge.color}`}>
                          {badge.label}
                        </span>
                        {traj.revenue > 0 && (
                          <span className="px-2 py-0.5 text-[10px] sm:text-[11px] font-bold rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">payments</span>
                            <span>ปิดยอดได้ {Number(traj.revenue).toLocaleString()} ฿</span>
                          </span>
                        )}
                        <span className="text-xs text-outline">
                          เทคนิค: <strong className="text-on-surface">{traj.closing_technique}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          onClick={() => handleToggleTrajectory(traj.id, traj.status)}
                          disabled={loading}
                          className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all border flex items-center gap-1 cursor-pointer ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                              : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {isActive ? 'check_circle' : 'pause_circle'}
                          </span>
                          <span>{isActive ? 'ใช้งานอยู่' : 'พักไว้'}</span>
                        </button>
                        <button
                          onClick={() => handleDeleteTrajectory(traj.id)}
                          disabled={loading}
                          className="p-1.5 text-outline hover:text-error-red hover:bg-error-red/10 rounded-lg transition-all cursor-pointer"
                          title="ลบตัวอย่างนี้"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm font-semibold text-on-surface">
                        💡 บริบท/สิ่งที่ลูกค้าถาม: <span className="font-normal text-on-surface-variant">{traj.customer_intent_summary}</span>
                      </p>
                    </div>

                    {/* Dialogue Turns Box */}
                    {Array.isArray(traj.winning_turn_dialogue) && traj.winning_turn_dialogue.length > 0 && (
                      <div className="p-3 sm:p-4 rounded-xl bg-surface-container-high/40 border border-outline-variant/30 space-y-2 text-xs">
                        <div className="text-[10px] font-bold text-outline uppercase tracking-wider">
                          บทสนทนาจริงที่ปิดการขายได้ (Winning Turn):
                        </div>
                        {traj.winning_turn_dialogue.map((turn, idx) => (
                          <div
                            key={idx}
                            className={`flex gap-2 items-start ${
                              turn.sender === 'customer' ? 'text-slate-700 dark:text-slate-300' : 'text-purple-900 dark:text-purple-200 font-medium'
                            }`}
                          >
                            <span className="font-bold shrink-0">
                              {turn.sender === 'customer' ? '👤 ลูกค้า:' : '🤖 พนักงานขาย:'}
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
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-4 text-purple-600">
                <span className="material-symbols-outlined text-2xl sm:text-3xl">military_tech</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-on-surface mb-1">ยังไม่มีบทสนทนาปิดการขาย (Golden Closers)</h3>
              <p className="text-xs sm:text-sm text-on-surface-variant max-w-sm mb-6">
                เมื่อมีลูกค้าสั่งซื้อและชำระเงินสำเร็จ ระบบจะถอดรหัสจังหวะปิดการขายมาเป็นตัวอย่างให้ AI โดยอัตโนมัติ หรือกดปุ่มด้านล่างเพื่อสแกนออเดอร์เดิมได้เลย
              </p>
              <button
                onClick={handleScanGoldenClosers}
                disabled={scanningClosers || loading}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-label-md font-semibold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-purple-600/20 text-xs sm:text-sm cursor-pointer"
              >
                <span className={`material-symbols-outlined text-[18px] ${scanningClosers ? 'animate-spin' : ''}`}>
                  {scanningClosers ? 'sync' : 'auto_awesome'}
                </span>
                <span>{scanningClosers ? 'กำลังถอดรหัสสคริปต์...' : 'สแกนออเดอร์ถอดรหัสขาย'}</span>
              </button>
            </div>
          )
        ) : filteredItems.length > 0 ? (
          <div className="divide-y divide-outline-variant/30">
            {filteredItems.map((item) => {
              const isDraft = item.status === 'draft' || item.source === 'ai_synthesis'
              return (
                <div
                  key={item.id}
                  className={`p-4 sm:p-6 transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4 ${
                    isDraft ? 'bg-amber-50/40 dark:bg-amber-950/10 hover:bg-amber-50/70 border-l-4 border-l-amber-500' : 'hover:bg-surface-container-lowest/50'
                  }`}
                >
                  <div className="space-y-1.5 sm:space-y-2 max-w-3xl w-full">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isDraft ? (
                          <span className="px-2 py-0.5 text-[10px] sm:text-[11px] font-bold rounded-md bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-700 flex items-center gap-1 shrink-0">
                            <span className="material-symbols-outlined text-[13px]">auto_awesome</span>
                            <span>AI ร่างจากแชทจริง (รออนุมัติ)</span>
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 text-[10px] sm:text-[11px] font-bold rounded-md border ${categoryBadgeColor(item.category)} shrink-0`}>
                            {categoryLabel(item.category)}
                          </span>
                        )}
                        <h3 className="text-sm sm:text-base font-bold text-on-surface line-clamp-1">{item.title}</h3>
                      </div>
                      
                      {/* Mobile action buttons */}
                      <div className="md:hidden flex items-center gap-1.5 shrink-0">
                        {isDraft && (
                          <button
                            onClick={() => handleApprove(item.id)}
                            disabled={loading}
                            className="p-1.5 text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-all"
                            title="อนุมัติเข้าคลังความรู้"
                          >
                            <span className="material-symbols-outlined text-[18px]">check_circle</span>
                          </button>
                        )}
                        <button
                          onClick={() => setEditingItem(item)}
                          disabled={loading}
                          className="p-1.5 text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded-lg transition-all"
                          title="แก้ไขข้อมูล"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={loading}
                          className="p-1.5 text-outline hover:text-error-red hover:bg-error-red/10 rounded-lg transition-all"
                          title={isDraft ? 'ปฏิเสธ/ลบร่าง' : 'ลบข้อมูล'}
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-on-surface-variant line-clamp-2 leading-relaxed whitespace-pre-line">
                      {item.content}
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-outline" suppressHydrationWarning>
                      {isDraft ? '💡 สังเคราะห์จากบทสนทนาจริงเมื่อ: ' : 'เพิ่มเมื่อ: '}
                      {new Date(item.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                  </div>

                  {/* Desktop action buttons */}
                  <div className="hidden md:flex items-center gap-2 self-center shrink-0">
                    {isDraft && (
                      <button
                        onClick={() => handleApprove(item.id)}
                        disabled={loading}
                        className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-xs cursor-pointer"
                        title="อนุมัติคำถาม-คำตอบนี้เข้าคลังความรู้จริง เพื่อให้บอทนำไปตอบลูกค้าทันที"
                      >
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        <span>อนุมัติ</span>
                      </button>
                    )}
                    <button
                      onClick={() => setEditingItem(item)}
                      disabled={loading}
                      className="flex items-center gap-1 bg-surface-container text-on-surface hover:bg-surface-container-high border border-outline-variant/60 text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                      title="แก้ไขหัวข้อหรือเนื้อหาคำตอบ"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                      <span>แก้ไข</span>
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={loading}
                      className={`p-2 rounded-lg transition-all cursor-pointer ${
                        isDraft
                          ? 'text-outline hover:text-error-red hover:bg-error-red/10'
                          : 'text-outline hover:text-error-red hover:bg-error-red/10'
                      }`}
                      title={isDraft ? 'ปฏิเสธ/ลบร่าง' : 'ลบข้อมูล'}
                    >
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-electric-blue/10 rounded-2xl flex items-center justify-center mb-4 text-electric-blue">
              <span className="material-symbols-outlined text-2xl sm:text-3xl">library_books</span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-on-surface mb-1">ยังไม่มีข้อมูลในคลังความรู้</h3>
            <p className="text-xs sm:text-sm text-on-surface-variant max-w-sm mb-6">
              เพิ่มข้อมูลคำถามพบบ่อย นโยบาย หรือรายละเอียดสินค้า เพื่อให้ AI นำไปตอบลูกค้าได้แบบถูกต้องและทันที
            </p>
            <button
              onClick={() => setIsOpenModal(true)}
              className="flex items-center gap-2 bg-electric-blue hover:bg-primary text-white font-label-md font-semibold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-electric-blue/20 text-xs sm:text-sm"
            >
              <span className="material-symbols-outlined text-[18px] sm:text-[20px]">add</span>
              <span>เพิ่มข้อมูลแรกของคุณ</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal: Add New Knowledge (Mobile Sheet Bottom / Desktop Center Modal) */}
      {isOpenModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[85vh] sm:max-h-[90vh] overflow-y-auto p-5 sm:p-7 shadow-2xl border border-slate-100 space-y-5 sm:space-y-6 animate-in slide-in-from-bottom-5 sm:zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 sm:pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-blue-50 text-electric-blue flex items-center justify-center font-bold shadow-inner shrink-0">
                  <span className="material-symbols-outlined text-xl sm:text-2xl">psychology</span>
                </div>
                <div>
                  <h2 className="text-base sm:text-xl font-bold text-slate-900 leading-tight">เพิ่มข้อมูลความรู้ให้ AI</h2>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">สอนคำตอบ นโยบาย หรือรายละเอียดให้ AI เรียนรู้</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpenModal(false)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px] sm:text-[20px]">close</span>
              </button>
            </div>

            <form action={handleAddSubmit} className="space-y-3.5 sm:space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs sm:text-sm font-bold text-slate-800">
                  หมวดหมู่ข้อมูล
                </label>
                <select
                  name="category"
                  defaultValue="faq"
                  className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs sm:text-sm font-medium focus:bg-white focus:border-electric-blue focus:ring-4 focus:ring-electric-blue/10 outline-none transition-all"
                >
                  <option value="faq">❓ FAQ (ถาม-ตอบที่พบบ่อย)</option>
                  <option value="product">📦 ข้อมูลสินค้า/บริการ</option>
                  <option value="policy">📜 เงื่อนไข/นโยบายการขาย</option>
                  <option value="general">💡 ข้อมูลทั่วไปของร้าน</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs sm:text-sm font-bold text-slate-800">
                  หัวข้อ / คำถาม
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  placeholder="เช่น ค่าจัดส่งเท่าไหร่?, ร้านเปิดกี่โมง?"
                  className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs sm:text-sm focus:bg-white focus:border-electric-blue focus:ring-4 focus:ring-electric-blue/10 outline-none transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs sm:text-sm font-bold text-slate-800">
                  รายละเอียด / คำตอบ
                </label>
                <textarea
                  name="content"
                  rows={4}
                  required
                  placeholder="กรอกรายละเอียดข้อมูลหรือคำตอบที่ต้องการให้ AI ตอบลูกค้าอย่างละเอียด..."
                  className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs sm:text-sm focus:bg-white focus:border-electric-blue focus:ring-4 focus:ring-electric-blue/10 outline-none transition-all placeholder:text-slate-400 leading-relaxed"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2.5 sm:gap-3 pt-3 sm:pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOpenModal(false)}
                  className="px-4 sm:px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs sm:text-sm transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 sm:px-7 py-2.5 rounded-xl bg-electric-blue hover:bg-primary text-white font-bold text-xs sm:text-sm shadow-md shadow-electric-blue/20 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {loading ? 'sync' : 'save'}
                  </span>
                  <span>{loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Knowledge / Draft FAQ */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[85vh] sm:max-h-[90vh] overflow-y-auto p-5 sm:p-7 shadow-2xl border border-slate-100 space-y-5 sm:space-y-6 animate-in slide-in-from-bottom-5 sm:zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 sm:pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center font-bold shadow-inner shrink-0 ${
                  editingItem.status === 'draft' || editingItem.source === 'ai_synthesis'
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-blue-50 text-electric-blue'
                }`}>
                  <span className="material-symbols-outlined text-xl sm:text-2xl">
                    {editingItem.status === 'draft' ? 'auto_awesome' : 'edit_note'}
                  </span>
                </div>
                <div>
                  <h2 className="text-base sm:text-xl font-bold text-slate-900 leading-tight">
                    {editingItem.status === 'draft' || editingItem.source === 'ai_synthesis'
                      ? 'แก้ไขร่าง FAQ จาก AI'
                      : 'แก้ไขข้อมูลความรู้'}
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                    ปรับปรุงคำถามและคำตอบให้ถูกต้องและตรงกับนโยบายร้านค้า
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px] sm:text-[20px]">close</span>
              </button>
            </div>

            <form action={handleEditSubmit} className="space-y-3.5 sm:space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs sm:text-sm font-bold text-slate-800">
                  หมวดหมู่ข้อมูล
                </label>
                <select
                  name="category"
                  defaultValue={editingItem.category || 'faq'}
                  className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs sm:text-sm font-medium focus:bg-white focus:border-electric-blue focus:ring-4 focus:ring-electric-blue/10 outline-none transition-all"
                >
                  <option value="faq">❓ FAQ (ถาม-ตอบที่พบบ่อย)</option>
                  <option value="product">📦 ข้อมูลสินค้า/บริการ</option>
                  <option value="policy">📜 เงื่อนไข/นโยบายการขาย</option>
                  <option value="general">💡 ข้อมูลทั่วไปของร้าน</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs sm:text-sm font-bold text-slate-800">
                  หัวข้อ / คำถาม
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  defaultValue={editingItem.title}
                  placeholder="เช่น ค่าจัดส่งเท่าไหร่?, ร้านเปิดกี่โมง?"
                  className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs sm:text-sm focus:bg-white focus:border-electric-blue focus:ring-4 focus:ring-electric-blue/10 outline-none transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs sm:text-sm font-bold text-slate-800">
                  รายละเอียด / คำตอบ
                </label>
                <textarea
                  name="content"
                  rows={5}
                  required
                  defaultValue={editingItem.content}
                  placeholder="กรอกรายละเอียดข้อมูลหรือคำตอบที่ต้องการให้ AI ตอบลูกค้า..."
                  className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs sm:text-sm focus:bg-white focus:border-electric-blue focus:ring-4 focus:ring-electric-blue/10 outline-none transition-all placeholder:text-slate-400 leading-relaxed"
                ></textarea>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2.5 sm:gap-3 pt-3 sm:pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs sm:text-sm transition-all cursor-pointer text-center"
                >
                  ยกเลิก
                </button>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs sm:text-sm shadow-xs transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[17px]">save</span>
                  <span>{editingItem.status === 'draft' ? 'บันทึกร่าง' : 'บันทึกการแก้ไข'}</span>
                </button>

                {(editingItem.status === 'draft' || editingItem.source === 'ai_synthesis') && (
                  <button
                    type="submit"
                    name="approveImmediately"
                    value="true"
                    disabled={loading}
                    className="px-4 sm:px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[17px]">check_circle</span>
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
