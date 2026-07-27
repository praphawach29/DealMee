'use client'

import { useState } from 'react'
import { createService, deleteService } from './actions'

export interface ServiceItem {
  id: string
  shop_id: string
  name: string
  duration_minutes: number
  price: number
  description: string | null
  status: string
  created_at: string
}

export default function ServicesManager({ services }: { services: ServiceItem[] }) {
  const [isOpenModal, setIsOpenModal] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleAddSubmit(formData: FormData) {
    setLoading(true)
    const res = await createService(formData)
    setLoading(false)
    if (res?.error) {
      alert(res.error)
    } else {
      setIsOpenModal(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบบริการนี้?')) return
    setLoading(true)
    const res = await deleteService(id)
    setLoading(false)
    if (res?.error) alert(res.error)
  }

  return (
    <div className="flex flex-col w-full relative space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-on-surface font-headline-md leading-tight">รายการบริการ</h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5 font-body-md">
            กำหนดคอร์ส บริการ ระยะเวลา และราคา เพื่อให้บอท AI นำไปใช้แนะนำและเปิดจองคิวให้ลูกค้า
          </p>
        </div>
        <button
          onClick={() => setIsOpenModal(true)}
          className="flex items-center justify-center gap-2 bg-electric-blue hover:bg-primary text-white font-label-md font-semibold px-4 py-2 rounded-xl transition-all shadow-md shadow-electric-blue/20 hover:-translate-y-0.5 cursor-pointer shrink-0 text-xs sm:text-sm"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>เพิ่มบริการใหม่</span>
        </button>
      </div>

      {/* Services Cards */}
      <div className="bg-surface border border-outline-variant/40 rounded-2xl p-6 shadow-sm">
        {services.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((svc) => (
              <div key={svc.id} className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs bg-blue-50 text-electric-blue font-bold px-2.5 py-1 rounded-lg border border-blue-200">
                      ⏱️ {svc.duration_minutes} นาที
                    </span>
                    <button
                      onClick={() => handleDelete(svc.id)}
                      className="text-outline hover:text-error-red p-1 rounded-lg transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>

                  <h3 className="font-bold text-on-surface text-lg">{svc.name}</h3>
                  <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
                    {svc.description || 'ไม่มีรายละเอียดเพิ่มเติม'}
                  </p>
                </div>

                <div className="pt-4 border-t border-outline-variant/20 mt-4 flex items-center justify-between">
                  <span className="text-xs text-outline">ค่าบริการ</span>
                  <span className="text-lg font-bold text-electric-blue">฿{Number(svc.price).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-electric-blue/10 rounded-2xl flex items-center justify-center mb-4 text-electric-blue">
              <span className="material-symbols-outlined text-3xl">design_services</span>
            </div>
            <h3 className="text-lg font-bold text-on-surface mb-1">ยังไม่มีรายการบริการ</h3>
            <p className="text-sm text-on-surface-variant max-w-sm mb-6">
              เพิ่มประเภทบริการ ระยะเวลา และราคา เพื่อให้บอท AI นำไปเสนอให้ลูกค้าจองคิว
            </p>
            <button
              onClick={() => setIsOpenModal(true)}
              className="flex items-center gap-2 bg-electric-blue hover:bg-primary text-white font-label-md font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-electric-blue/20"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              <span>เพิ่มบริการแรกของคุณ</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal: Add Service */}
      {isOpenModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-7 shadow-2xl border border-slate-100 space-y-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-electric-blue flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-2xl">design_services</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">เพิ่มรายการบริการใหม่</h2>
                  <p className="text-xs text-slate-500 mt-0.5">กำหนดคอร์ส ระยะเวลา และราคาค่าบริการ</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpenModal(false)}
                className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form action={handleAddSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-800">ชื่อบริการ</label>
                <input
                  name="name"
                  type="text"
                  required
                  placeholder="เช่น นวดไทยโบราณ, สปาหน้าใส, ตรวจสุขภาพ"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-electric-blue outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-bold text-slate-800">ระยะเวลา (นาที)</label>
                  <input
                    name="duration"
                    type="number"
                    defaultValue="60"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-electric-blue outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-bold text-slate-800">ค่าบริการ (บาท)</label>
                  <input
                    name="price"
                    type="number"
                    defaultValue="500"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-electric-blue outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-800">รายละเอียดบริการ</label>
                <textarea
                  name="description"
                  rows={3}
                  placeholder="รายละเอียด หรือจุดเด่นของบริการ..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-electric-blue outline-none"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOpenModal(false)}
                  className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-7 py-2.5 rounded-xl bg-electric-blue text-white font-bold text-sm shadow-md shadow-electric-blue/20"
                >
                  {loading ? 'กำลังบันทึก...' : 'บันทึกบริการ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
