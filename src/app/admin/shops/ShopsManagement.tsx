'use client'

import { useState } from 'react'
import { toggleShopStatus, updateShopPlan, impersonateShop } from '../actions'
import { Mail, Copy, Check } from 'lucide-react'

interface ShopItem {
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

  const filteredShops = shops.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.owner_email && s.owner_email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (s.owner_name && s.owner_name.toLowerCase().includes(searchTerm.toLowerCase()))
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
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm sm:text-base text-on-surface truncate">{shop.name}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium mt-1 truncate">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate select-all">{shop.owner_email || 'ไม่ระบุอีเมล'}</span>
                      {shop.owner_email && shop.owner_email !== 'ไม่ระบุอีเมล' && (
                        <button
                          type="button"
                          onClick={() => handleCopyEmail(shop.owner_email!, shop.id)}
                          className="hover:text-blue-700 p-0.5 rounded cursor-pointer shrink-0"
                          title="คัดลอกอีเมล"
                        >
                          {copiedEmailId === shop.id ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Copy className="h-3 w-3 text-slate-400" />
                          )}
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-outline font-mono truncate mt-0.5 opacity-60">
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

                {/* Connected Channels Badges */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-outline font-medium">ช่องทาง:</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      shop.has_line
                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                        : 'bg-slate-500/10 text-slate-400 border border-slate-500/20 opacity-70'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${shop.has_line ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                    <span>LINE OA</span>
                  </span>

                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      shop.has_facebook
                        ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                        : 'bg-slate-500/10 text-slate-400 border border-slate-500/20 opacity-70'
                    }`}
                    title={shop.facebook_page_id ? `Page ID: ${shop.facebook_page_id}` : undefined}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${shop.has_facebook ? 'bg-blue-500' : 'bg-slate-400'}`}></span>
                    <span>Facebook</span>
                    {shop.facebook_page_id && (
                      <span className="text-[9px] opacity-70 font-mono">({shop.facebook_page_id.slice(-4)})</span>
                    )}
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
              {filteredShops.map((shop) => {
                const isLoading = loadingShopId === shop.id
                const isSuspended = shop.status === 'suspended'

                return (
                  <tr key={shop.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-4 px-6">
                      <p className="font-bold text-on-surface text-sm sm:text-base">{shop.name}</p>
                      <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium mt-1 group">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="select-all font-mono">{shop.owner_email || 'ไม่ระบุอีเมล'}</span>
                        {shop.owner_email && shop.owner_email !== 'ไม่ระบุอีเมล' && (
                          <button
                            type="button"
                            onClick={() => handleCopyEmail(shop.owner_email!, shop.id)}
                            className="opacity-60 group-hover:opacity-100 hover:text-blue-700 transition-opacity p-0.5 rounded cursor-pointer"
                            title="คัดลอกอีเมล"
                          >
                            {copiedEmailId === shop.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600" />
                            )}
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-outline font-mono mt-0.5 opacity-60">ID: {shop.id}</p>
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

                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold w-fit ${
                            shop.has_line
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-500/10 text-slate-400 border border-slate-500/20 opacity-60'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${shop.has_line ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                          <span>LINE OA</span>
                        </span>

                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold w-fit ${
                            shop.has_facebook
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                              : 'bg-slate-500/10 text-slate-400 border border-slate-500/20 opacity-60'
                          }`}
                          title={shop.facebook_page_id ? `Page ID: ${shop.facebook_page_id}` : undefined}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${shop.has_facebook ? 'bg-blue-500' : 'bg-slate-400'}`}></span>
                          <span>Facebook</span>
                          {shop.facebook_page_id && (
                            <span className="text-[9px] opacity-70 font-mono">({shop.facebook_page_id.slice(-4)})</span>
                          )}
                        </span>
                      </div>
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
