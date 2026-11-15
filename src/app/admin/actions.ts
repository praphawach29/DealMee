'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { isSuperAdminEmail } from '@/lib/auth/superAdmin'
import {
  PlanItem,
  DEFAULT_ADMIN_PLANS,
  mapPlanRowToItem,
} from '@/lib/admin/plansHelper'

export type { PlanItem }
export { DEFAULT_ADMIN_PLANS, mapPlanRowToItem }

export async function verifySuperAdmin() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return { isSuperAdmin: false, user: null }
  }

  return { isSuperAdmin: isSuperAdminEmail(user.email), user }
}

export async function toggleShopStatus(shopId: string, currentStatus: string) {
  const { isSuperAdmin } = await verifySuperAdmin()
  if (!isSuperAdmin) {
    return { error: 'คุณไม่มีสิทธิ์ผู้ดูแลระบบ Super Admin' }
  }

  // Service role: RLS only lets a user write their own shop and profile
  const supabase = createAdminClient()
  const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended'

  const { error } = await supabase
    .from('shops')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', shopId)

  if (error) {
    return { error: `ไม่สามารถอัปเดตสถานะได้: ${error.message}` }
  }

  revalidatePath('/admin/shops')
  revalidatePath('/admin')
  return { success: `อัปเดตสถานะร้านค้าเป็น "${newStatus === 'active' ? 'เปิดใช้งาน' : 'ระงับชั่วคราว'}" เรียบร้อยแล้ว` }
}

export async function updateShopPlan(shopId: string, newPlan: string) {
  const { isSuperAdmin } = await verifySuperAdmin()
  if (!isSuperAdmin) {
    return { error: 'คุณไม่มีสิทธิ์ผู้ดูแลระบบ Super Admin' }
  }

  // Service role: RLS only lets a user write their own shop and profile
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('shops')
    // plan_key drives quotas and the trial check, so it has to move with plan
    .update({ plan: newPlan, plan_key: newPlan, package_name: newPlan, updated_at: new Date().toISOString() })
    .eq('id', shopId)

  if (error) {
    return { error: `ไม่สามารถอัปเดตแพ็กเกจได้: ${error.message}` }
  }

  revalidatePath('/admin/shops')
  revalidatePath('/admin')
  return { success: `อัปเดตแพ็กเกจเป็น "${newPlan.toUpperCase()}" เรียบร้อยแล้ว` }
}

export async function impersonateShop(shopId: string) {
  const { isSuperAdmin, user } = await verifySuperAdmin()
  if (!isSuperAdmin || !user) {
    return { error: 'คุณไม่มีสิทธิ์ผู้ดูแลระบบ Super Admin' }
  }

  // Service role: RLS only lets a user write their own shop and profile
  const supabase = createAdminClient()

  // Update user's active workspace_id to target shop
  const { error } = await supabase
    .from('users')
    .update({ workspace_id: shopId, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    return { error: `ไม่สามารถสลับไปยังร้านค้านี้ได้: ${error.message}` }
  }

  revalidatePath('/dashboard')
  return { success: `สลับเข้าไปจัดการร้านค้าเรียบร้อยแล้ว` }
}

export async function getPlans(): Promise<PlanItem[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .order('price', { ascending: true })

  if (error || !data || data.length === 0) {
    return DEFAULT_ADMIN_PLANS
  }

  return data.map(mapPlanRowToItem)
}

export async function updatePlanDetails(plan: PlanItem) {
  const { isSuperAdmin } = await verifySuperAdmin()
  if (!isSuperAdmin) {
    return { error: 'คุณไม่มีสิทธิ์ผู้ดูแลระบบ Super Admin' }
  }

  // Service role: the plans table has no write policy for signed-in users
  const supabase = createAdminClient()

  const payload = {
    key: plan.key,
    name: plan.name,
    price: Number(plan.price),
    messages: Number(plan.messages),
    tokens: Number(plan.tokens),
    slips: Number(plan.slips ?? 0),
    description: plan.description,
    badge_color: plan.badge_color || 'bg-surface-container-high text-on-surface',
    features: plan.features,
    stripe_price_id: plan.stripe_price_id || null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('plans')
    .upsert(payload, { onConflict: 'key' })

  if (error) {
    return { error: `ไม่สามารถบันทึกแพ็กเกจได้: ${error.message}` }
  }

  revalidatePath('/admin/plans')
  revalidatePath('/admin')
  return { success: `บันทึกข้อมูลแพ็กเกจ "${plan.name}" สำเร็จแล้ว!` }
}
