'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

import { SUPER_ADMIN_EMAILS } from './layout'

export interface PlanItem {
  id?: string
  key: string
  name: string
  price: number
  messages: number
  tokens: number
  description: string
  badge_color?: string
  features: string[]
  stripe_price_id?: string
  /** Automatic slip checks per month; -1 = unlimited */
  slips: number
}

export async function verifySuperAdmin() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return { isSuperAdmin: false, user: null }
  }

  if (SUPER_ADMIN_EMAILS.includes(user.email || '')) {
    return { isSuperAdmin: true, user }
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'superadmin') {
    return { isSuperAdmin: true, user }
  }

  return { isSuperAdmin: false, user }
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

  // Shown only when the plans table can't be read (matches the 2026-10-20 wallet migration)
  const defaultPlans: PlanItem[] = [
    {
      key: 'free',
      name: 'Free',
      price: 0,
      messages: 100,
      tokens: 1000000,
      slips: 0,
      description: 'บอทตอบคำถามลูกค้าได้ ออเดอร์และสลิปส่งให้แอดมินดูแลเอง',
      badge_color: 'bg-surface-container-high text-on-surface',
      features: ['ข้อความ AI 100 ข้อความ/เดือน', 'ตอบแชท LINE OA และ Messenger', 'ระบบแชทสด (Inbox)'],
    },
    {
      key: 'starter',
      name: 'Starter',
      price: 590,
      messages: 1000,
      tokens: 5000000,
      slips: 100,
      description: 'สำหรับร้านเล็กที่เริ่มให้บอทปิดการขาย',
      badge_color: 'bg-electric-blue/10 text-electric-blue border border-electric-blue/20',
      features: ['ข้อความ AI 1,000 ข้อความ/เดือน', 'ตรวจสลิปอัตโนมัติ 100 ครั้ง/เดือน', 'รับออเดอร์ ส่ง QR และติดตามการชำระเงิน', 'ใบเสนอราคาและส่วนลด'],
    },
    {
      key: 'byok',
      name: 'BYOK',
      price: 790,
      messages: -1,
      tokens: -1,
      slips: 300,
      description: 'ใช้ Gemini API Key ของร้านเอง ค่า AI จ่ายตรงกับ Google',
      badge_color: 'bg-success-green/10 text-success-green border border-success-green/20',
      features: ['ข้อความ AI ไม่จำกัด (ใช้ API Key ของร้าน)', 'ตรวจสลิปอัตโนมัติ 300 ครั้ง/เดือน', 'ฟีเจอร์ Pro ทั้งหมด'],
    },
    {
      key: 'pro',
      name: 'Pro',
      price: 1690,
      messages: 3000,
      tokens: 15000000,
      slips: 300,
      description: 'สำหรับร้านที่มีแชทหนาแน่นและระบบจองคิว',
      badge_color: 'bg-amber-500/10 text-amber-600 border border-amber-500/20 font-bold',
      features: ['ข้อความ AI 3,000 ข้อความ/เดือน', 'ตรวจสลิปอัตโนมัติ 300 ครั้ง/เดือน', 'ฟีเจอร์ Starter ทั้งหมด', 'ระบบจองคิวและแจ้งเตือนลูกค้า'],
    },
    {
      key: 'agency',
      name: 'Business',
      price: 4490,
      messages: 8000,
      tokens: 50000000,
      slips: 1000,
      description: 'สำหรับแบรนด์หรือร้านหลายช่องทางที่มียอดแชทสูง',
      badge_color: 'bg-purple-500/10 text-purple-600 border border-purple-500/20 font-bold',
      features: ['ข้อความ AI 8,000 ข้อความ/เดือน', 'ตรวจสลิปอัตโนมัติ 1,000 ครั้ง/เดือน', 'ฟีเจอร์ Pro ทั้งหมด', 'ซัพพอร์ตแบบเร่งด่วน'],
    },
  ]

  if (error || !data || data.length === 0) {
    return defaultPlans
  }

  return data.map((item: any) => ({
    id: item.id,
    key: item.key,
    name: item.name,
    price: Number(item.price || 0),
    messages: Number(item.messages || 0),
    tokens: Number(item.tokens || 0),
    slips: Number(item.slips ?? 0),
    description: item.description || '',
    badge_color: item.badge_color || 'bg-surface-container-high text-on-surface',
    features: Array.isArray(item.features) ? item.features : [],
    stripe_price_id: item.stripe_price_id || '',
  }))
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
