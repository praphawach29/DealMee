'use client'

import { useMemo, useState } from 'react'
import { createService, deleteService, updateService } from './actions'

export interface ServiceItem {
  id: string
  shop_id: string
  name: string
  staff_name: string | null
  duration_minutes: number
  price: number
  description: string | null
  status: string
  available_days: string[] | null
  start_time: string | null
  end_time: string | null
  buffer_minutes: number | null
  created_at: string
}

const days = [
  { key: 'mon', short: 'จ', label: 'จันทร์' },
  { key: 'tue', short: 'อ', label: 'อังคาร' },
  { key: 'wed', short: 'พ', label: 'พุธ' },
  { key: 'thu', short: 'พฤ', label: 'พฤหัส' },
  { key: 'fri', short: 'ศ', label: 'ศุกร์' },
  { key: 'sat', short: 'ส', label: 'เสาร์' },
  { key: 'sun', short: 'อา', label: 'อาทิตย์' },
]

function formatTime(value?: string | null) {
  return value ? value.slice(0, 5) : '--:--'
}

function formatDayRange(dayKeys?: string[] | null) {
  const selected = dayKeys?.length ? dayKeys : days.map((day) => day.key)
  if (selected.length === 7) return 'ทุกวัน'
  const labels = days.filter((day) => selected.includes(day.key)).map((day) => day.short)
  return labels.join(', ')
}

