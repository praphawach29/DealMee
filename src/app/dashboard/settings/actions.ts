'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  startSalesAgentPlanning,
  continueSalesAgentPlanning,
  getQuotaStatus,
  QUOTA_EXCEEDED_MESSAGE_TH,
  planningAckMessage,
} from '@/lib/ai/salesAgentEngine'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { buildAutoGreeting } from '@/lib/businessGreeting'
import { upsertCustomerProfile } from '@/lib/customerMemory'

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

  const rawToken = (formData.get('line_token') as string) || ''
  const rawSecret = (formData.get('line_secret') as string) || ''

  const updateData = {
    name: ((formData.get('name') as string) || '').trim(),
    bot_name: ((formData.get('bot_name') as string) || '').trim(),
    description: ((formData.get('description') as string) || '').trim(),
    personality: ((formData.get('personality') as string) || '').trim(),
    greeting_message: ((formData.get('greeting_message') as string) || '').trim(),
    system_prompt: ((formData.get('system_prompt') as string) || '').trim(),
    line_token: rawToken.trim(),
    line_secret: rawSecret.trim(),
    company_name: ((formData.get('company_name') as string) || '').trim(),
    company_tax_id: ((formData.get('company_tax_id') as string) || '').trim(),
    company_address: ((formData.get('company_address') as string) || '').trim(),
    company_phone: ((formData.get('company_phone') as string) || '').trim(),
    company_email: ((formData.get('company_email') as string) || '').trim(),
    company_logo_url: ((formData.get('company_logo_url') as string) || '').trim(),
    vat_enabled: formData.get('vat_enabled') === 'true' || formData.get('vat_enabled') === 'on',
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

  const promptpay_qr_enabled = formData.get('promptpay_qr_enabled') === 'true' || formData.get('promptpay_qr_enabled') === 'on'
  const cod_enabled = formData.get('cod_enabled') === 'true' || formData.get('cod_enabled') === 'on'

  const updateData = {
    promptpay_number: ((formData.get('promptpay_number') as string) || '').trim(),
    promptpay_name: ((formData.get('promptpay_name') as string) || '').trim(),
    promptpay_qr_enabled,
    bank_name: (formData.get('bank_name') as string) || '',
    bank_account_number: ((formData.get('bank_account_number') as string) || '').trim(),
    bank_account_name: ((formData.get('bank_account_name') as string) || '').trim(),
    shipping_provider: (formData.get('shipping_provider') as string) || '',
    shipping_fee_type: (formData.get('shipping_fee_type') as string) || 'flat',
    shipping_fee_amount: Number(formData.get('shipping_fee_amount') || 0),
    shipping_zone_bkk: Number(formData.get('shipping_zone_bkk') || 40),
    shipping_zone_upcountry: Number(formData.get('shipping_zone_upcountry') || 60),
    shipping_zone_remote: Number(formData.get('shipping_zone_remote') || 100),
    free_shipping_threshold,
    cod_enabled,
    cod_fee_type: (formData.get('cod_fee_type') as string) || 'flat',
    cod_fee_amount: Number(formData.get('cod_fee_amount') || 30),
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

export async function updateCompanySettings(formData: FormData) {
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
    company_name: ((formData.get('company_name') as string) || '').trim(),
    company_tax_id: ((formData.get('company_tax_id') as string) || '').trim(),
    company_address: ((formData.get('company_address') as string) || '').trim(),
    company_phone: ((formData.get('company_phone') as string) || '').trim(),
    company_email: ((formData.get('company_email') as string) || '').trim(),
    company_logo_url: ((formData.get('company_logo_url') as string) || '').trim(),
    vat_enabled: formData.get('vat_enabled') === 'true' || formData.get('vat_enabled') === 'on',
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
  return { success: 'บันทึกข้อมูลบริษัทและใบเสนอราคาเรียบร้อยแล้ว!' }
}


export async function getPlaygroundGreeting() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { greeting: 'สวัสดีค่ะ มีอะไรให้ช่วยไหมคะ?' }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id) return { greeting: 'สวัสดีค่ะ มีอะไรให้ช่วยไหมคะ?' }

  const { data: templates } = await supabase
    .from('services')
    .select('name, booking_type, resource_label, staff_name')
    .eq('shop_id', shop.id)
    .neq('status', 'inactive')
    .order('created_at', { ascending: false })
    .limit(8)

  return {
    greeting: buildAutoGreeting(shop, templates || []),
    hasTableBooking: (templates || []).some((item: any) => item.booking_type === 'table'),
  }
}
/** One message exactly as LINE would deliver it, in delivery order. */
export interface PlaygroundBubble {
  type: 'text' | 'image'
  content: string
  /** Where it came from, so the UI can label it: the quick acknowledgement LINE sends while a multi-step plan runs, the bot's own reply, or a message a tool pushed itself. */
  origin: 'ack' | 'reply' | 'tool'
}

