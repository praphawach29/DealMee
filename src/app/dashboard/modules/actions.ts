'use server'

import { createClient } from '@/utils/supabase/server'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { revalidatePath } from 'next/cache'
import { PENDING_ORDER_EXPIRY_OPTIONS } from '@/lib/orders/pendingOrderExpiry'
import { isValidTime, type BusinessHours } from '@/lib/shop/businessHours'
import { HIGH_VALUE_THRESHOLD_OPTIONS } from '@/lib/ai/salesModes'

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

const FOLLOW_UP_KEYS = ['qr_recovery_enabled', 'qr_recovery_delay_mins', 'booking_reminder_enabled', 'repurchase_enabled', 'repurchase_delay_days'] as const
const QR_DELAY_MINS = [15, 20, 30, 60]
const REPURCHASE_DELAY_DAYS = [14, 21, 30]

/** Saves part of shops.follow_up_config (the automatic follow-up messages) */
export async function updateFollowUpConfig(patch: Record<string, boolean | number>) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: 'กรุณาเข้าสู่ระบบอีกครั้ง' }
  }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id) {
    return { error: 'ไม่พบข้อมูลร้านค้า' }
  }

  const clean: Record<string, boolean | number> = {}
  for (const key of FOLLOW_UP_KEYS) {
    if (!(key in patch)) continue
    const value = patch[key]
    if (key.endsWith('_enabled')) clean[key] = value === true
    else if (key === 'qr_recovery_delay_mins' && QR_DELAY_MINS.includes(Number(value))) clean[key] = Number(value)
    else if (key === 'repurchase_delay_days' && REPURCHASE_DELAY_DAYS.includes(Number(value))) clean[key] = Number(value)
    else return { error: 'ค่าที่เลือกไม่ถูกต้อง' }
  }

  const { error } = await supabase
    .from('shops')
    .update({
      follow_up_config: { ...((shop.follow_up_config as Record<string, any>) || {}), ...clean },
      updated_at: new Date().toISOString(),
    })
    .eq('id', shop.id)

  if (error) {
    return { error: `บันทึกไม่สำเร็จ: ${error.message}` }
  }

  revalidatePath('/dashboard/modules')
  return { success: 'บันทึกการตั้งค่าข้อความติดตามลูกค้าแล้ว' }
}

/** Hours an unpaid order stays open before it is cancelled and its stock returned; 0 never cancels */
export async function updatePendingOrderExpiry(hours: number) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: 'กรุณาเข้าสู่ระบบอีกครั้ง' }
  }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id) {
    return { error: 'ไม่พบข้อมูลร้านค้า' }
  }

  const value = Number(hours)
  if (!PENDING_ORDER_EXPIRY_OPTIONS.includes(value)) {
    return { error: 'ค่าที่เลือกไม่ถูกต้อง' }
  }

  const { error } = await supabase
    .from('shops')
    .update({
      features: { ...((shop.features as Record<string, any>) || {}), pending_order_expiry_hours: value },
      updated_at: new Date().toISOString(),
    })
    .eq('id', shop.id)

  if (error) {
    return { error: `บันทึกไม่สำเร็จ: ${error.message}` }
  }

  revalidatePath('/dashboard/modules')
  return { success: value > 0 ? `ออเดอร์ที่ไม่ชำระภายใน ${value} ชั่วโมงจะถูกยกเลิกอัตโนมัติ` : 'ปิดการยกเลิกออเดอร์ค้างชำระอัตโนมัติแล้ว' }
}

/** Price from which the bot hands the sale to the admin instead of ordering itself (features.high_value_threshold) */
export async function updateHighValueThreshold(threshold: number) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: 'กรุณาเข้าสู่ระบบอีกครั้ง' }
  }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id) {
    return { error: 'ไม่พบข้อมูลร้านค้า' }
  }

  const value = Number(threshold)
  if (!HIGH_VALUE_THRESHOLD_OPTIONS.includes(value)) {
    return { error: 'ค่าที่เลือกไม่ถูกต้อง' }
  }

  const { error } = await supabase
    .from('shops')
    .update({
      features: { ...((shop.features as Record<string, any>) || {}), high_value_threshold: value },
      updated_at: new Date().toISOString(),
    })
    .eq('id', shop.id)

  if (error) {
    return { error: `บันทึกไม่สำเร็จ: ${error.message}` }
  }

  revalidatePath('/dashboard/modules')
  return {
    success: value > 0
      ? `สินค้าราคาตั้งแต่ ${value.toLocaleString()} บาท บอทจะเก็บข้อมูลติดต่อแล้วส่งให้แอดมินปิดการขาย`
      : 'บอทจะรับออเดอร์สินค้าทุกราคาเอง',
  }
}

/** Saves features.business_hours (when the shop is open and whether the bot answers then) */
export async function updateBusinessHours(hours: BusinessHours) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: 'กรุณาเข้าสู่ระบบอีกครั้ง' }
  }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id) {
    return { error: 'ไม่พบข้อมูลร้านค้า' }
  }

  const days = [...new Set((hours.days || []).map(Number))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort()
  if (!isValidTime(hours.open) || !isValidTime(hours.close)) {
    return { error: 'รูปแบบเวลาไม่ถูกต้อง' }
  }
  if (hours.enabled && days.length === 0) {
    return { error: 'เลือกวันทำการอย่างน้อย 1 วัน' }
  }

  const value: BusinessHours = {
    enabled: hours.enabled === true,
    days,
    open: hours.open,
    close: hours.close,
    bot_mode: hours.bot_mode === 'always' ? 'always' : 'outside_hours',
  }

  const { error } = await supabase
    .from('shops')
    .update({
      features: { ...((shop.features as Record<string, any>) || {}), business_hours: value },
      updated_at: new Date().toISOString(),
    })
    .eq('id', shop.id)

  if (error) {
    return { error: `บันทึกไม่สำเร็จ: ${error.message}` }
  }

  revalidatePath('/dashboard/modules')
  return { success: value.enabled ? 'บันทึกเวลาทำการแล้ว' : 'ปิดการใช้เวลาทำการแล้ว บอทตอบตลอด 24 ชั่วโมง' }
}
