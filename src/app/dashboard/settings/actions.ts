'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { processSalesAgentChat } from '@/lib/ai/salesAgentEngine'
import { getOrCreateShopForUser } from '@/lib/shopHelper'

export async function updateBotSettings(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'กรุณาเข้าสู่ระบบอีกครั้ง' }
  }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id) {
    return { error: 'ไม่สามารถสร้างหรือค้นหาข้อมูลร้านค้าได้' }
  }

  const updateData = {
    name: formData.get('name') as string,
    bot_name: formData.get('bot_name') as string,
    description: formData.get('description') as string,
    personality: formData.get('personality') as string,
    greeting_message: formData.get('greeting_message') as string,
    system_prompt: formData.get('system_prompt') as string,
    line_token: formData.get('line_token') as string,
    line_secret: formData.get('line_secret') as string,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('shops')
    .update(updateData)
    .eq('id', shop.id)

  if (error) {
    return { error: `บันทึกไม่สำเร็จ: ${error.message}` }
  }

  revalidatePath('/dashboard/settings')
  return { success: 'บันทึกการตั้งค่าบอทเรียบร้อยแล้ว!' }
}

export async function updatePaymentShippingSettings(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'กรุณาเข้าสู่ระบบอีกครั้ง' }
  }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id) {
    return { error: 'ไม่พบข้อมูลร้านค้า' }
  }

  const freeShippingStr = formData.get('free_shipping_threshold') as string
  const free_shipping_threshold = freeShippingStr ? Number(freeShippingStr) : null

  const updateData = {
    promptpay_number: formData.get('promptpay_number') as string,
    promptpay_name: formData.get('promptpay_name') as string,
    bank_name: formData.get('bank_name') as string,
    bank_account_number: formData.get('bank_account_number') as string,
    bank_account_name: formData.get('bank_account_name') as string,
    shipping_provider: formData.get('shipping_provider') as string,
    shipping_fee_type: formData.get('shipping_fee_type') as string,
    shipping_fee_amount: Number(formData.get('shipping_fee_amount') || 0),
    free_shipping_threshold,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('shops')
    .update(updateData)
    .eq('id', shop.id)

  if (error) {
    return { error: `บันทึกไม่สำเร็จ: ${error.message}` }
  }

  revalidatePath('/dashboard/settings')
  return { success: 'บันทึกข้อมูลชำระเงินและการจัดส่งเรียบร้อยแล้ว!' }
}

export async function testPlaygroundChat(
  userQuery: string,
  customBotName?: string,
  customPersonality?: string
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { response: 'กรุณาล็อกอินก่อนใช้งานระบบทดสอบแชท' }

  let shop = await getOrCreateShopForUser(supabase, user)

  if (!shop) {
    shop = { id: 'test-shop', name: 'ร้านค้าทดสอบ', bot_name: 'น้อง Botify' }
  }

  const customShop = {
    ...shop,
    bot_name: customBotName || shop.bot_name || 'น้อง Botify',
    personality: customPersonality || shop.personality || 'สุภาพ เรียบร้อย มืออาชีพ และมุ่งมั่นให้บริการ',
  }

  try {
    const response = await processSalesAgentChat({
      shop: customShop,
      userQuery,
      userId: user.id,
      conversationId: `playground-${user.id}`,
    })

    return { response: response.text }
  } catch (err: any) {
    return { response: `เกิดข้อผิดพลาด: ${err.message}` }
  }
}