export interface PlaygroundResult {
  bubbles: PlaygroundBubble[]
  /** Tools that really ran, for the debug strip under the conversation. */
  toolCalls: { name: string; args: Record<string, any> }[]
  /** Follow-ups the bot scheduled — LINE would push these after a delay. */
  scheduled: { delayMinutes: number; content: string }[]
  quotaExceeded: boolean
  error?: string
}

/**
 * The Playground's conversation, as a real `conversations` row. Two reasons
 * it can't stay a synthetic `playground-<uuid>` string: `orders.conversation_id`
 * and `chat_messages.conversation_id` are UUID columns that such a string
 * can't be written to, and tools that read conversation history need a row
 * to read. `platform: 'PLAYGROUND'` marks it so the Inbox can tell it apart
 * from a real customer.
 */
async function getOrCreatePlaygroundConversation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shopId: string,
  userId: string
) {
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('shop_id', shopId)
    .eq('user_id', userId)
    .eq('platform', 'PLAYGROUND')
    .maybeSingle()

  if (existing?.id) return existing.id as string

  const { data: created } = await supabase
    .from('conversations')
    .insert({
      shop_id: shopId,
      user_id: userId,
      customer_name: 'ผู้ทดสอบ (Chat Playground)',
      platform: 'PLAYGROUND',
      status: 'ai',
    })
    .select('id')
    .single()

  return (created?.id as string) || null
}

export async function testPlaygroundChat(
  userQuery: string,
  customBotName?: string,
  customPersonality?: string,
  simulateQuotaExceeded?: boolean,
  conversationHistory?: { sender: 'user' | 'bot'; text: string }[]
): Promise<PlaygroundResult> {
  const empty = { bubbles: [], toolCalls: [], scheduled: [], quotaExceeded: false }
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { ...empty, error: 'กรุณาล็อกอินก่อนใช้งานระบบทดสอบแชท' }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id) return { ...empty, error: 'ไม่พบข้อมูลร้านค้า' }

  const customShop = {
    ...shop,
    bot_name: customBotName || shop.bot_name || 'น้อง Botify',
    personality: customPersonality || shop.personality || 'สุภาพ เรียบร้อย มืออาชีพ และมุ่งมั่นให้บริการ',
  }

  // Lets a shop owner preview the exact message customers see once quota runs
  // out, without spending any of the shop's real message quota to trigger it.
  if (simulateQuotaExceeded) {
    return { ...empty, bubbles: [{ type: 'text', content: QUOTA_EXCEEDED_MESSAGE_TH, origin: 'reply' }], quotaExceeded: true }
  }

  // Customer Memory Graph: mirror the webhook's upsert so the tester's
  // pseudo-customer profile exists before any note/tag tool call needs it,
  // and so the auto-injected profile context works in the Playground too.
  await upsertCustomerProfile(shop.id, user.id, 'ผู้ทดสอบ (Chat Playground)')

  const conversationId = await getOrCreatePlaygroundConversation(supabase, shop.id, user.id)
  if (!conversationId) return { ...empty, error: 'สร้างบทสนทนาทดสอบไม่สำเร็จ' }

  try {
    // Same two-phase call the LINE webhook makes, so a plan that needs more
    // than one AI call takes the same path here — including the short
    // acknowledgement LINE sends before the real answer, which the old
    // single-call Playground could never show.
    const bubbles: PlaygroundBubble[] = []
    const started = await startSalesAgentPlanning({
      shop: customShop,
      userQuery,
      userId: user.id,
      conversationId,
      conversationHistory,
      supabaseClient: supabase,
    })

    let result
    if (started.done) {
      result = started.result
    } else {
      bubbles.push({ type: 'text', content: planningAckMessage(started.state), origin: 'ack' })
      result = await continueSalesAgentPlanning(started.state)
    }

    // Delivery order mirrors deliverAgentResult(): the bot's reply first,
    // then anything a tool pushed on its own.
    if (result.text) bubbles.push({ type: 'text', content: result.text, origin: 'reply' })
    for (const msg of result.immediateMessages) {
      bubbles.push({ type: msg.type, content: msg.content, origin: 'tool' })
    }

    return {
      bubbles,
      toolCalls: result.toolCallsExecuted,
      scheduled: result.scheduledMessages.map((s) => ({
        delayMinutes: Math.round(s.delayMs / 60000),
        content: s.message.content,
      })),
      quotaExceeded: result.quotaExceeded === true,
    }
  } catch (err: any) {
    return { ...empty, error: `เกิดข้อผิดพลาด: ${err.message}` }
  }
}

/** Current-period usage vs. plan limit, for display in the Chat Playground so a shop owner can see real quota state while testing. */
export async function getPlaygroundQuotaStatus() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop) return null

  try {
    const status = await getQuotaStatus(shop)
    return status
  } catch (err) {
    console.error('[getPlaygroundQuotaStatus] Exception:', err)
    return null
  }
}