function ServiceModal({
  service,
  loading,
  onClose,
  onSubmit,
}: {
  service: ServiceItem | null
  loading: boolean
  onClose: () => void
  onSubmit: (formData: FormData) => Promise<void>
}) {
  const selectedDays = service?.available_days?.length ? service.available_days : ['mon', 'tue', 'wed', 'thu', 'fri']

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col">
        <div className="flex items-start justify-between px-5 sm:px-7 py-5 border-b border-slate-200">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-950">
              {service ? 'แก้ไขบริการ' : 'เพิ่มบริการใหม่'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              ตั้งค่าบริการ ผู้ให้บริการ และเวลาที่บอทสามารถเปิดจองได้
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
            aria-label="ปิด"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form action={onSubmit} className="overflow-y-auto px-5 sm:px-7 py-5 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-800">ชื่อบริการ</label>
              <input
                name="name"
                type="text"
                required
                defaultValue={service?.name || ''}
                placeholder="เช่น ตัดผมชาย, สระไดร์, จองโต๊ะ"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-electric-blue outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-800">สถานะ</label>
              <select
                name="status"
                defaultValue={service?.status || 'active'}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-electric-blue outline-none"
              >
                <option value="active">เปิดรับจอง</option>
                <option value="inactive">ปิดชั่วคราว</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-800">ผู้ให้บริการ / ช่าง</label>
              <input
                name="staff_name"
                type="text"
                defaultValue={service?.staff_name || ''}
                placeholder="เช่น ช่างเอ"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-electric-blue outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-800">ระยะเวลา (นาที)</label>
              <input
                name="duration"
                type="number"
                min="5"
                step="5"
                defaultValue={service?.duration_minutes || 60}
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-electric-blue outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-800">ราคา (บาท)</label>
              <input
                name="price"
                type="number"
                min="0"
                step="1"
                defaultValue={service?.price || 0}
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-electric-blue outline-none"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-bold text-slate-800">วันที่ให้บริการ</label>
            <div className="grid grid-cols-7 gap-2">
              {days.map((day) => (
                <label key={day.key} className="group cursor-pointer">
                  <input
                    type="checkbox"
                    name="available_days"
                    value={day.key}
                    defaultChecked={selectedDays.includes(day.key)}
                    className="peer sr-only"
                  />
                  <span className="flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-600 transition-all peer-checked:border-electric-blue peer-checked:bg-electric-blue peer-checked:text-white group-hover:border-electric-blue/60">
                    {day.short}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-800">เริ่มให้บริการ</label>
              <input
                name="start_time"
                type="time"
                defaultValue={formatTime(service?.start_time) === '--:--' ? '11:00' : formatTime(service?.start_time)}
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-electric-blue outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-800">ปิดรับจอง</label>
              <input
                name="end_time"
                type="time"
                defaultValue={formatTime(service?.end_time) === '--:--' ? '20:00' : formatTime(service?.end_time)}
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-electric-blue outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-800">พักก่อนคิวถัดไป (นาที)</label>
              <input
                name="buffer_minutes"
                type="number"
                min="0"
                step="5"
                defaultValue={service?.buffer_minutes || 0}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-electric-blue outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-slate-800">รายละเอียด</label>
            <textarea
              name="description"
              rows={3}
              defaultValue={service?.description || ''}
              placeholder="เช่น เหมาะสำหรับลูกค้าที่ต้องการตัดแต่งทรง ใช้เวลาประมาณ 45 นาที"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-electric-blue outline-none resize-none"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-electric-blue text-white font-bold text-sm shadow-md shadow-electric-blue/20 disabled:opacity-60"
            >
              {loading ? 'กำลังบันทึก...' : 'บันทึกบริการ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ServicesManager({ services }: { services: ServiceItem[] }) {
  const [editingService, setEditingService] = useState<ServiceItem | null>(null)
  const [isOpenModal, setIsOpenModal] = useState(false)
  const [loading, setLoading] = useState(false)

  const activeCount = useMemo(() => services.filter((svc) => svc.status !== 'inactive').length, [services])

  function openCreateModal() {
    setEditingService(null)
    setIsOpenModal(true)
  }

  function openEditModal(service: ServiceItem) {
    setEditingService(service)
    setIsOpenModal(true)
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    const res = editingService
      ? await updateService(editingService.id, formData)
      : await createService(formData)
    setLoading(false)
    if (res?.error) {
      alert(res.error)
    } else {
      setIsOpenModal(false)
      setEditingService(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('ต้องการลบบริการนี้ใช่ไหม?')) return
    setLoading(true)
    const res = await deleteService(id)
    setLoading(false)
    if (res?.error) alert(res.error)
  }

  return (
    <div className="flex flex-col w-full relative space-y-5 sm:space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-on-surface font-headline-md leading-tight">ตั้งค่าบริการ</h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1 font-body-md max-w-2xl">
            กำหนดบริการ ผู้ให้บริการ วันเวลา และราคา เพื่อให้บอทใช้เปิดจองคิวได้แม่นยำขึ้น
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 rounded-xl border border-outline-variant/50 bg-surface px-4 py-2 text-sm text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px] text-electric-blue">event_available</span>
            <span>{activeCount} เปิดรับจอง / {services.length} บริการ</span>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center justify-center gap-2 bg-electric-blue hover:bg-primary text-white font-label-md font-semibold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-electric-blue/20 hover:-translate-y-0.5 cursor-pointer shrink-0 text-xs sm:text-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>เพิ่มบริการ</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5">
        <div className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-6 shadow-sm">
          {services.length > 0 ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {services.map((svc) => (
                <div key={svc.id} className="bg-surface-container-lowest border border-outline-variant/35 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${svc.status === 'inactive' ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                          {svc.status === 'inactive' ? 'ปิดชั่วคราว' : 'เปิดรับจอง'}
                        </span>
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-electric-blue border border-blue-200">
                          {svc.duration_minutes} นาที
                        </span>
                      </div>
                      <h3 className="font-bold text-on-surface text-base sm:text-lg truncate">{svc.name}</h3>
                      <p className="text-xs text-on-surface-variant mt-1">
                        {svc.staff_name ? `ผู้ให้บริการ: ${svc.staff_name}` : 'ยังไม่ได้ระบุผู้ให้บริการ'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditModal(svc)}
                        className="w-9 h-9 rounded-lg hover:bg-blue-50 text-outline hover:text-electric-blue transition-colors"
                        aria-label="แก้ไขบริการ"
                      >
                        <span className="material-symbols-outlined text-[19px]">edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(svc.id)}
                        className="w-9 h-9 rounded-lg hover:bg-red-50 text-outline hover:text-error-red transition-colors"
                        aria-label="ลบบริการ"
                      >
                        <span className="material-symbols-outlined text-[19px]">delete</span>
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3">
                      <div className="text-[11px] text-slate-500 font-bold">วันให้บริการ</div>
                      <div className="font-bold text-slate-900 mt-1">{formatDayRange(svc.available_days)}</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3">
                      <div className="text-[11px] text-slate-500 font-bold">เวลา</div>
                      <div className="font-bold text-slate-900 mt-1">{formatTime(svc.start_time)}-{formatTime(svc.end_time)}</div>
                    </div>
                  </div>

                  <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed mt-4 min-h-[2.5rem]">
                    {svc.description || 'ไม่มีรายละเอียดเพิ่มเติม'}
                  </p>

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
              <h3 className="text-lg font-bold text-on-surface mb-1">ยังไม่มีบริการ</h3>
              <p className="text-sm text-on-surface-variant max-w-sm mb-6">
                เพิ่มบริการแรกเพื่อให้บอทเริ่มเช็กเวลาว่างและเปิดจองคิวให้ลูกค้าได้
              </p>
              <button
                onClick={openCreateModal}
                className="flex items-center gap-2 bg-electric-blue hover:bg-primary text-white font-label-md font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-electric-blue/20"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
                <span>เพิ่มบริการแรก</span>
              </button>
            </div>
          )}
        </div>

        <aside className="bg-surface border border-outline-variant/40 rounded-2xl p-5 shadow-sm h-fit space-y-4">
          <div>
            <h2 className="font-bold text-on-surface">ตัวอย่างการตั้งค่า</h2>
            <p className="text-xs text-on-surface-variant mt-1">รูปแบบที่บอทจะนำไปใช้ตอบลูกค้า</p>
          </div>
          <div className="space-y-3 text-sm">
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <div className="font-bold text-slate-900">บริการตัดผม</div>
              <div className="text-slate-600 mt-1">ช่างเอ จ-ศ 11:00-20:00</div>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <div className="font-bold text-slate-900">บริการสระผม</div>
              <div className="text-slate-600 mt-1">ช่างน้อย ส-อา 12:00-18:00</div>
            </div>
          </div>
        </aside>
      </div>

      {isOpenModal && (
        <ServiceModal
          key={editingService?.id || 'new'}
          service={editingService}
          loading={loading}
          onClose={() => {
            setIsOpenModal(false)
            setEditingService(null)
          }}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  )
}
