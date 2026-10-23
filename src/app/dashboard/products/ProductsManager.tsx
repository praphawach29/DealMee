'use client'

import { useState, useRef } from 'react'
import {
  createProduct,
  updateProduct,
  deleteProduct,
  generateAiProductDescription,
  bulkImportProducts,
  syncMarketplaceProducts,
  updateCentralProductStock,
  getStockAuditLogs,
} from './actions'

export interface ProductItem {
  id: string
  shop_id: string
  name: string
  category: string
  price: number
  stock: number
  description: string | null
  image_url: string | null
  status: string
  created_at: string
  master_sku?: string | null
  source_platform?: string | null
  external_item_id?: string | null
  marketplace_sync_enabled?: boolean | null
  last_stock_sync?: string | null
}

export default function ProductsManager({ products }: { products: ProductItem[] }) {
  const [isOpenModal, setIsOpenModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null)
  const [isOpenImportModal, setIsOpenImportModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isAiGenerating, setIsAiGenerating] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Marketplace Sync Modal State
  const [isOpenSyncModal, setIsOpenSyncModal] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncPlatform, setSyncPlatform] = useState<'all' | 'shopee' | 'tiktok'>('all')

  // Central Stock Quick Edit Modal State
  const [isOpenStockModal, setIsOpenStockModal] = useState(false)
  const [selectedStockProduct, setSelectedStockProduct] = useState<ProductItem | null>(null)
  const [newStockVal, setNewStockVal] = useState<number>(0)
  const [stockReason, setStockReason] = useState<string>('ปรับยอดสต็อกกลางโดยแอดมิน')
  const [stockLoading, setStockLoading] = useState(false)

  // Cross-Channel Stock Movement Logs State
  const [isOpenLogsModal, setIsOpenLogsModal] = useState(false)
  const [stockLogs, setStockLogs] = useState<any[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  // Form State for Adding Product
  const [productName, setProductName] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ทั่วไป')
  const [customCategory, setCustomCategory] = useState('')
  const [isCustomCategoryMode, setIsCustomCategoryMode] = useState(false)
  const [productPrice, setProductPrice] = useState('390')
  const [productStock, setProductStock] = useState('10')
  const [productDescription, setProductDescription] = useState('')
  const [imageInputType, setImageInputType] = useState<'upload' | 'url'>('upload')
  const [imageUrl, setImageUrl] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)

  // Dynamically extract categories strictly from existing products in this shop
  const existingCategories = Array.from(new Set(products.map(p => p.category).filter(Boolean)))
  const allCategories = existingCategories.length > 0 ? existingCategories : ['ทั่วไป']

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesCategory = selectedCategoryFilter === 'all' || p.category === selectedCategoryFilter
    return matchesSearch && matchesCategory
  })

  // Reset form when modal opens
  const handleOpenAddModal = () => {
    setEditingProduct(null)
    setProductName('')
    setSelectedCategory('ทั่วไป')
    setCustomCategory('')
    setIsCustomCategoryMode(false)
    setProductPrice('390')
    setProductStock('10')
    setProductDescription('')
    setImageInputType('upload')
    setImageUrl('')
    setImagePreview(null)
    setMessage(null)
    setIsOpenModal(true)
  }

  const handleOpenEditModal = (product: ProductItem) => {
    const category = product.category || 'ทั่วไป'
    const hasExistingCategory = allCategories.includes(category)
    setEditingProduct(product)
    setProductName(product.name)
    setSelectedCategory(hasExistingCategory ? category : 'ทั่วไป')
    setCustomCategory(hasExistingCategory ? '' : category)
    setIsCustomCategoryMode(!hasExistingCategory)
    setProductPrice(String(product.price ?? 0))
    setProductStock(String(product.stock ?? 0))
    setProductDescription(product.description || '')
    setImageInputType(product.image_url?.startsWith('http') ? 'url' : 'upload')
    setImageUrl(product.image_url || '')
    setImagePreview(product.image_url || null)
    setMessage(null)
    setIsOpenModal(true)
  }

  const handleCloseProductModal = () => {
    if (loading) return
    setIsOpenModal(false)
    setEditingProduct(null)
  }
  // Handle local image file selection
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      alert('ขนาดไฟล์ภาพต้องไม่เกิน 5MB')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setImagePreview(result)
      setImageUrl(result)
    }
    reader.readAsDataURL(file)
  }

  // Handle AI Description Generation
  const handleGenerateAiDescription = async () => {
    if (!productName.trim()) {
      alert('กรุณากรอกชื่อสินค้าก่อนกดให้ AI ช่วยเขียนรายละเอียดค่ะ')
      return
    }

    const targetCategory = isCustomCategoryMode ? customCategory : selectedCategory
    setIsAiGenerating(true)
    const res = await generateAiProductDescription(productName, targetCategory)
    setIsAiGenerating(false)

    if (res.error) {
      alert(res.error)
    } else if (res.description) {
      setProductDescription(res.description)
    }
  }

  // Submit Add Product Form
  async function handleProductSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const finalCategory = isCustomCategoryMode
      ? (customCategory.trim() || 'ทั่วไป')
      : selectedCategory

    const formData = new FormData()
    formData.append('name', productName)
    formData.append('category', finalCategory)
    formData.append('price', productPrice)
    formData.append('stock', productStock)
    formData.append('description', productDescription)
    formData.append('image_url', imageUrl)

    const res = editingProduct
      ? await updateProduct(editingProduct.id, formData)
      : await createProduct(formData)
    setLoading(false)

    if (res?.error) {
      setMessage({ type: 'error', text: res.error })
    } else if (res?.success) {
      setMessage({ type: 'success', text: res.success })
      setIsOpenModal(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบสินค้านี้?')) return

    setLoading(true)
    const res = await deleteProduct(id)
    setLoading(false)

    if (res?.error) {
      alert(res.error)
    }
  }

  // Download Sample CSV Template
  const handleDownloadCsvTemplate = () => {
    const csvContent =
      '\uFEFF' +
      'ชื่อสินค้า,หมวดหมู่,ราคา,จำนวนสต๊อก,รายละเอียดสินค้า,URLรูปภาพ\n' +
      'เสื้อยืด Oversize สีดำ,เสื้อผ้า,390,20,เสื้อยืดผ้าคอตตอน 100% สวมใส่สบาย ผ้าระบายอากาศได้ดี,https://images.unsplash.com/photo-1521572267360-ee0c2909d518\n' +
      'แก้วน้ำเก็บบางความเย็น 500ml,ทั่วไป,490,15,แก้วสแตนเลส 304 เก็บความเย็นได้นาน 24 ชั่วโมง,https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd\n'

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'template_products_import.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Handle CSV Bulk File Import
  const handleCsvFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const text = reader.result as string
        const lines = text.split(/\r\n|\n/).filter(line => line.trim())

        if (lines.length <= 1) {
          alert('ไฟล์ CSV ไม่มีข้อมูลสินค้า')
          return
        }

        const parsedProducts = []
        // Skip header row
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''))
          if (cols.length >= 3 && cols[0]) {
            parsedProducts.push({
              name: cols[0],
              category: cols[1] || 'ทั่วไป',
              price: parseFloat(cols[2] || '0'),
              stock: parseInt(cols[3] || '0', 10),
              description: cols[4] || '',
              image_url: cols[5] || '',
            })
          }
        }

        if (parsedProducts.length === 0) {
          alert('ไม่พบรูปแบบข้อมูลสินค้าที่ถูกต้องในไฟล์ CSV')
          return
        }

        setLoading(true)
        const res = await bulkImportProducts(parsedProducts)
        setLoading(false)

        if (res.error) {
          alert(res.error)
        } else if (res.success) {
          setMessage({ type: 'success', text: res.success })
          setIsOpenImportModal(false)
        }
      } catch (err) {
        alert('เกิดข้อผิดพลาดในการอ่านไฟล์ CSV')
      }
    }
    reader.readAsText(file)
  }

  // Handle Marketplace Products & Central Stock Synchronization
  async function handleSyncMarketplace() {
    setIsSyncing(true)
    setMessage(null)
    const res = await syncMarketplaceProducts(syncPlatform)
    setIsSyncing(false)
    if (res.error) {
      alert(res.error)
    } else if (res.success) {
      setMessage({ type: 'success', text: res.message || 'ซิงค์สินค้าและสต็อกกลางเรียบร้อยแล้ว!' })
      setIsOpenSyncModal(false)
      window.location.reload()
    }
  }

  // Handle Opening Quick Stock Editor
  function handleOpenEditStock(product: ProductItem) {
    setSelectedStockProduct(product)
    setNewStockVal(product.stock)
    setStockReason('ปรับยอดสต็อกกลางโดยแอดมิน')
    setIsOpenStockModal(true)
  }

  // Handle Saving Central Stock
  async function handleSaveCentralStock(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedStockProduct) return
    setStockLoading(true)
    const res = await updateCentralProductStock(selectedStockProduct.id, newStockVal, stockReason)
    setStockLoading(false)
    if (res.error) {
      alert(res.error)
    } else {
      setMessage({ type: 'success', text: 'อัปเดตสต็อกกลางและบันทึกประวัติสำเร็จเรียบร้อย!' })
      setIsOpenStockModal(false)
      window.location.reload()
    }
  }

  // Handle Opening Audit Logs Drawer
  async function handleOpenLogsModal() {
    setIsOpenLogsModal(true)
    setLoadingLogs(true)
    const res = await getStockAuditLogs()
    setLoadingLogs(false)
    if (res?.logs) {
      setStockLogs(res.logs)
    }
  }

  return (
    <div className="flex flex-col w-full relative space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-on-surface font-headline-md leading-tight">จัดการสินค้า</h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5 font-body-md">
            จัดการแคตตาล็อกสินค้า ราคา และคลังสต็อกกลาง (Central Stock Pooling) ซิงค์ข้ามร้านค้าอัตโนมัติ
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setIsOpenSyncModal(true)}
            className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-label-md font-bold px-3.5 py-2 rounded-xl transition-all shadow-md shadow-blue-500/20 hover:-translate-y-0.5 cursor-pointer text-xs sm:text-sm active:scale-95"
            title="ดึงสินค้าจาก TikTok Shop และ Shopee มาเชื่อมต่อสต็อกกลาง"
          >
            <span className="material-symbols-outlined text-[18px]">sync_alt</span>
            <span>ซิงค์ Marketplace & คลังกลาง</span>
          </button>

          <button
            type="button"
            onClick={handleOpenLogsModal}
            className="flex items-center justify-center gap-1.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md font-bold px-3 py-2 rounded-xl transition-all border border-outline-variant/40 cursor-pointer text-xs sm:text-sm shadow-xs"
            title="ดูประวัติการตัดสต็อกข้ามช่องทางแบบเรียลไทม์"
          >
            <span className="material-symbols-outlined text-[18px]">history</span>
            <span>ประวัติสต็อกกลาง</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              setLoading(true)
              const { seedSampleShopData } = await import('./actions')
              const res = await seedSampleShopData()
              setLoading(false)
              if (res.error) {
                alert(res.error)
              } else if (res.success) {
                setMessage({ type: 'success', text: res.success })
                window.location.reload()
              }
            }}
            className="flex items-center justify-center gap-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 font-label-md font-bold px-3 py-2 rounded-xl transition-all border border-purple-300/50 cursor-pointer text-xs sm:text-sm shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">auto_fix_high</span>
            <span>{loading ? 'กำลังปรับแต่ง...' : 'เติมข้อมูลทดสอบ'}</span>
          </button>

          <button
            onClick={() => setIsOpenImportModal(true)}
            className="flex items-center justify-center gap-1.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md font-bold px-3 py-2 rounded-xl transition-all border border-outline-variant/40 cursor-pointer text-xs sm:text-sm shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">file_upload</span>
            <span>นำเข้า CSV</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center justify-center gap-2 bg-electric-blue hover:bg-primary text-white font-label-md font-semibold px-4 py-2 rounded-xl transition-all shadow-md shadow-electric-blue/20 hover:-translate-y-0.5 cursor-pointer text-xs sm:text-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>เพิ่มสินค้าใหม่</span>
          </button>
        </div>
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

      {/* Compact 3-Column Stats Grid */}
      <div className="grid grid-cols-3 gap-2 sm:gap-5">
        <div className="bg-surface border border-outline-variant/40 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm flex flex-col justify-between h-full">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h3 className="text-[11px] sm:text-xs font-bold text-on-surface-variant font-label-md">
              <span className="sm:hidden">ทั้งหมด</span>
              <span className="hidden sm:inline">สินค้าทั้งหมด</span>
            </h3>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-electric-blue/10 flex items-center justify-center text-electric-blue shrink-0">
              <span className="material-symbols-outlined text-[15px] sm:text-[18px]">inventory_2</span>
            </div>
          </div>
          <div>
            <span className="text-base sm:text-2xl font-bold text-on-surface font-headline-lg">{products.length}</span>
            <span className="text-[10px] sm:text-xs text-outline ml-1">รายการ</span>
          </div>
        </div>

        <div className="bg-surface border border-outline-variant/40 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm flex flex-col justify-between h-full">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h3 className="text-[11px] sm:text-xs font-bold text-on-surface-variant font-label-md">
              <span className="sm:hidden">พร้อมขาย</span>
              <span className="hidden sm:inline">พร้อมขาย (In Stock)</span>
            </h3>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-success-green/10 flex items-center justify-center text-success-green shrink-0">
              <span className="material-symbols-outlined text-[15px] sm:text-[18px]">check_circle</span>
            </div>
          </div>
          <div>
            <span className="text-base sm:text-2xl font-bold text-success-green font-headline-lg">
              {products.filter(p => p.stock > 0).length}
            </span>
            <span className="text-[10px] sm:text-xs text-outline ml-1">รายการ</span>
          </div>
        </div>

        <div className="bg-surface border border-outline-variant/40 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm flex flex-col justify-between h-full">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h3 className="text-[11px] sm:text-xs font-bold text-on-surface-variant font-label-md">
              <span className="sm:hidden">หมดสต๊อก</span>
              <span className="hidden sm:inline">สินค้าหมดสต๊อก</span>
            </h3>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
              <span className="material-symbols-outlined text-[15px] sm:text-[20px]">warning</span>
            </div>
          </div>
          <div>
            <span className="text-base sm:text-3xl font-bold text-amber-600 font-headline-lg">
              {products.filter(p => p.stock <= 0).length}
            </span>
            <span className="text-[10px] sm:text-xs text-outline ml-1">รายการ</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface border border-outline-variant/40 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[20px]">
            search
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาชื่อสินค้า หรือรายละเอียด..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-outline-variant/60 bg-surface-container-high text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:bg-surface outline-none transition-all placeholder:text-outline"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              selectedCategoryFilter === 'all'
                ? 'bg-electric-blue text-white shadow-xs'
                : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
            }`}
          >
            ทั้งหมด
          </button>

          {existingCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                selectedCategoryFilter === cat
                  ? 'bg-electric-blue text-white shadow-xs'
                  : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid Display */}
      {filteredProducts.length === 0 ? (
        <div className="bg-surface border border-outline-variant/40 rounded-2xl p-8 sm:p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center mx-auto text-outline">
            <span className="material-symbols-outlined text-[28px]">inventory_2</span>
          </div>
          <h3 className="font-bold text-base text-on-surface font-headline-md">ยังไม่มีรายการสินค้า</h3>
          <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
            กดปุ่ม "เพิ่มสินค้าใหม่" ด้านบน เพื่อป้อนข้อมูลสินค้า ให้บอท AI นำไปใช้เชียร์ขายหน้าร้านได้เลยค่ะ
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
          {filteredProducts.map(product => {
            const isOutOfStock = product.stock <= 0

            return (
              <div
                key={product.id}
                className="bg-surface border border-outline-variant/35 rounded-xl p-2.5 sm:p-3 shadow-none flex flex-col justify-between space-y-2.5 hover:border-electric-blue/45 hover:shadow-[0_12px_28px_rgba(46,91,255,0.10)] transition-all duration-200 relative group"
              >
                <div className="space-y-2.5">
                  <div className="aspect-square w-full rounded-lg bg-merchant-bg border border-outline-variant/25 overflow-hidden relative flex items-center justify-center">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-outline gap-1">
                        <span className="material-symbols-outlined text-[32px]">image</span>
                        <span className="text-[10px]">ไม่มีรูปภาพ</span>
                      </div>
                    )}

                    {/* Platform Badge (Top-Left) */}
                    <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
                      {product.source_platform === 'tiktok' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/90 backdrop-blur-xs text-white border border-slate-700 shadow-xs flex items-center gap-1">
                          <span>⚫ TikTok Shop</span>
                        </span>
                      ) : product.source_platform === 'shopee' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EE4D2D]/90 backdrop-blur-xs text-white border border-orange-400 shadow-xs flex items-center gap-1">
                          <span>🟠 Shopee</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600/90 backdrop-blur-xs text-white border border-blue-400 shadow-xs flex items-center gap-1">
                          <span>🌐 Dealmee Central</span>
                        </span>
                      )}
                    </div>

                    <span className="absolute top-2 right-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-900/80 backdrop-blur-xs text-white z-10">
                      {product.category || 'ทั่วไป'}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-xs sm:text-sm text-on-surface line-clamp-1">{product.name}</h3>
                    {product.master_sku && (
                      <div className="mt-1 mb-1">
                        <span className="inline-block text-[10px] font-mono text-electric-blue bg-electric-blue/10 px-2 py-0.5 rounded-md font-bold border border-electric-blue/20">
                          Master SKU: {product.master_sku}
                        </span>
                      </div>
                    )}
                    <p className="hidden sm:block text-xs text-on-surface-variant line-clamp-2 mt-0.5 min-h-[32px]">
                      {product.description || 'ไม่มีรายละเอียดสินค้า'}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-outline-variant/20 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold text-electric-blue font-mono">
                      ฿{(product.price ?? 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEditStock(product)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 cursor-pointer transition-all hover:scale-105 active:scale-95 ${
                        isOutOfStock
                          ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                          : 'bg-success-green/10 text-success-green border border-success-green/20'
                      }`}
                      title="คลิกเพื่อแก้ไขสต็อกกลาง (Central Stock Pooling)"
                    >
                      <span className="material-symbols-outlined text-[13px]">tune</span>
                      <span>{isOutOfStock ? 'หมดสต๊อก' : `สต็อกกลาง: ${product.stock}`}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(product)}
                      className="p-1 rounded-lg text-outline hover:text-electric-blue hover:bg-electric-blue/10 transition-colors cursor-pointer"
                      title="แก้ไขสินค้า"
                      aria-label={'แก้ไขสินค้า ' + product.name}
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(product.id)}
                      className="p-1 rounded-lg text-outline hover:text-error-red hover:bg-error-red/10 transition-colors cursor-pointer"
                      title="ลบสินค้า"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 1. Add / Edit Product Drawer */}
      {isOpenModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-[1px] animate-in fade-in duration-200">
          <div className="absolute inset-y-0 right-0 w-full max-w-xl bg-white text-on-surface border-l border-outline-variant/35 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
            <div className="shrink-0 px-6 py-4 border-b border-slate-700/80 flex items-center justify-between bg-slate-800/90">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-electric-blue/20 flex items-center justify-center text-electric-blue">
                  <span className="material-symbols-outlined text-[20px]">add_shopping_cart</span>
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100 font-headline-md leading-tight">
                    เพิ่มรายการสินค้าใหม่
                  </h3>
                  <p className="text-[11px] text-outline">กรอกข้อมูลสินค้าเพื่อให้ AI นำไปใช้เชียร์ขายหน้าร้าน</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpenModal(false)}
                className="p-1.5 rounded-xl text-outline hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-white">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1.5 font-label-md">
                  ชื่อสินค้า *
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  required
                  placeholder="เช่น เสื้อยืด Oversize สีดำ, เซรั่มหน้าใส"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/65 bg-surface text-on-surface text-xs sm:text-sm focus:border-electric-blue focus:ring-2 focus:ring-electric-blue/20 outline-none transition-colors placeholder:text-outline"
                />
              </div>

              {/* Custom Category Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-on-surface font-label-md">
                      หมวดหมู่
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCustomCategoryMode(!isCustomCategoryMode)}
                      className="text-[11px] font-bold text-electric-blue hover:underline cursor-pointer"
                    >
                      {isCustomCategoryMode ? 'เลือกจากที่มีอยู่' : '+ เพิ่มหมวดหมู่ใหม่'}
                    </button>
                  </div>

                  {isCustomCategoryMode ? (
                    <input
                      type="text"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="พิมพ์หมวดหมู่ใหม่ที่ต้องการ..."
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-electric-blue bg-surface text-on-surface text-xs sm:text-sm outline-none placeholder:text-outline"
                    />
                  ) : (
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/65 bg-surface text-on-surface text-xs sm:text-sm font-medium focus:border-electric-blue outline-none transition-colors cursor-pointer"
                    >
                      {allCategories.map(cat => (
                        <option key={cat} value={cat} className="bg-surface text-on-surface">{cat}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1.5 font-label-md">
                    ราคา (บาท) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={productPrice}
                    onChange={(e) => setProductPrice(e.target.value)}
                    required
                    placeholder="390"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/65 bg-surface text-on-surface text-xs sm:text-sm focus:border-electric-blue outline-none font-mono transition-colors placeholder:text-outline"
                  />
                </div>
              </div>

              {/* Stock and Image Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1.5 font-label-md">
                    จำนวนสต๊อก (ชิ้น) *
                  </label>
                  <input
                    type="number"
                    value={productStock}
                    onChange={(e) => setProductStock(e.target.value)}
                    required
                    min={0}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/65 bg-surface text-on-surface text-xs sm:text-sm focus:border-electric-blue outline-none font-mono transition-colors"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-on-surface font-label-md">
                      รูปภาพสินค้า
                    </label>
                    <div className="flex gap-2 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setImageInputType('upload')}
                        className={`cursor-pointer ${imageInputType === 'upload' ? 'text-electric-blue underline' : 'text-outline'}`}
                      >
                        📁 อัปโหลด
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageInputType('url')}
                        className={`cursor-pointer ${imageInputType === 'url' ? 'text-electric-blue underline' : 'text-outline'}`}
                      >
                        🔗 URL
                      </button>
                    </div>
                  </div>

                  {imageInputType === 'upload' ? (
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full px-3.5 py-2 rounded-xl border border-dashed border-slate-700 hover:border-electric-blue bg-slate-800 text-slate-300 text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                        <span>เลือกรูปภาพจากเครื่อง...</span>
                      </button>
                    </div>
                  ) : (
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(e) => {
                        setImageUrl(e.target.value)
                        setImagePreview(e.target.value)
                      }}
                      placeholder="https://..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/65 bg-surface text-on-surface text-xs focus:border-electric-blue outline-none placeholder:text-outline"
                    />
                  )}

                  {imagePreview && (
                    <div className="mt-2 relative w-16 h-16 rounded-xl border border-outline-variant/65 overflow-hidden">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setImagePreview(null)
                          setImageUrl('')
                        }}
                        className="absolute top-0.5 right-0.5 bg-slate-950/90 text-white rounded-full p-0.5 text-[10px]"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Description & AI Copywriter Feature */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-on-surface font-label-md">
                    รายละเอียดสินค้า
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateAiDescription}
                    disabled={isAiGenerating}
                    className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-[11px] rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                    <span>{isAiGenerating ? 'AI กำลังเขียน...' : '✨ ให้ AI ช่วยเขียนรายละเอียดสินค้า'}</span>
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder="กรอกรายละเอียด จุดเด่น หรือขนาดสินค้า (หรือกดปุ่ม AI ช่วยเขียนด้านบน)..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/65 bg-surface text-on-surface text-xs sm:text-sm focus:border-electric-blue outline-none resize-none transition-colors placeholder:text-outline"
                />
              </div>

              <div className="shrink-0 px-0 pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpenModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-electric-blue hover:bg-primary text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {loading ? 'progress_activity' : 'save'}
                  </span>
                  <span>{loading ? 'กำลังบันทึก...' : 'บันทึกสินค้า'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. CSV Bulk Import Modal */}
      {isOpenImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 text-slate-100 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-700/80 flex items-center justify-between bg-slate-800/90">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <span className="material-symbols-outlined text-[20px]">file_upload</span>
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100 font-headline-md leading-tight">
                    นำเข้าสินค้าจาก CSV / Excel
                  </h3>
                  <p className="text-[11px] text-slate-400">ดาวน์โหลดตัวอย่างไฟล์และอัปโหลดเพื่อเพิ่มสินค้าจำนวนมาก</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpenImportModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4 bg-slate-900">
              <div className="p-4 rounded-xl bg-slate-800/90 border border-slate-700/80 space-y-2.5 shadow-sm">
                <h4 className="font-bold text-xs text-slate-100">ขั้นตอนที่ 1: ดาวน์โหลดตัวอย่างไฟล์</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  ดาวน์โหลดไฟล์ตัวอย่าง CSV เพื่อดูโครงสร้างคอลัมน์สินค้าที่ถูกต้องตามมาตรฐานของระบบ
                </p>
                <button
                  onClick={handleDownloadCsvTemplate}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold text-xs rounded-xl transition-all border border-slate-600 cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  <span>ดาวน์โหลดไฟล์ตัวอย่าง CSV</span>
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/90 border border-slate-700/80 space-y-2.5 shadow-sm">
                <h4 className="font-bold text-xs text-slate-100">ขั้นตอนที่ 2: อัปโหลดไฟล์ CSV</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  เลือกไฟล์ CSV ที่เตรียมไว้เพื่อเริ่มนำเข้าสินค้าทั้งหมดเข้าสู่ระบบทันที
                </p>

                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleCsvFileImport}
                  className="hidden"
                />

                <button
                  onClick={() => csvInputRef.current?.click()}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {loading ? 'progress_activity' : 'cloud_upload'}
                  </span>
                  <span>{loading ? 'กำลังนำเข้าสินค้า...' : 'เลือกไฟล์ CSV และนำเข้าทันที'}</span>
                </button>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setIsOpenImportModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Marketplace Sync Modal (Central Stock Integration) */}
      {isOpenSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 text-slate-100 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="shrink-0 px-6 py-4 border-b border-slate-700/80 flex items-center justify-between bg-slate-800/90">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                  <span className="material-symbols-outlined text-[20px]">sync_alt</span>
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100 font-headline-md leading-tight">
                    ซิงค์สินค้า & คลังสต็อกกลาง (Marketplace Sync)
                  </h3>
                  <p className="text-[11px] text-slate-400">ดึงสินค้าจาก TikTok Shop และ Shopee พร้อมเปิดระบบสต็อกรวม</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpenSyncModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4 bg-slate-900 overflow-y-auto">
              {/* Educational Banner about Central Stock Pooling */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-500/30 space-y-2">
                <div className="flex items-center gap-2 text-blue-300 font-bold text-xs">
                  <span className="material-symbols-outlined text-[16px]">hub</span>
                  <span>ฟีเจอร์คลังสต็อกกลาง (Central Stock Pooling แบบ BigSeller)</span>
                </div>
                <ul className="text-[11px] text-slate-300 space-y-1.5 pl-1 leading-relaxed">
                  <li>• <strong>แชร์สต็อกเดียวกันข้ามร้าน:</strong> หากมีร้านใน TikTok Shop, Shopee และ LINE OA สินค้าที่รหัส Master SKU เดียวกันจะแชร์จำนวนสต็อกกลางชุดเดียวกันทันที</li>
                  <li>• <strong>ตัดสต็อกแบบเรียลไทม์:</strong> เมื่อขายได้ในช่องทางใดก็ตาม สต็อกกลางจะถูกตัดทันที ป้องกันการขายเกิน (Overselling)</li>
                  <li>• <strong>AI Sales Agent รู้สต็อกจริง:</strong> บอทจะเช็คสต็อกสดก่อนตอบลูกค้าในแชทเสมอ ป้องกันการรับออเดอร์ของที่หมดสต็อก</li>
                </ul>
              </div>

              {/* Select Platform */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-200">
                  เลือกช่องทางที่ต้องการซิงค์:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSyncPlatform('all')}
                    className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      syncPlatform === 'all'
                        ? 'bg-blue-600/30 border-blue-500 text-white shadow-sm'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">store</span>
                    <span>ทุกช่องทาง (All)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSyncPlatform('tiktok')}
                    className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      syncPlatform === 'tiktok'
                        ? 'bg-black/60 border-slate-400 text-white shadow-sm'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-sm">⚫</span>
                    <span>TikTok Shop</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSyncPlatform('shopee')}
                    className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      syncPlatform === 'shopee'
                        ? 'bg-orange-600/30 border-orange-500 text-white shadow-sm'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-sm">🟠</span>
                    <span>Shopee</span>
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsOpenSyncModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={handleSyncMarketplace}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  <span className={`material-symbols-outlined text-[16px] ${isSyncing ? 'animate-spin' : ''}`}>
                    {isSyncing ? 'refresh' : 'sync'}
                  </span>
                  <span>{isSyncing ? 'กำลังซิงค์ข้อมูล...' : 'เริ่มซิงค์เข้าสู่คลังสต็อกกลาง'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Quick Edit Central Stock Modal */}
      {isOpenStockModal && selectedStockProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 text-slate-100 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="shrink-0 px-6 py-4 border-b border-slate-700/80 flex items-center justify-between bg-slate-800/90">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <span className="material-symbols-outlined text-[20px]">tune</span>
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100 font-headline-md leading-tight">
                    ปรับยอดสต็อกกลาง (Central Stock)
                  </h3>
                  <p className="text-[11px] text-slate-400">ซิงค์อัปเดตไปทุกหน้าร้านค้าและ AI ทันที</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpenStockModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveCentralStock} className="p-6 space-y-4 bg-slate-900">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/70 border border-slate-700/70">
                <div className="w-12 h-12 rounded-lg bg-slate-900 overflow-hidden shrink-0 flex items-center justify-center">
                  {selectedStockProduct.image_url ? (
                    <img src={selectedStockProduct.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-slate-600">inventory_2</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-xs text-slate-200 truncate">{selectedStockProduct.name}</h4>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Master SKU: {selectedStockProduct.master_sku || 'ยังไม่กำหนด'}
                  </p>
                  <span className="text-[10px] text-emerald-400 font-bold">
                    สต็อกปัจจุบัน: {selectedStockProduct.stock} ชิ้น
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  จำนวนสต็อกกลางใหม่ *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={newStockVal}
                  onChange={(e) => setNewStockVal(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-100 text-base font-bold font-mono focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  เหตุผลในการปรับยอด (สำหรับบันทึก Log)
                </label>
                <input
                  type="text"
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value)}
                  placeholder="เช่น เติมสินค้าเข้าคลัง +50, ตรวจนับสต็อกประจำสัปดาห์..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-100 text-xs focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsOpenStockModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={stockLoading}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span className={`material-symbols-outlined text-[16px] ${stockLoading ? 'animate-spin' : ''}`}>
                    {stockLoading ? 'refresh' : 'check'}
                  </span>
                  <span>{stockLoading ? 'กำลังบันทึก...' : 'บันทึกสต็อกกลาง'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Cross-Channel Stock Audit Logs Modal */}
      {isOpenLogsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 text-slate-100 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="shrink-0 px-6 py-4 border-b border-slate-700/80 flex items-center justify-between bg-slate-800/90">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                  <span className="material-symbols-outlined text-[20px]">history</span>
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100 font-headline-md leading-tight">
                    ประวัติการตัดสต็อกข้ามช่องทาง (Cross-Channel Stock Logs)
                  </h3>
                  <p className="text-[11px] text-slate-400">บันทึกทุกการเคลื่อนไหวของสต็อกกลางจากทุกแพลตฟอร์ม</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpenLogsModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 bg-slate-900 flex-1">
              {loadingLogs ? (
                <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[20px] animate-spin">refresh</span>
                  <span>กำลังโหลดประวัติสต็อก...</span>
                </div>
              ) : stockLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                  <span className="material-symbols-outlined text-[36px] text-slate-600 block mx-auto">history_toggle_off</span>
                  <p>ยังไม่มีประวัติการเคลื่อนไหวของสต็อกในระบบ</p>
                  <p className="text-[11px] text-slate-500">เมื่อมีการซิงค์สินค้า หรือมีการซื้อขายผ่านแชท รายการจะปรากฏที่นี่</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {stockLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/60 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200 truncate">{log.product_name}</span>
                          <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 bg-slate-900 rounded">
                            {log.master_sku}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">{log.reason || 'ปรับยอดสต็อก'}</p>
                        <span className="text-[10px] text-slate-500">
                          {new Date(log.created_at).toLocaleString('th-TH')}
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1.5 justify-end">
                          <span
                            className={`font-mono font-bold text-xs ${
                              log.change_amount > 0 ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {log.change_amount > 0 ? `+${log.change_amount}` : log.change_amount}
                          </span>
                          <span className="text-[10px] text-slate-400">ชิ้น</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          คงเหลือ: <span className="font-bold text-slate-200">{log.balance_after}</span>
                        </div>
                        <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-slate-700/60 text-slate-300">
                          {log.platform}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="shrink-0 p-4 border-t border-slate-800 bg-slate-900 flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpenLogsModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}