'use server'

import { createClient } from '@/utils/supabase/server'
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

  const supabase = await createClient()
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

  const supabase = await createClient()

  const { error } = await supabase
    .from('shops')
    .update({ plan: newPlan, package_name: newPlan, updated_at: new Date().toISOString() })
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

  const supabase = await createClient()

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

  const defaultPlans: PlanItem[] = [
    {
      key: 'free',
      name: 'ทดลองใช้งาน',
      price: 0,
      messages: 500,
      tokens: 1000000,
      description: 'สำหรับร้านค้าทดลองใช้งาน DealMee AI เบื้องต้น 14 วัน',
      badge_color: 'bg-surface-container-high text-on-surface',
      features: ['ตอบแชท DealMee AI บน LINE OA', 'คลังความรู้ FAQ 10 ข้อ', 'ระบบแชทสด'],
    },
    {
      key: 'starter',
      name: 'เริ่มต้น',
      price: 390,
      messages: 3000,
      tokens: 3000000,
      description: 'สำหรับร้านค้าขนาดเล็กที่เน้นปิดการขายใน LINE OA',
      badge_color: 'bg-electric-blue/10 text-electric-blue border border-electric-blue/20',
      features: ['ตอบแชท DealMee AI บน LINE OA', 'คลังความรู้ไม่จำกัด', 'ระบบจัดการสินค้า 50 รายการ', 'เช็คสลิปโอนเงินอัตโนมัติ'],
    },
    {
      key: 'pro',
      name: 'มืออาชีพ (แนะนำ ✨)',
      price: 990,
      messages: 10000,
      tokens: 15000000,
      description: 'สำหรับร้านค้าที่มียอดแชทหนาแน่น รองรับระบบจองคิวครบวงจร',
      badge_color: 'bg-amber-500/10 text-amber-600 border border-amber-500/20 font-bold',
      features: ['ฟีเจอร์ Starter ทั้งหมด', '✨ AI Copywriter ช่วยเขียนรายละเอียดสินค้า', 'ระบบจองคิวบริการอัตโนมัติ', 'ระบบจัดส่งพัสดุ & แจ้งเลข Tracking', 'ตรวจสลิปโอนเงินฟรี 100 รายการ/เดือน'],
    },
    {
      key: 'agency',
      name: 'ธุรกิจองค์กร',
      price: 2490,
      messages: 30000,
      tokens: 50000000,
      description: 'สำหรับแบรนด์ใหญ่หรือเอเจนซี่ที่ต้องการการดูแลระดับ VIP',
      badge_color: 'bg-purple-500/10 text-purple-600 border border-purple-500/20 font-bold',
      features: ['ฟีเจอร์ Pro ทั้งหมด', '✨ AI Copywriter ช่วยเขียนรายละเอียดสินค้า', 'ตรวจสลิปโอนเงินไม่จำกัด', 'รองรับเชื่อมต่อหลายเพจ/LINE OA', 'ทีมงานตั้งค่าและซัพพอร์ต 24/7'],
    },
    {
      key: 'byok',
      name: 'ใช้ API Key ตัวเอง',
      price: 590,
      messages: -1,
      tokens: -1,
      description: 'ใส่ API Key ของ Gemini/Claude เอง โดยไม่ต้องกังวลเรื่องลิมิต',
      badge_color: 'bg-success-green/10 text-success-green border border-success-green/20',
      features: ['ไม่จำกัดจำนวนข้อความ & Token', '✨ AI Copywriter ช่วยเขียนรายละเอียดสินค้า', 'ใช้ API Key ของตนเอง', 'เข้าถึงทุกมอดูลและฟีเจอร์ในระบบ'],
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

  const supabase = await createClient()

  const payload = {
    key: plan.key,
    name: plan.name,
    price: Number(plan.price),
    messages: Number(plan.messages),
    tokens: Number(plan.tokens),
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
