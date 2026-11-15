'use client'

import { useState } from 'react'
import { PlanItem, updatePlanDetails } from '../actions'
import { PlanCard } from './components/PlanCard'
import { PlanEditModal } from './components/PlanEditModal'

interface PlansManagementProps {
  shopsCountByPlan: Record<string, number>
  initialPlans: PlanItem[]
}

export default function PlansManagement({
  shopsCountByPlan,
  initialPlans,
}: PlansManagementProps) {
  const [plans, setPlans] = useState<PlanItem[]>(initialPlans)
  const [editingPlan, setEditingPlan] = useState<PlanItem | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleOpenEdit = (plan: PlanItem) => {
    setEditingPlan({ ...plan, features: [...(plan.features || [])] })
    setMessage(null)
  }

  const handleSavePlan = async (updatedPlan: PlanItem) => {
    setIsSaving(true)
    setMessage(null)

    const res = await updatePlanDetails(updatedPlan)
    setIsSaving(false)

    if (res.error) {
      setMessage({ type: 'error', text: res.error })
    } else if (res.success) {
      setMessage({ type: 'success', text: res.success })
      setPlans((prev) =>
        prev.map((p) => (p.key === updatedPlan.key ? { ...updatedPlan } : p))
      )
      setEditingPlan(null)
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-on-surface font-headline-md leading-tight">
            แพ็กเกจและราคา DealMee AI
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5 font-body-md">
            จัดการรายละเอียดแพ็กเกจ ปรับเปลี่ยนราคา โควต้าข้อความ และคุณสมบัติต่างๆ ของ DealMee AI
          </p>
        </div>
      </div>

      {/* Alert Toast Notification */}
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

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
        {plans.map((plan) => (
          <PlanCard
            key={plan.key}
            plan={plan}
            shopCount={shopsCountByPlan[plan.key] || 0}
            onEdit={handleOpenEdit}
          />
        ))}
      </div>

      {/* Edit Plan Modal */}
      {editingPlan && (
        <PlanEditModal
          plan={editingPlan}
          isSaving={isSaving}
          onClose={() => setEditingPlan(null)}
          onSave={handleSavePlan}
        />
      )}
    </div>
  )
}
