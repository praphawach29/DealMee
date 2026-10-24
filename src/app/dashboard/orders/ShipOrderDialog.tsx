'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Truck, X } from 'lucide-react'
import { CARRIERS } from '@/lib/orders/tracking'
import { markOrderShipped } from './actions'
import type { OrderItem } from './OrdersManager'

const OTHER = '__other'

/** Carrier + tracking number for one order; saving marks it shipped and can tell the customer in their chat. */
export default function ShipOrderDialog({ order, onClose }: { order: OrderItem; onClose: () => void }) {
  const router = useRouter()
  const known = CARRIERS.some((c) => c.id === order.tracking_carrier)
  const [carrier, setCarrier] = useState(order.tracking_carrier ? (known ? order.tracking_carrier : OTHER) : CARRIERS[0].id)
  const [otherName, setOtherName] = useState(order.tracking_carrier && !known ? order.tracking_carrier : '')
  const [trackingNo, setTrackingNo] = useState(order.tracking_no || '')
  const [trackingUrl, setTrackingUrl] = useState(order.tracking_url || '')
  const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setBusy(true)
    setError('')
    const res = await markOrderShipped({
      orderId: order.id,
      carrier: carrier === OTHER ? otherName : carrier,
      trackingNo,
      trackingUrl,
      notifyCustomer: notify,
    })
    setBusy(false)
    if ('error' in res) {
      setError(res.error)
      return
    }
    alert(res.notice)
    router.refresh()
    onClose()
  }

  const inputClass =
    'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500'

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-indigo-600" /> จัดส่งออเดอร์ {order.order_no}
          </h3>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">ขนส่ง</span>
          <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className={inputClass}>
            {CARRIERS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value={OTHER}>อื่น ๆ</option>
          </select>
        </label>
        {carrier === OTHER && (
          <input value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder="ชื่อขนส่ง" className={inputClass} />
        )}

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">เลขพัสดุ</span>
          <input value={trackingNo} onChange={(e) => setTrackingNo(e.target.value)} placeholder="เช่น TH0123456789" className={`${inputClass} font-mono`} />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">ลิงก์ติดตาม (ไม่บังคับ)</span>
          <input value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="วางลิงก์ที่ขนส่งให้มา ถ้ามี" className={inputClass} />
          <span className="text-[11px] text-slate-400">ถ้าไม่ใส่ ระบบจะส่งเว็บติดตามของขนส่งแทน (ถ้ามี)</span>
        </label>

        <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="mt-0.5" />
          <span>ส่งเลขพัสดุให้ลูกค้าในแชททันที (LINE หรือ Messenger ที่ลูกค้าสั่ง)</span>
        </label>

        {error && <p className="text-xs text-rose-600">{error}</p>}

        <button
          type="button"
          onClick={save}
          disabled={busy || !trackingNo.trim() || (carrier === OTHER && !otherName.trim())}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold disabled:opacity-50 cursor-pointer"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          บันทึกและเปลี่ยนเป็นจัดส่งแล้ว
        </button>
      </div>
    </div>
  )
}
