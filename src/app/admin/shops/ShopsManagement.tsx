'use client'

import { useState } from 'react'
import { toggleShopStatus, updateShopPlan, impersonateShop } from '../actions'

interface ShopItem {
  id: string
  name: string
  plan: string | null
  status: string | null
  msg_used: number | null
  token_used: number | null
  created_at: string
}

export default function ShopsManagement({ initialShops }: { initialShops: ShopItem[] }) {
  const [shops, setShops] = useState<ShopItem[]>(initialShops)
  const [searchTerm, setSearchTerm] = useState('')
  const [loadingShopId, setLoadingShopId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const filteredShops = shops.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.id.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
            จัดการร้านค้าสมาชิก
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5 font-body-md">
            ตรวจสอบรายชื่อร้านค้า ระงับ/เปิดใช้งาน เปลี่ยนแพ็กเกจ หรือสวมบทบาทเข้าสู่ระบบร้านค้า
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
        {filteredShops.map((shop) => {
          const isLoading = loadingShopId === shop.id
          const isSuspended = shop.status === 'suspended'

          return (
            <div
              key={shop.id}
              className="bg-surface border border-outline-variant/40 rounded-2xl p-4 shadow-sm space-y-3.5 hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2 border-b border-outline-variant/20 pb-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm sm:text-base text-on-surface truncate">{shop.name}</h3>
                    <p className="text-[11px] text-outline font-mono truncate mt-0.5">
                      ID: {shop.id}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase shrink-0 ${
                      isSuspended
                        ? 'bg-error-red/10 text-error-red border border-error-red/20'
                        : 'bg-success-green/10 text-success-green border border-success-green/20'
                    }`}
                  >
                    {isSuspended ? 'ระงับชั่วคราว' : 'เปิดใช้งาน'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-merchant-bg p-3 rounded-xl border border-outline-variant/30">
                  <div>
                    <span className="text-[10px] text-outline block font-medium">แพ็กเกจ</span>
                    <select
                      value={shop.plan || 'free'}
                      disabled={isLoading}
                      onChange={(e) => handlePlanChange(shop.id, e.target.value)}
                      className="font-bold uppercase text-xs bg-transparent text-amber-600 outline-none cursor-pointer mt-0.5"
                    >
                      <option value="free">FREE</option>
                      <option value="starter">STARTER</option>
                      <option value="pro">PRO</option>
                      <option value="agency">AGENCY</option>
                      <option value="byok">BYOK</option>
                    </select>
                  </div>

                  <div>
                    <span className="text-[10px] text-outline block font-medium">ข้อความที่ใช้</span>
                    <span className="font-bold font-mono text-on-surface mt-0.5 block">
                      {(shop.msg_used || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-outline px-1">
                  <span>วันที่สมัคร:</span>
                  <span className="font-medium text-on-surface-variant">
                    {new Date(shop.created_at).toLocaleDateString('th-TH')}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => handleImpersonate(shop.id)}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 bg-electric-blue/10 hover:bg-electric-blue/20 text-electric-blue font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">key</span>
                  <span>สวมบทบาท</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleStatus(shop)}
                  disabled={isLoading}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50 ${
                    isSuspended
                      ? 'bg-success-green/10 text-success-green hover:bg-success-green/20'
                      : 'bg-error-red/10 text-error-red hover:bg-error-red/20'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {isSuspended ? 'play_arrow' : 'block'}
                  </span>
                  <span>{isSuspended ? 'ปลดระงับ' : 'ระงับร้านค้า'}</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop View: Full Table (Only visible on Large Desktop LG+) */}
      <div className="hidden lg:block bg-surface border border-outline-variant/40 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-outline-variant/30 bg-surface-container-low text-on-surface-variant font-label-md">
                <th className="py-3.5 px-6 font-bold">ชื่อร้านค้า / ID</th>
                <th className="py-3.5 px-4 font-bold">แพ็กเกจปัจจุบัน</th>
                <th className="py-3.5 px-4 font-bold">ข้อความที่ใช้</th>
                <th className="py-3.5 px-4 font-bold">สถานะ</th>
                <th className="py-3.5 px-4 font-bold">วันที่สมัคร</th>
                <th className="py-3.5 px-6 font-bold text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {filteredShops.map((shop) => {
                const isLoading = loadingShopId === shop.id
                const isSuspended = shop.status === 'suspended'

                return (
                  <tr key={shop.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-4 px-6">
                      <p className="font-bold text-on-surface">{shop.name}</p>
                      <p className="text-[11px] text-outline font-mono mt-0.5">{shop.id}</p>
                    </td>

                    <td className="py-4 px-4">
                      <select
                        value={shop.plan || 'free'}
                        disabled={isLoading}
                        onChange={(e) => handlePlanChange(shop.id, e.target.value)}
                        className="font-bold text-xs uppercase bg-surface-container-high border border-outline-variant/40 rounded-lg px-2.5 py-1.5 text-amber-600 outline-none cursor-pointer hover:border-amber-500 transition-colors"
                      >
                        <option value="free">FREE</option>
                        <option value="starter">STARTER</option>
                        <option value="pro">PRO</option>
                        <option value="agency">AGENCY</option>
                        <option value="byok">BYOK</option>
                      </select>
                    </td>

                    <td className="py-4 px-4 font-mono font-bold text-on-surface">
                      {(shop.msg_used || 0).toLocaleString()}
                    </td>

                    <td className="py-4 px-4">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                          isSuspended
                            ? 'bg-error-red/10 text-error-red border border-error-red/20'
                            : 'bg-success-green/10 text-success-green border border-success-green/20'
                        }`}
                      >
                        {isSuspended ? 'ระงับชั่วคราว' : 'เปิดใช้งาน'}
                      </span>
                    </td>

                    <td className="py-4 px-4 text-xs text-on-surface-variant">
                      {new Date(shop.created_at).toLocaleDateString('th-TH')}
                    </td>

                    <td className="py-4 px-6 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleImpersonate(shop.id)}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-electric-blue/10 hover:bg-electric-blue/20 text-electric-blue font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[16px]">key</span>
                        <span>สวมบทบาท</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleStatus(shop)}
                        disabled={isLoading}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50 ${
                          isSuspended
                            ? 'bg-success-green/10 text-success-green hover:bg-success-green/20'
                            : 'bg-error-red/10 text-error-red hover:bg-error-red/20'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {isSuspended ? 'play_arrow' : 'block'}
                        </span>
                        <span>{isSuspended ? 'ปลดระงับ' : 'ระงับ'}</span>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
