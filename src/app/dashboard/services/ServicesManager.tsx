'use client'

import { useMemo, useState } from 'react'
import { createService, deleteService, updateService } from './actions'

export interface ServiceItem {
  id: string
  shop_id: string
  name: string
  booking_type?: string | null
  staff_name: string | null
  resource_label?: string | null
  duration_minutes: number
  price: number
  deposit_amount?: number | null
  capacity_per_slot?: number | null
  required_fields?: string[] | null
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

const bookingTypes = [
  { key: 'service', label: 'บริการทั่วไป', hint: 'ร้านตัดผม สปา คลินิก อู่รถ' },
  { key: 'table', label: 'จองโต๊ะอาหาร', hint: 'ถามจำนวนคนและเวลาเข้าโต๊ะ' },
  { key: 'queue', label: 'จองคิวทั่วไป', hint: 'รับคิวตามรอบหรือช่วงเวลา' },
  { key: 'class', label: 'คลาส/กิจกรรม', hint: 'จำกัดที่นั่งต่อรอบ' },
  { key: 'consultation', label: 'นัดปรึกษา', hint: 'นัดหมายพูดคุยหรือประเมินงาน' },
]

const requiredFieldOptions = [
  { key: 'name', label: 'ชื่อ' },
  { key: 'phone', label: 'เบอร์โทร' },
  { key: 'date', label: 'วันที่' },
  { key: 'time', label: 'เวลา' },
  { key: 'guest_count', label: 'จำนวนคน' },
  { key: 'resource', label: 'ช่าง/โต๊ะ/ห้อง' },
  { key: 'note', label: 'หมายเหตุ' },
  { key: 'deposit_slip', label: 'สลิปมัดจำ' },
]

const defaultFieldsByType: Record<string, string[]> = {
  service: ['name', 'phone', 'date', 'time', 'resource'],
  table: ['name', 'phone', 'date', 'time', 'guest_count'],
  queue: ['name', 'phone', 'date', 'time'],
  class: ['name', 'phone', 'date', 'time', 'guest_count'],
  consultation: ['name', 'phone', 'date', 'time', 'note'],
}

function formatTime(value?: string | null) {
  return value ? value.slice(0, 5) : '--:--'
}

function formatDayRange(dayKeys?: string[] | null) {
  const selected = dayKeys?.length ? dayKeys : days.map((day) => day.key)
  if (selected.length === 7) return 'ทุกวัน'
  return days.filter((day) => selected.includes(day.key)).map((day) => day.short).join(', ')
}

function getBookingTypeLabel(type?: string | null) {
  return bookingTypes.find((item) => item.key === type)?.label || 'บริการทั่วไป'
}

function ServiceModal({ service, loading, onClose, onSubmit }: {
  service: ServiceItem | null
  loading: boolean
  onClose: () => void
  onSubmit: (formData: FormData) => Promise<void>
}) {
  const [bookingType, setBookingType] = useState(service?.booking_type || 'service')
  const selectedDays = service?.available_days?.length ? service.available_days : ['mon', 'tue', 'wed', 'thu', 'fri']
  const selectedFields = service?.required_fields?.length ? service.required_fields : defaultFieldsByType[bookingType]
  const resourcePlaceholder = bookingType === 'table' ? 'เช่น โต๊ะทั่วไป, โซนริมน้ำ' : bookingType === 'class' ? 'เช่น ห้องคลาส A, ครูบี' : 'เช่น ช่างเอ, ห้องตรวจ 1'
  const capacityLabel = bookingType === 'table' ? 'จำนวนคนต่อรอบ' : bookingType === 'class' ? 'ที่นั่งต่อรอบ' : 'จำนวนจองต่อช่วงเวลา'
  const defaultCapacity = bookingType === 'table' ? 20 : bookingType === 'class' ? 12 : 1

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col">
        <div className="flex items-start justify-between px-5 sm:px-7 py-5 border-b border-slate-200">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-950">{service ? 'แก้ไขแม่แบบการจอง' : 'เพิ่มแม่แบบการจอง'}</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">ตั้งค่าประเภทการจอง วันเวลา ความจุ และข้อมูลที่บอทต้องถามลูกค้า</p>
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors" aria-label="ปิด">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form action={onSubmit} className="overflow-y-auto px-5 sm:px-7 py-5 space-y-6">
          <div className="space-y-3">
            <label className="block text-sm font-bold text-slate-800">ประเภทการจอง</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {bookingTypes.map((type) => (
                <label key={type.key} className="cursor-pointer">
                  <input type="radio" name="booking_type" value={type.key} checked={bookingType === type.key} onChange={() => setBookingType(type.key)} className="peer sr-only" />
                  <span className="block min-h-[82px] rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm transition-all peer-checked:border-electric-blue peer-checked:bg-blue-50">
                    <span className="block font-bold text-slate-900">{type.label}</span>
                    <span className="block text-[11px] text-slate-500 mt-1 leading-snug">{type.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-800">ชื่อรายการจอง</label>
              <input name="name" type="text" required defaultValue={service?.name || ''} placeholder="เช่น ตัดผมชาย, จองโต๊ะ, คลาสโยคะ" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-electric-blue outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-800">สถานะ</label>
              <select name="status" defaultValue={service?.status || 'active'} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-electric-blue outline-none">
                <option value="active">เปิดรับจอง</option>
                <option value="inactive">ปิดชั่วคราว</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-sm font-bold text-slate-800">ทรัพยากร / ผู้ให้บริการ</label>
              <input name="resource_label" type="text" defaultValue={service?.resource_label || service?.staff_name || ''} placeholder={resourcePlaceholder} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-electric-blue outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-800">ระยะเวลา (นาที)</label>
              <input name="duration" type="number" min="5" step="5" defaultValue={service?.duration_minutes || (bookingType === 'table' ? 90 : 60)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-electric-blue outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-800">{capacityLabel}</label>
              <input name="capacity_per_slot" type="number" min="1" step="1" defaultValue={service?.capacity_per_slot || defaultCapacity} required className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-electric-blue outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-800">ราคา (บาท)</label>
              <input name="price" type="number" min="0" step="1" defaultValue={service?.price || 0} required className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-electric-blue outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-800">มัดจำ (บาท)</label>
              <input name="deposit_amount" type="number" min="0" step="1" defaultValue={service?.deposit_amount || 0} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-electric-blue outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-800">พักก่อนคิวถัดไป (นาที)</label>
              <input name="buffer_minutes" type="number" min="0" step="5" defaultValue={service?.buffer_minutes || 0} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-electric-blue outline-none" />
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-bold text-slate-800">วันที่ให้บริการ</label>
            <div className="grid grid-cols-7 gap-2">
              {days.map((day) => (
                <label key={day.key} className="group cursor-pointer">
                  <input type="checkbox" name="available_days" value={day.key} defaultChecked={selectedDays.includes(day.key)} className="peer sr-only" />
                  <span className="flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-600 transition-all peer-checked:border-electric-blue peer-checked:bg-electric-blue peer-checked:text-white group-hover:border-electric-blue/60">{day.short}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-800">เริ่มรับจอง</label>
              <input name="start_time" type="time" defaultValue={formatTime(service?.start_time) === '--:--' ? '11:00' : formatTime(service?.start_time)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-electric-blue outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-800">ปิดรับจอง</label>
              <input name="end_time" type="time" defaultValue={formatTime(service?.end_time) === '--:--' ? '20:00' : formatTime(service?.end_time)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-electric-blue outline-none" />
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-bold text-slate-800">ข้อมูลที่บอทต้องถามก่อนบันทึกจอง</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {requiredFieldOptions.map((field) => (
                <label key={field.key} className="cursor-pointer">
                  <input type="checkbox" name="required_fields" value={field.key} defaultChecked={selectedFields.includes(field.key)} className="peer sr-only" />
                  <span className="flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-600 transition-all peer-checked:border-electric-blue peer-checked:bg-blue-50 peer-checked:text-electric-blue">{field.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-slate-800">รายละเอียด</label>
            <textarea name="description" rows={3} defaultValue={service?.description || ''} placeholder="เช่น โต๊ะละไม่เกิน 4 ท่าน หรือบริการนี้ใช้เวลาประมาณ 45 นาที" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-electric-blue outline-none resize-none" />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50">ยกเลิก</button>
            <button type="submit" disabled={loading} className="px-6 py-2.5 rounded-xl bg-electric-blue text-white font-bold text-sm shadow-md shadow-electric-blue/20 disabled:opacity-60">{loading ? 'กำลังบันทึก...' : 'บันทึกแม่แบบ'}</button>
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
    const res = editingService ? await updateService(editingService.id, formData) : await createService(formData)
    setLoading(false)
    if (res?.error) alert(res.error)
    else {
      setIsOpenModal(false)
      setEditingService(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('ต้องการลบแม่แบบการจองนี้ใช่ไหม?')) return
    setLoading(true)
    const res = await deleteService(id)
    setLoading(false)
    if (res?.error) alert(res.error)
  }

  return (
    <div className="flex flex-col w-full relative space-y-5 sm:space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-on-surface font-headline-md leading-tight">ระบบการจอง</h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1 font-body-md max-w-2xl">สร้างแม่แบบการจองกลางสำหรับร้านอาหาร บริการ คิว คลาส และนัดหมาย ให้บอทถามข้อมูลและเปิดจองตามกติกาของแต่ละธุรกิจ</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 rounded-xl border border-outline-variant/50 bg-surface px-4 py-2 text-sm text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px] text-electric-blue">event_available</span>
            <span>{activeCount} เปิดรับจอง / {services.length} แม่แบบ</span>
          </div>
          <button onClick={openCreateModal} className="flex items-center justify-center gap-2 bg-electric-blue hover:bg-primary text-white font-label-md font-semibold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-electric-blue/20 hover:-translate-y-0.5 cursor-pointer shrink-0 text-xs sm:text-sm">
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>เพิ่มแม่แบบ</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5">
        <div className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-6 shadow-sm">
          {services.length > 0 ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {services.map((svc) => (
                <div key={svc.id} className="bg-surface-container-lowest border border-outline-variant/35 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${svc.status === 'inactive' ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{svc.status === 'inactive' ? 'ปิดชั่วคราว' : 'เปิดรับจอง'}</span>
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-electric-blue border border-blue-200">{getBookingTypeLabel(svc.booking_type)}</span>
                      </div>
                      <h3 className="font-bold text-on-surface text-base sm:text-lg truncate">{svc.name}</h3>
                      <p className="text-xs text-on-surface-variant mt-1">{svc.resource_label || svc.staff_name ? `ทรัพยากร: ${svc.resource_label || svc.staff_name}` : 'ใช้คิวรวม ไม่ระบุทรัพยากร'}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEditModal(svc)} className="w-9 h-9 rounded-lg hover:bg-blue-50 text-outline hover:text-electric-blue transition-colors" aria-label="แก้ไข"><span className="material-symbols-outlined text-[19px]">edit</span></button>
                      <button onClick={() => handleDelete(svc.id)} className="w-9 h-9 rounded-lg hover:bg-red-50 text-outline hover:text-error-red transition-colors" aria-label="ลบ"><span className="material-symbols-outlined text-[19px]">delete</span></button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3"><div className="text-[11px] text-slate-500 font-bold">วัน/เวลา</div><div className="font-bold text-slate-900 mt-1">{formatDayRange(svc.available_days)} {formatTime(svc.start_time)}-{formatTime(svc.end_time)}</div></div>
                    <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3"><div className="text-[11px] text-slate-500 font-bold">ความจุ</div><div className="font-bold text-slate-900 mt-1">{svc.capacity_per_slot || 1} ต่อรอบ</div></div>
                    <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3"><div className="text-[11px] text-slate-500 font-bold">ระยะเวลา</div><div className="font-bold text-slate-900 mt-1">{svc.duration_minutes} นาที</div></div>
                    <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3"><div className="text-[11px] text-slate-500 font-bold">ราคา / มัดจำ</div><div className="font-bold text-slate-900 mt-1">฿{Number(svc.price).toLocaleString()} / ฿{Number(svc.deposit_amount || 0).toLocaleString()}</div></div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {(svc.required_fields?.length ? svc.required_fields : defaultFieldsByType[svc.booking_type || 'service']).map((field) => (
                      <span key={field} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">{requiredFieldOptions.find((item) => item.key === field)?.label || field}</span>
                    ))}
                  </div>

                  <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed mt-4 min-h-[2.5rem]">{svc.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center"><div className="w-16 h-16 bg-electric-blue/10 rounded-2xl flex items-center justify-center mb-4 text-electric-blue"><span className="material-symbols-outlined text-3xl">event_available</span></div><h3 className="text-lg font-bold text-on-surface mb-1">ยังไม่มีแม่แบบการจอง</h3><p className="text-sm text-on-surface-variant max-w-sm mb-6">เพิ่มแม่แบบแรกเพื่อให้บอทเริ่มเช็กเวลาว่างและเปิดจองให้ลูกค้าได้</p><button onClick={openCreateModal} className="flex items-center gap-2 bg-electric-blue hover:bg-primary text-white font-label-md font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-electric-blue/20"><span className="material-symbols-outlined text-[20px]">add</span><span>เพิ่มแม่แบบแรก</span></button></div>
          )}
        </div>

        <aside className="bg-surface border border-outline-variant/40 rounded-2xl p-5 shadow-sm h-fit space-y-4">
          <div><h2 className="font-bold text-on-surface">ตัวอย่างธุรกิจ</h2><p className="text-xs text-on-surface-variant mt-1">ใช้ระบบเดียว แต่เปลี่ยนกติกาตามประเภทการจอง</p></div>
          <div className="space-y-3 text-sm">
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4"><div className="font-bold text-slate-900">ร้านอาหาร</div><div className="text-slate-600 mt-1">จองโต๊ะ, รับจำนวนคน, จำกัด 20 คนต่อรอบ</div></div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4"><div className="font-bold text-slate-900">ร้านตัดผม</div><div className="text-slate-600 mt-1">ตัดผม, ช่างเอ, จ-ศ 11:00-20:00</div></div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4"><div className="font-bold text-slate-900">คลาส/กิจกรรม</div><div className="text-slate-600 mt-1">คลาสโยคะ, 15 ที่นั่งต่อรอบ, ถามชื่อและเบอร์</div></div>
          </div>
        </aside>
      </div>

      {isOpenModal && <ServiceModal key={editingService?.id || 'new'} service={editingService} loading={loading} onClose={() => { setIsOpenModal(false); setEditingService(null) }} onSubmit={handleSubmit} />}
    </div>
  )
}
