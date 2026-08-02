'use client'

import { useState } from 'react'
import { createSampleOrder, updateOrderStatus } from './actions'

export interface OrderItem {
  id: string
  shop_id: string
  order_no: string
  customer_name: string
  phone: string | null
  total_amount: number
  items_summary: string | null
  status: string
  tracking_no: string | null
  created_at: string
}

export default function OrdersManager({ orders }: { orders: OrderItem[] }) {
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.order_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          o.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = selectedStatus === 'all' || o.status === selectedStatus
    return matchesSearch && matchesStatus
  })

  async function handleCreateMock() {
    setLoading(true)
    const res = await createSampleOrder()
    setLoading(false)
    if (res?.error) {
      alert(res.error)
    } else {
      window.location.reload()
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    setLoading(true)
    const res = await updateOrderStatus(id, newStatus)
    setLoading(false)
    if (res?.error) alert(res.error)
  }

  const statusBadge = (st: string) => {
    switch (st) {
      case 'paid':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">ชำระเงินแล้ว</span>
      case 'shipped':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-50 text-blue-700 border border-blue-200">จัดส่งแล้ว</span>
      case 'cancelled':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-50 text-rose-700 border border-rose-200">ยกเลิกแล้ว</span>
      default:
        return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-50 text-amber-700 border border-amber-200">รอชำระเงิน</span>
    }
  }

  const totalSales = orders
    .filter(o => o.status === 'paid' || o.status === 'shipped')
    .reduce((acc, curr) => acc + Number(curr.total_amount), 0)

  return (
    <div className="flex flex-col w-full relative space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-on-surface font-headline-md leading-tight">คำสั่งซื้อทั้งหมด</h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5 font-body-md">
            ติดตามรายการสั่งซื้อ อัปเดตสถานะชำระเงิน และยอดขายที่บอท AI ปิดการขายให้ลูกค้า
          </p>
        </div>
        <button
          onClick={handleCreateMock}
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-electric-blue hover:bg-primary text-white font-label-md font-semibold px-4 py-2 rounded-xl transition-all shadow-md shadow-electric-blue/20 hover:-translate-y-0.5 cursor-pointer disabled:opacity-50 shrink-0 text-xs sm:text-sm"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>สร้างออเดอร์ตัวอย่าง</span>
        </button>
      </div>

      {/* Compact 3-Column Stats Grid on Mobile */}
      <div className="grid grid-cols-3 gap-2 sm:gap-5">
        <div className="bg-surface border border-outline-variant/40 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm flex flex-col justify-between h-full">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h3 className="text-[11px] sm:text-xs font-bold text-on-surface-variant font-label-md">
              <span className="sm:hidden">ทั้งหมด</span>
              <span className="hidden sm:inline">ออเดอร์ทั้งหมด</span>
            </h3>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-electric-blue/10 flex items-center justify-center text-electric-blue shrink-0">
              <span className="material-symbols-outlined text-[15px] sm:text-[18px]">receipt_long</span>
            </div>
          </div>
          <div>
            <span className="text-base sm:text-2xl font-bold text-on-surface font-headline-lg">{orders.length}</span>
            <span className="text-[10px] sm:text-xs text-outline ml-1">รายการ</span>
          </div>
        </div>

        <div className="bg-surface border border-outline-variant/40 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm flex flex-col justify-between h-full">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h3 className="text-[11px] sm:text-xs font-bold text-on-surface-variant font-label-md">
              <span className="sm:hidden">ชำระแล้ว</span>
              <span className="hidden sm:inline">ชำระเงินเรียบร้อย</span>
            </h3>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-success-green/10 flex items-center justify-center text-success-green shrink-0">
              <span className="material-symbols-outlined text-[15px] sm:text-[18px]">task_alt</span>
            </div>
          </div>
          <div>
            <span className="text-base sm:text-2xl font-bold text-success-green font-headline-lg">
              {orders.filter(o => o.status === 'paid' || o.status === 'shipped').length}
            </span>
            <span className="text-[10px] sm:text-xs text-outline ml-1">รายการ</span>
          </div>
        </div>

        <div className="bg-surface border border-outline-variant/40 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm flex flex-col justify-between h-full">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h3 className="text-[11px] sm:text-xs font-bold text-on-surface-variant font-label-md">
              <span className="sm:hidden">ยอดขาย</span>
              <span className="hidden sm:inline">ยอดขายรวมสำเร็จ</span>
            </h3>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 shrink-0">
              <span className="material-symbols-outlined text-[15px] sm:text-[18px]">payments</span>
            </div>
          </div>
          <div>
            <span className="text-sm sm:text-2xl font-bold text-on-surface font-headline-lg">
              ฿{totalSales.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="bg-surface border border-outline-variant/40 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        
        {/* Search & Filter Toolbar */}
        <div className="p-3.5 sm:p-5 border-b border-outline-variant/30 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4 bg-surface-container-lowest">
          <div className="relative w-full sm:w-80">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px] sm:text-[20px]">search</span>
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาตามเลขรหัส หรือชื่อลูกค้า..." 
              className="w-full pl-9 sm:pl-10 pr-4 py-2 text-xs sm:text-sm border border-outline-variant rounded-xl bg-merchant-bg text-on-surface focus:outline-none focus:border-electric-blue focus:ring-1 focus:ring-electric-blue transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {[
              { id: 'all', label: 'ทั้งหมด' },
              { id: 'pending', label: '⏳ รอชำระ' },
              { id: 'paid', label: '✅ ชำระแล้ว' },
              { id: 'shipped', label: '🚚 จัดส่งแล้ว' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setSelectedStatus(st.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border shrink-0 ${
                  selectedStatus === st.id
                    ? 'bg-electric-blue text-white border-electric-blue shadow-sm'
                    : 'bg-surface text-on-surface-variant border-outline-variant/50 hover:bg-surface-container'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content View */}
        {filteredOrders.length > 0 ? (
          <>
            {/* 1. Mobile Cards View (Hidden on Tablet & Desktop) */}
            <div className="md:hidden divide-y divide-outline-variant/20">
              {filteredOrders.map((ord) => (
                <div key={ord.id} className="p-4 space-y-3 bg-surface hover:bg-surface-container-lowest transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-electric-blue text-sm">
                        {ord.order_no}
                      </span>
                      <span className="text-[11px] text-outline" suppressHydrationWarning>
                        ({new Date(ord.created_at).toLocaleDateString('th-TH')})
                      </span>
                    </div>
                    {statusBadge(ord.status)}
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-outline">ลูกค้า:</span>
                      <span className="font-semibold text-on-surface">{ord.customer_name} {ord.phone ? `(${ord.phone})` : ''}</span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-outline shrink-0">รายการ:</span>
                      <span className="font-medium text-on-surface-variant text-right line-clamp-2">{ord.items_summary || '-'}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-outline-variant/20 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-outline block">ยอดชำระ</span>
                      <span className="text-base font-bold text-on-surface">฿{Number(ord.total_amount || 0).toLocaleString()}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-outline">สถานะ:</span>
                      <select
                        value={ord.status}
                        onChange={(e) => handleStatusChange(ord.id, e.target.value)}
                        className="text-xs px-2.5 py-1.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface outline-none focus:border-electric-blue font-semibold"
                      >
                        <option value="pending">รอชำระเงิน</option>
                        <option value="paid">ชำระเงินแล้ว</option>
                        <option value="shipped">จัดส่งแล้ว</option>
                        <option value="cancelled">ยกเลิก</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 2. Desktop & Tablet Table View (Hidden on Mobile) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-outline-variant/30 text-xs font-bold text-outline uppercase bg-surface-container-lowest">
                    <th className="p-4 pl-6">เลขที่ออเดอร์</th>
                    <th className="p-4">ลูกค้า</th>
                    <th className="p-4">รายการสินค้า</th>
                    <th className="p-4">ยอดรวม</th>
                    <th className="p-4">สถานะ</th>
                    <th className="p-4 pr-6">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20 text-sm">
                  {filteredOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-surface-container-lowest/50 transition-colors">
                      <td className="p-4 pl-6 font-mono font-bold text-electric-blue">
                        {ord.order_no}
                        <span className="text-[11px] font-normal text-outline block mt-0.5" suppressHydrationWarning>
                          {new Date(ord.created_at).toLocaleDateString('th-TH')}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-on-surface">
                        {ord.customer_name}
                        {ord.phone && <span className="text-xs font-normal text-outline block">{ord.phone}</span>}
                      </td>
                      <td className="p-4 max-w-xs truncate text-on-surface-variant">
                        {ord.items_summary || '-'}
                      </td>
                      <td className="p-4 font-bold text-on-surface">
                        ฿{Number(ord.total_amount || 0).toLocaleString()}
                      </td>
                      <td className="p-4">
                        {statusBadge(ord.status)}
                      </td>
                      <td className="p-4 pr-6">
                        <select
                          value={ord.status}
                          onChange={(e) => handleStatusChange(ord.id, e.target.value)}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-outline-variant bg-merchant-bg text-on-surface outline-none focus:border-electric-blue"
                        >
                          <option value="pending">รอชำระเงิน</option>
                          <option value="paid">ชำระเงินแล้ว</option>
                          <option value="shipped">จัดส่งแล้ว</option>
                          <option value="cancelled">ยกเลิก</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-electric-blue/10 rounded-2xl flex items-center justify-center mb-4 text-electric-blue">
              <span className="material-symbols-outlined text-2xl sm:text-3xl">receipt_long</span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-on-surface mb-1">ยังไม่มีคำสั่งซื้อ</h3>
            <p className="text-xs sm:text-sm text-on-surface-variant max-w-sm mb-6">
              เมื่อมีคำสั่งซื้อทักเข้ามาจาก LINE หรือสร้างโดยบอท AI ออเดอร์จะมาปรากฏในหน้านี้ทันที
            </p>
            <button
              onClick={handleCreateMock}
              disabled={loading}
              className="flex items-center gap-2 bg-electric-blue hover:bg-primary text-white font-label-md font-semibold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-electric-blue/20 text-xs sm:text-sm"
            >
              <span className="material-symbols-outlined text-[18px] sm:text-[20px]">add</span>
              <span>สร้างออเดอร์ตัวอย่าง</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
