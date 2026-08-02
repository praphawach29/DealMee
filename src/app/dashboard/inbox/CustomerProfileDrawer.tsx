'use client'

import { useEffect, useState } from 'react'
import { fetchCustomerProfile } from './actions'
import type { CustomerProfileSummary } from '@/lib/customerMemory'

interface CustomerProfileDrawerProps {
  userId: string
  customerName: string
  onClose: () => void
}

export default function CustomerProfileDrawer({
  userId,
  customerName,
  onClose,
}: CustomerProfileDrawerProps) {
  const [profile, setProfile] = useState<CustomerProfileSummary | null>(null)
  const [isVip, setIsVip] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    setLoading(true)

    fetchCustomerProfile(userId).then((res) => {
      if (!isMounted) return
      setLoading(false)
      if (res && 'profile' in res) {
        setProfile(res.profile || null)
        setIsVip(Boolean(res.isVip))
      }
    })

    return () => {
      isMounted = false
    }
  }, [userId])

  const prefEntries = profile ? Object.entries(profile.preferences) : []

  return (
    <div className="w-80 h-full border-l border-outline-variant/30 bg-surface-container-lowest flex flex-col shrink-0 shadow-lg z-20">
      {/* Header */}
      <div className="p-4 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-low">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-electric-blue text-lg">person_search</span>
          <h3 className="text-sm font-bold text-on-surface truncate">โปรไฟล์ลูกค้า (AI Memory)</h3>
        </div>
        <button
          onClick={onClose}
          className="text-outline hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-all"
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        {/* Customer Identity Card */}
        <div className="p-3 bg-surface rounded-xl border border-outline-variant/30 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-on-surface text-sm">{customerName}</h4>
            {isVip && (
              <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded border border-amber-300">
                👑 VIP Customer
              </span>
            )}
          </div>
          <p className="text-[10px] text-outline font-mono truncate">ID: {userId}</p>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-outline-variant/20 text-center">
            <div className="bg-surface-container-low p-2 rounded-lg">
              <span className="text-[10px] text-outline">ออเดอร์ทั้งหมด</span>
              <p className="font-bold text-on-surface text-sm">{profile?.totalOrders || 0}</p>
            </div>
            <div className="bg-surface-container-low p-2 rounded-lg">
              <span className="text-[10px] text-outline">ยอดซื้อสะสม</span>
              <p className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                ฿{(profile?.totalSpend || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-center text-outline space-y-2">
            <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
            <p className="text-xs">กำลังดึงข้อมูลความจำลูกค้า...</p>
          </div>
        ) : (
          <>
            {/* Tags */}
            <div className="space-y-2">
              <h5 className="font-bold text-on-surface text-xs flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-electric-blue">label</span>
                Tags ประจำตัว
              </h5>
              {profile?.tags && profile.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {profile.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-[10px] font-bold bg-electric-blue/10 text-electric-blue rounded-md border border-electric-blue/20"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-outline italic">ยังไม่มี Tag</p>
              )}
            </div>

            {/* Preferences */}
            <div className="space-y-2">
              <h5 className="font-bold text-on-surface text-xs flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-purple-500">favorite</span>
                ความชอบ / สเปก (Preferences)
              </h5>
              {prefEntries.length > 0 ? (
                <div className="bg-surface-container-low rounded-xl p-2.5 space-y-1.5 border border-outline-variant/20">
                  {prefEntries.map(([k, v]) => (
                    <div key={k} className="flex justify-between items-center text-[11px]">
                      <span className="text-outline font-medium">{k}:</span>
                      <span className="font-bold text-on-surface">{v}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-outline italic">ยังไม่มีข้อมูลความชอบ</p>
              )}
            </div>

            {/* Notes Timeline */}
            <div className="space-y-2">
              <h5 className="font-bold text-on-surface text-xs flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-amber-500">description</span>
                ประวัติบันทึกย่อ (Notes Timeline)
              </h5>
              {profile?.notes && profile.notes.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {profile.notes.map((n, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-surface rounded-lg border border-outline-variant/30 space-y-0.5"
                    >
                      <p className="text-[11px] text-on-surface font-medium">{n.text}</p>
                      <p className="text-[9px] text-outline">
                        {n.created_at
                          ? new Date(n.created_at).toLocaleString('th-TH', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })
                          : ''}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-outline italic">ยังไม่มีบันทึกย่อ</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
