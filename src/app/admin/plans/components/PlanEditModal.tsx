import React, { useState } from 'react'
import { PlanItem } from '@/app/admin/actions'

interface PlanEditModalProps {
  plan: PlanItem
  isSaving: boolean
  onClose: () => void
  onSave: (updatedPlan: PlanItem) => Promise<void>
}

export function PlanEditModal({
  plan,
  isSaving,
  onClose,
  onSave,
}: PlanEditModalProps) {
  const [editingPlan, setEditingPlan] = useState<PlanItem>({
    ...plan,
    features: [...(plan.features || [])],
  })
  const [newFeatureText, setNewFeatureText] = useState('')

  const handleAddFeature = () => {
    if (!newFeatureText.trim()) return
    setEditingPlan({
      ...editingPlan,
      features: [...editingPlan.features, newFeatureText.trim()],
    })
    setNewFeatureText('')
  }

  const handleRemoveFeature = (index: number) => {
    setEditingPlan({
      ...editingPlan,
      features: editingPlan.features.filter((_: string, i: number) => i !== index),
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(editingPlan)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* 1. Modal Header */}
        <div className="shrink-0 px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <span className="material-symbols-outlined text-[18px]">tune</span>
            </div>
            <div>
              <h3 className="font-bold text-base text-white font-headline-md leading-tight">
                แก้ไขแพ็กเกจ "{editingPlan.name}"
              </h3>
              <p className="text-[11px] text-slate-400">ปรับเปลี่ยนรายละเอียด ราคา และโควต้าใช้งาน</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* 2. Modal Scrollable Form Body */}
        <form id="edit-plan-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-900">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5 font-label-md">
                ชื่อแพ็กเกจ
              </label>
              <input
                type="text"
                value={editingPlan.name}
                onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-400 text-xs sm:text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5 font-label-md">
                ราคา (บาท / เดือน)
              </label>
              <input
                type="number"
                value={editingPlan.price}
                onChange={(e) => setEditingPlan({ ...editingPlan, price: Number(e.target.value) })}
                required
                min={0}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-400 text-xs sm:text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none font-mono transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5 font-label-md">
                โควต้าข้อความ (-1 คือไม่จำกัด)
              </label>
              <input
                type="number"
                value={editingPlan.messages}
                onChange={(e) => setEditingPlan({ ...editingPlan, messages: Number(e.target.value) })}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-400 text-xs sm:text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none font-mono transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5 font-label-md">
                ตรวจสลิป / เดือน (-1 คือไม่จำกัด)
              </label>
              <input
                type="number"
                value={editingPlan.slips}
                onChange={(e) => setEditingPlan({ ...editingPlan, slips: Number(e.target.value) })}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-400 text-xs sm:text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none font-mono transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1.5 font-label-md">
              Stripe Price ID (สำหรับ subscription checkout)
            </label>
            <input
              type="text"
              value={editingPlan.stripe_price_id || ''}
              onChange={(e) => setEditingPlan({ ...editingPlan, stripe_price_id: e.target.value })}
              placeholder="price_xxxxxxxxxxxxx"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-400 text-xs sm:text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none font-mono transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1.5 font-label-md">
              คำอธิบายแพ็กเกจ
            </label>
            <textarea
              rows={2}
              value={editingPlan.description}
              onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-400 text-xs sm:text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none resize-none transition-colors"
            />
          </div>

          {/* Features List Editor */}
          <div className="space-y-2.5 pt-3 border-t border-slate-800">
            <label className="block text-xs font-bold text-slate-200 font-label-md">
              รายการฟีเจอร์เด่นในแพ็กเกจ
            </label>

            <div className="flex gap-2">
              <input
                type="text"
                value={newFeatureText}
                onChange={(e) => setNewFeatureText(e.target.value)}
                placeholder="พิมพ์ฟีเจอร์ใหม่ เช่น 'เช็คสลิปโอนเงินอัตโนมัติ'..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddFeature()
                  }
                }}
                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-400 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
              />
              <button
                type="button"
                onClick={handleAddFeature}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl transition-all cursor-pointer shrink-0 shadow-xs"
              >
                + เพิ่ม
              </button>
            </div>

            <ul className="space-y-1.5 mt-2">
              {editingPlan.features.map((feat: string, index: number) => (
                <li
                  key={index}
                  className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-xs text-slate-200"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-emerald-400 shrink-0">
                      check_circle
                    </span>
                    <span className="font-medium text-white">{feat}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveFeature(index)}
                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 p-1 rounded-lg transition-colors cursor-pointer"
                    title="ลบฟีเจอร์นี้"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </form>

        {/* 3. Modal Sticky Footer */}
        <div className="shrink-0 px-6 py-3.5 border-t border-slate-800 bg-slate-900 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            form="edit-plan-form"
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSaving ? (
              <>
                <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                <span>กำลังบันทึก...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">save</span>
                <span>บันทึกแพ็กเกจ</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
