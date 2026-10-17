'use server'

import { createClient } from '@/utils/supabase/server'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { revalidatePath } from 'next/cache'

export async function updateShopFeatures(features: Record<string, boolean>) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: 'กรุณาเข้าสู่ระบบอีกครั้ง' }
  }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id) {
    return { error: 'ไม่พบข้อมูลร้านค้า' }
  }

  const mergedFeatures = {
    ...((shop.features as Record<string, any>) || {}),
    ...features,
  }

  const { error } = await supabase
    .from('shops')
    .update({
      features: mergedFeatures,
      updated_at: new Date().toISOString(),
    })
    .eq('id', shop.id)

  if (error) {
    return { error: `บันทึกสวิตช์ไม่สำเร็จ: ${error.message}` }
  }

  revalidatePath('/dashboard', 'layout')
  revalidatePath('/dashboard/modules')
  return { success: 'บันทึกการเปิด-ปิดเครื่องมือเรียบร้อยแล้ว!' }
}

/** Max discount (% of an order) the sales bot may grant on its own; 0 turns it off. */
export async function updateBotDiscountCap(percent: number) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: 'กรุณาเข้าสู่ระบบอีกครั้ง' }
  }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id) {
    return { error: 'ไม่พบข้อมูลร้านค้า' }
  }

  const value = Math.round(Number(percent))
  if (!Number.isFinite(value) || value < 0 || value > 50) {
    return { error: 'เพดานส่วนลดต้องอยู่ระหว่าง 0–50%' }
  }

  const { error } = await supabase
    .from('shops')
    .update({
      features: { ...((shop.features as Record<string, any>) || {}), max_discount_percent: value },
      updated_at: new Date().toISOString(),
    })
    .eq('id', shop.id)

  if (error) {
    return { error: `บันทึกไม่สำเร็จ: ${error.message}` }
  }

  revalidatePath('/dashboard/modules')
  return { success: value > 0 ? `บอทให้ส่วนลดได้สูงสุด ${value}% ต่อออเดอร์` : 'ปิดการให้ส่วนลดโดยบอทแล้ว' }
}
