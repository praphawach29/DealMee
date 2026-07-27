'use client'

import { useState } from 'react'
import { createSampleBooking, updateBookingStatus } from './actions'

export interface BookingItem {
  id: string
  shop_id: string
  booking_no: string
  customer_name: string
  phone: string | null
  service_name: string | null
  booking_date: string
  booking_time: string
  status: string
  note: string | null
  created_at: string
}

export default function BookingsManager({ bookings }: { bookings: BookingItem[] }) {
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const filteredBookings = bookings.filter(b => 
    b.booking_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.service_name && b.service_name.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  async function handleCreateMock() {
    setLoading(true)
    const res = await createSampleBooking()
    setLoading(false)
    if (res?.error) alert(res.error)
  }

  async function handleStatusChange(id: string, newStatus: string) {
    setLoading(true)
    const res = await updateBookingStatus(id, newStatus)
    setLoading(false)
    if (res?.error) alert(res.error)
  }

  const statusBadge = (st: string) => {
    switch (st) {
      case 'confirmed':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">ยืนยันคิวแล้ว</span>
      case 'completed':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-50 text-blue-700 border border-blue-200">เข้าใช้บริการแล้ว</span>
      case 'cancelled':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-50 text-rose-700 border border-rose-200">ยกเลิกแล้ว</span>
      default:
        return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-50 text-amber-700 border border-amber-200">รอรอนัดหมาย</span>
    }
  }

  return (
    <div className="flex flex-col w-full relative space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-on-surface font-headline-md leading-tight">ตารางนัดหมายและการจอง</h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5 font-body-md">
            ดูรายการจองคิว ล็อคเวลา และติดตามสถานะการเข้ารับบริการที่บอท AI จองให้ลูกค้า
          </p>
        </div>
        <button
          onClick={handleCreateMock}
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-electric-blue hover:bg-primary text-white font-label-md font-semibold px-4 py-2 rounded-xl transition-all shadow-md shadow-electric-blue/20 hover:-translate-y-0.5 cursor-pointer disabled:opacity-50 shrink-0 text-xs sm:text-sm"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>สร้างคิวจองตัวอย่าง</span>
        </button>
      </div>

      {/* Compact 3-Column Stats Grid on Mobile */}
      <div className="grid grid-cols-3 gap-2 sm:gap-5">
        <div className="bg-surface border border-outline-variant/40 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm flex flex-col justify-between h-full">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h3 className="text-[11px] sm:text-xs font-bold text-on-surface-variant font-label-md">
              <span className="sm:hidden">ทั้งหมด</span>
              <span className="hidden sm:inline">คิวจองทั้งหมด</span>
            </h3>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-electric-blue/10 flex items-center justify-center text-electric-blue shrink-0">
              <span className="material-symbols-outlined text-[15px] sm:text-[18px]">calendar_month</span>
            </div>
          </div>
          <div>
            <span className="text-base sm:text-2xl font-bold text-on-surface font-headline-lg">{bookings.length}</span>
            <span className="text-[10px] sm:text-xs text-outline ml-1">รายการ</span>
          </div>
        </div>

        <div className="bg-surface border border-outline-variant/40 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm flex flex-col justify-between h-full">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h3 className="text-[11px] sm:text-xs font-bold text-on-surface-variant font-label-md">
              <span className="sm:hidden">ยืนยันแล้ว</span>
              <span className="hidden sm:inline">ยืนยันคิวแล้ว</span>
            </h3>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-success-green/10 flex items-center justify-center text-success-green shrink-0">
              <span className="material-symbols-outlined text-[15px] sm:text-[18px]">check_circle</span>
            </div>
          </div>
          <div>
            <span className="text-base sm:text-2xl font-bold text-success-green font-headline-lg">
              {bookings.filter(b => b.status === 'confirmed').length}
            </span>
            <span className="text-[10px] sm:text-xs text-outline ml-1">รายการ</span>
          </div>
        </div>

        <div className="bg-surface border border-outline-variant/40 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm flex flex-col justify-between h-full">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h3 className="text-[11px] sm:text-xs font-bold text-on-surface-variant font-label-md">
              <span className="sm:hidden">เข้าใช้บริการ</span>
              <span className="hidden sm:inline">เข้าใช้บริการแล้ว</span>
            </h3>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 shrink-0">
              <span className="material-symbols-outlined text-[15px] sm:text-[18px]">event_available</span>
            </div>
          </div>
          <div>
            <span className="text-base sm:text-2xl font-bold text-on-surface font-headline-lg">
              {bookings.filter(b => b.status === 'completed').length}
            </span>
            <span className="text-[10px] sm:text-xs text-outline ml-1">รายการ</span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-surface border border-outline-variant/40 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-3.5 sm:p-5 border-b border-outline-variant/30 flex justify-between items-center bg-surface-container-lowest">
          <div className="relative w-full sm:w-80">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px] sm:text-[20px]">search</span>
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาตามชื่อลูกค้า หรือบริการ..." 
              className="w-full pl-9 sm:pl-10 pr-4 py-2 text-xs sm:text-sm border border-outline-variant rounded-xl bg-merchant-bg text-on-surface focus:outline-none focus:border-electric-blue transition-all"
            />
          </div>
        </div>

        {filteredBookings.length > 0 ? (
          <>
            {/* 1. Mobile Cards View (Hidden on Tablet & Desktop) */}
            <div className="md:hidden divide-y divide-outline-variant/20">
              {filteredBookings.map((bk) => (
                <div key={bk.id} className="p-4 space-y-3 bg-surface hover:bg-surface-container-lowest transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-electric-blue text-sm">
                      {bk.booking_no}
                    </span>
                    {statusBadge(bk.status)}
                  </div>

                  <div className="bg-surface-container-lowest p-3 rounded-xl space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-outline">วันและเวลานัด:</span>
                      <span className="font-bold text-on-surface">📅 {bk.booking_date} ⏰ {bk.booking_time}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-outline">ลูกค้า:</span>
                      <span className="font-semibold text-on-surface">{bk.customer_name} {bk.phone ? `(${bk.phone})` : ''}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-outline">บริการ:</span>
                      <span className="font-medium text-electric-blue">{bk.service_name || '-'}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-outline-variant/20 flex items-center justify-between">
                    <span className="text-xs text-outline">เปลี่ยนสถานะ:</span>
                    <select
                      value={bk.status}
                      onChange={(e) => handleStatusChange(bk.id, e.target.value)}
                      className="text-xs px-2.5 py-1.5 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface outline-none focus:border-electric-blue font-semibold"
                    >
                      <option value="confirmed">ยืนยันคิว</option>
                      <option value="completed">เสร็จสิ้น</option>
                      <option value="cancelled">ยกเลิก</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>

            {/* 2. Desktop & Tablet Table View (Hidden on Mobile) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-outline-variant/30 text-xs font-bold text-outline uppercase bg-surface-container-lowest">
                    <th className="p-4 pl-6">เลขที่การจอง</th>
                    <th className="p-4">วันที่ & เวลา</th>
                    <th className="p-4">ชื่อลูกค้า</th>
                    <th className="p-4">บริการที่เลือก</th>
                    <th className="p-4">สถานะ</th>
                    <th className="p-4 pr-6">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20 text-sm">
                  {filteredBookings.map((bk) => (
                    <tr key={bk.id} className="hover:bg-surface-container-lowest/50 transition-colors">
                      <td className="p-4 pl-6 font-mono font-bold text-electric-blue">
                        {bk.booking_no}
                      </td>
                      <td className="p-4 font-bold text-on-surface">
                        📅 {bk.booking_date}
                        <span className="text-xs font-semibold text-electric-blue block">⏰ {bk.booking_time}</span>
                      </td>
                      <td className="p-4 font-semibold text-on-surface">
                        {bk.customer_name}
                        {bk.phone && <span className="text-xs font-normal text-outline block">{bk.phone}</span>}
                      </td>
                      <td className="p-4 text-on-surface-variant font-medium">
                        {bk.service_name || '-'}
                        {bk.note && <span className="text-xs text-outline block italic">"{bk.note}"</span>}
                      </td>
                      <td className="p-4">
                        {statusBadge(bk.status)}
                      </td>
                      <td className="p-4 pr-6">
                        <select
                          value={bk.status}
                          onChange={(e) => handleStatusChange(bk.id, e.target.value)}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-outline-variant bg-merchant-bg text-on-surface outline-none focus:border-electric-blue"
                        >
                          <option value="confirmed">ยืนยันคิว</option>
                          <option value="completed">เสร็จสิ้น</option>
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
          <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-electric-blue/10 rounded-2xl flex items-center justify-center mb-4 text-electric-blue">
              <span className="material-symbols-outlined text-2xl sm:text-3xl">calendar_month</span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-on-surface mb-1">ยังไม่มีรายการจองคิว</h3>
            <p className="text-xs sm:text-sm text-on-surface-variant max-w-sm mb-6">
              เมื่อลูกค้าจองคิวผ่าน LINE หรือกับบอท AI รายการจองจะมาแสดงในหน้านี้ทันที
            </p>
            <button
              onClick={handleCreateMock}
              disabled={loading}
              className="flex items-center gap-2 bg-electric-blue hover:bg-primary text-white font-label-md font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-electric-blue/20 text-xs sm:text-sm"
            >
              <span className="material-symbols-outlined text-[18px] sm:text-[20px]">add</span>
              <span>สร้างคิวจองตัวอย่าง</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
