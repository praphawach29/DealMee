'use client'

import { useState } from 'react'
import { toggleShopStatus, updateShopPlan, impersonateShop } from '../actions'
import { ShopMobileCard } from './components/ShopMobileCard'
import { ShopTableRow } from './components/ShopTableRow'

export interface ShopItem {
  id: string
  name: string
  plan: string | null
  status: string | null
  msg_used: number | null
  token_used: number | null
  created_at: string
  owner_email?: string | null
  owner_name?: string | null
  has_line?: boolean
  has_facebook?: boolean
  facebook_page_id?: string | null
}

export default function ShopsManagement({ initialShops }: { initialShops: ShopItem[] }) {
  const [shops, setShops] = useState<ShopItem[]>(initialShops)
  const [searchTerm, setSearchTerm] = useState('')
  const [loadingShopId, setLoadingShopId] = useState<string | null>(null)
  const [copiedEmailId, setCopiedEmailId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleCopyEmail = (email: string, shopId: string) => {
    navigator.clipboard.writeText(email)
    setCopiedEmailId(shopId)
    setTimeout(() => {
      setCopiedEmailId(null)
    }, 2000)
  }

  const filteredShops = shops.filter((s) => {
    const term = searchTerm.toLowerCase()
    return (
      s.name.toLowerCase().includes(term) ||
      s.id.toLowerCase().includes(term) ||
      (s.owner_email && s.owner_email.toLowerCase().includes(term)) ||
      (s.owner_name && s.owner_name.toLowerCase().includes(term))
    )
  })

  const handleToggleStatus = async (shop: ShopItem) => {
    setLoadingShopId(shop.id)
    setMessage(null)
    const res = await toggleShopStatus(shop.id, shop.status || 'active')
    setLoadingShopId(null)

    if (res.error) {
      setMessage({ type: 'error', text: res.error })
    } else if (res.success) {
      setMessage({ type: 'success', text: res.success })
      setShops((prev) =>
        prev.map((item) =>
          item.id === shop.id
            ? { ...item, status: item.status === 'suspended' ? 'active' : 'suspended' }
            : item
        )
      )
    }
  }

  const handlePlanChange = async (shopId: string, newPlan: string) => {
    setLoadingShopId(shopId)
    setMessage(null)
    const res = await updateShopPlan(shopId, newPlan)
    setLoadingShopId(null)

    if (res.error) {
      setMessage({ type: 'error', text: res.error })
    } else if (res.success) {
      setMessage({ type: 'success', text: res.success })
      setShops((prev) =>
        prev.map((item) => (item.id === shopId ? { ...item, plan: newPlan } : item))
      )
    }
  }

  const handleImpersonate = async (shopId: string) => {
    setLoadingShopId(shopId)
    setMessage(null)
    const res = await impersonateShop(shopId)
    setLoadingShopId(null)

    if (res.error) {
      setMessage({ type: 'error', text: res.error })
    } else if (res.success) {
      window.location.href = '/dashboard'
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-on-surface font-headline-md leading-tight">
            จัดการร้านค้าสมาชิก DealMee AI
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5 font-body-md">
            ตรวจสอบรายชื่อร้านค้า ระงับ/เปิดใช้งาน เปลี่ยนแพ็กเกจ หรือสวมบทบาทเข้าสู่ระบบร้านค้า DealMee
          </p>
        </div>

        {/* Search Filter */}
        <div className="relative w-full md:w-72">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[18px]">
            search
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาชื่อร้านค้า หรือ ID..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-outline-variant bg-surface text-on-surface text-xs sm:text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
          />
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

      {/* Mobile & Tablet Card Grid View (Hidden on Desktop LG) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-3.5 sm:gap-4">
        {filteredShops.map((shop) => (
          <ShopMobileCard
            key={shop.id}
            shop={shop}
            isLoading={loadingShopId === shop.id}
            copiedEmailId={copiedEmailId}
            onCopyEmail={handleCopyEmail}
            onPlanChange={handlePlanChange}
            onImpersonate={handleImpersonate}
            onToggleStatus={handleToggleStatus}
          />
        ))}
      </div>

      {/* Desktop View: Full Table (Only visible on Large Desktop LG+) */}
      <div className="hidden lg:block bg-surface border border-outline-variant/40 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-outline-variant/30 bg-surface-container-low text-on-surface-variant font-label-md">
                <th className="py-3.5 px-6 font-bold">ชื่อร้านค้า / อีเมลผู้สมัคร</th>
                <th className="py-3.5 px-4 font-bold">แพ็กเกจปัจจุบัน</th>
                <th className="py-3.5 px-4 font-bold">ช่องทางเชื่อมต่อ</th>
                <th className="py-3.5 px-4 font-bold">ข้อความที่ใช้</th>
                <th className="py-3.5 px-4 font-bold">สถานะ</th>
                <th className="py-3.5 px-4 font-bold">วันที่สมัคร</th>
                <th className="py-3.5 px-6 font-bold text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {filteredShops.map((shop) => (
                <ShopTableRow
                  key={shop.id}
                  shop={shop}
                  isLoading={loadingShopId === shop.id}
                  copiedEmailId={copiedEmailId}
                  onCopyEmail={handleCopyEmail}
                  onPlanChange={handlePlanChange}
                  onImpersonate={handleImpersonate}
                  onToggleStatus={handleToggleStatus}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
