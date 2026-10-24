'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import qrcode from 'qrcode'
import {
  startSalesAgentPlanning,
  continueSalesAgentPlanning,
  getQuotaStatus,
  QUOTA_EXCEEDED_MESSAGE_TH,
  planningAckMessage,
} from '@/lib/ai/salesAgentEngine'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { facebookPageUsedByOtherShop, fetchLineBotInfo, lineOaUsedByOtherShop } from '@/lib/shop/channelOwnership'
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

  // Only the fields the bot-settings form submits. This action used to also write
  // line_token/line_secret, Facebook credentials, company details and vat_enabled from
  // inputs this form doesn't have, so saving the bot tab wiped them to empty strings.
  // Channels, company and payment details have their own actions.
  const text = (key: string) => ((formData.get(key) as string) || '').trim()
  // follow_up_config is edited on /dashboard/modules
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  for (const key of ['name', 'bot_name', 'description', 'personality', 'greeting_message', 'system_prompt', 'ai_model']) {
    if (formData.has(key)) updateData[key] = text(key)
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

export async function updateChannelSettings(formData: FormData) {
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

  const lineToken = ((formData.get('line_token') as string) || '').trim()
  const lineSecret = ((formData.get('line_secret') as string) || '').trim()
  // Without the secret the webhook can't verify LINE's signature, so anyone could post
  // fake customer messages to this shop's bot
  if (lineToken && !lineSecret) {
    return { error: 'กรุณาใส่ Channel Secret คู่กับ Channel Access Token (ใช้ตรวจว่าข้อความมาจาก LINE จริง)' }
  }
  if (lineSecret && !/^[0-9a-f]{32}$/i.test(lineSecret)) {
    return { error: 'Channel Secret ไม่ถูกต้อง ต้องเป็นตัวอักษร 0-9 และ a-f จำนวน 32 ตัว (ดูที่ LINE Developers → Basic settings)' }
  }
  const fbPageId = ((formData.get('facebook_page_id') as string) || '').trim()
  const fbPageToken = ((formData.get('facebook_page_token') as string) || '').trim()
  const fbVerifyToken = ((formData.get('facebook_verify_token') as string) || '').trim()
  const fbAppSecret = ((formData.get('facebook_app_secret') as string) || '').trim()

  const tiktokAppKey = ((formData.get('tiktok_app_key') as string) || '').trim()
  const tiktokAppSecret = ((formData.get('tiktok_app_secret') as string) || '').trim()
  const tiktokShopId = ((formData.get('tiktok_shop_id') as string) || '').trim()

  const shopeePartnerId = ((formData.get('shopee_partner_id') as string) || '').trim()
  const shopeePartnerKey = ((formData.get('shopee_partner_key') as string) || '').trim()
  const shopeeShopId = ((formData.get('shopee_shop_id') as string) || '').trim()

  // A page connected with "เชื่อมเพจด้วย Facebook" is verified by the platform app secret.
  // A shop's own Meta app must send its App Secret, or the webhook cannot check the signature.
  const storedPageToken = String(shop.facebook_page_token || '').trim()
  const oauthKeepsPlatformWebhook = shop.facebook_connected_via === 'oauth' && fbPageToken === storedPageToken
  if (fbPageToken && !oauthKeepsPlatformWebhook) {
    if (!fbAppSecret) {
      return { error: 'กรุณาใส่ App Secret คู่กับ Page Access Token (ใช้ตรวจว่าข้อความมาจาก Facebook จริง)' }
    }
    if (!fbVerifyToken) {
      return { error: 'กรุณาใส่ Verify Token เมื่อเชื่อม Facebook Messenger (ใช้ตอน Meta ตรวจสอบ Webhook)' }
    }
  }

  // One LINE OA / Facebook page per shop (see channelOwnership.ts)
  let lineBotUserId: string | null = null
  if (lineToken) {
    const { info, rejected } = await fetchLineBotInfo(lineToken)
    if (rejected) {
      return { error: 'LINE ไม่ยอมรับ Channel Access Token นี้ (ผิดหรือหมดอายุ) กรุณาคัดลอกใหม่จาก LINE Developers → Messaging API' }
    }
    lineBotUserId = info?.userId || null
    if (await lineOaUsedByOtherShop(shop.id, lineToken, lineBotUserId)) {
      const oa = info?.basicId ? ` (${info.basicId})` : ''
      return {
        error: `LINE OA นี้${oa} เชื่อมกับร้านอื่นใน DealMee อยู่แล้ว 1 LINE OA ใช้ได้กับ 1 ร้านเท่านั้น เพราะข้อความจากลูกค้าจะไปถึงร้านที่ Webhook URL ชี้ไปร้านเดียว กรุณาใช้ OA อื่น หรือลบ Token ออกจากร้านเดิมก่อน`,
      }
    }
  }
  if (fbPageId && (await facebookPageUsedByOtherShop(shop.id, fbPageId))) {
    return { error: 'เพจ Facebook นี้เชื่อมกับร้านอื่นใน DealMee อยู่แล้ว 1 เพจใช้ได้กับ 1 ร้านเท่านั้น กรุณาลบออกจากร้านเดิมก่อน' }
  }

  const updateData = {
    line_token: lineToken,
    line_secret: lineSecret,
    line_bot_user_id: lineBotUserId,
    facebook_page_id: fbPageId,
    facebook_page_token: fbPageToken,
    facebook_verify_token: fbVerifyToken,
    facebook_app_secret: fbAppSecret,
    tiktok_app_key: tiktokAppKey,
    tiktok_app_secret: tiktokAppSecret,
    tiktok_shop_id: tiktokShopId,
    shopee_partner_id: shopeePartnerId,
    shopee_partner_key: shopeePartnerKey,
    shopee_shop_id: shopeeShopId,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('shops')
    .update(updateData)
    .eq('id', shop.id)

  if (error) {
    return { error: `บันทึกไม่สำเร็จ: ${error.message}` }
  }

  // Synchronize Facebook channel account in channel_accounts table
  if (fbPageId) {
    await supabase.from('channel_accounts').upsert(
      {
        shop_id: shop.id,
        platform: 'facebook',
        account_name: `Facebook Page (${fbPageId})`,
        account_id: fbPageId,
        is_active: true,
        credentials: {
          page_access_token: fbPageToken,
          verify_token: fbVerifyToken,
          app_secret: fbAppSecret,
        },
        webhook_secret: fbVerifyToken,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'shop_id,platform,account_id' }
    )
  }

  // Synchronize LINE channel account in channel_accounts table
  if (lineToken) {
    await supabase.from('channel_accounts').upsert(
      {
        shop_id: shop.id,
        platform: 'line',
        account_name: 'LINE Official Account',
        account_id: 'default',
        is_active: true,
        credentials: {
          token: lineToken,
          secret: lineSecret,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'shop_id,platform,account_id' }
    )
  }

  // Synchronize TikTok Shop channel account in channel_accounts table
  if (tiktokShopId || tiktokAppKey) {
    await supabase.from('channel_accounts').upsert(
      {
        shop_id: shop.id,
        platform: 'tiktok',
        account_name: `TikTok Shop (${tiktokShopId || 'Default'})`,
        account_id: tiktokShopId || 'default',
        is_active: true,
        credentials: {
          app_key: tiktokAppKey,
          app_secret: tiktokAppSecret,
          shop_id: tiktokShopId,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'shop_id,platform,account_id' }
    )
  }

  // Synchronize Shopee channel account in channel_accounts table
  if (shopeeShopId || shopeePartnerId) {
    await supabase.from('channel_accounts').upsert(
      {
        shop_id: shop.id,
        platform: 'shopee',
        account_name: `Shopee Shop (${shopeeShopId || 'Default'})`,
        account_id: shopeeShopId || 'default',
        is_active: true,
        credentials: {
          partner_id: shopeePartnerId,
          partner_key: shopeePartnerKey,
          shop_id: shopeeShopId,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'shop_id,platform,account_id' }
    )
  }

  revalidatePath('/dashboard/settings')
  return { success: 'บันทึกการตั้งค่าช่องทางแชทเรียบร้อยแล้ว!' }
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

  const slip_verify_enabled = formData.get('slip_verify_enabled') === 'true' || formData.get('slip_verify_enabled') === 'on'
  const slip_provider = ((formData.get('slip_provider') as string) || 'easyslip').trim()
  const slip_api_key = ((formData.get('slip_api_key') as string) || '').trim()
  const slip_branch_id = ((formData.get('slip_branch_id') as string) || '').trim()

  const cod_fee_type = (formData.get('cod_fee_type') as string) || 'flat'
  const cod_fee_amount = Number(formData.get('cod_fee_amount') || 30)
  const shipping_zone_bkk = Number(formData.get('shipping_zone_bkk') || 40)
  const shipping_zone_upcountry = Number(formData.get('shipping_zone_upcountry') || 60)
  const shipping_zone_remote = Number(formData.get('shipping_zone_remote') || 100)

  const currentFeatures = (shop.features && typeof shop.features === 'object') ? shop.features : {}
  const updatedFeatures = {
    ...currentFeatures,
    // The switch the webhooks read (also on the modules page)
    slip_verify: slip_verify_enabled,
    slip_verification: {
      enabled: slip_verify_enabled,
      provider: slip_provider,
      api_key: slip_api_key,
      branch_id: slip_branch_id,
    },
    payment_shipping: {
      bank_name: ((formData.get('bank_name') as string) || '').trim(),
      bank_account_number: ((formData.get('bank_account_number') as string) || '').trim(),
      bank_account_name: ((formData.get('bank_account_name') as string) || '').trim(),
      promptpay_qr_enabled,
      cod_enabled,
      cod_fee_type,
      cod_fee_amount,
      shipping_zone_bkk,
      shipping_zone_upcountry,
      shipping_zone_remote,
    },
  }

  const bank_name = ((formData.get('bank_name') as string) || '').trim()
  const bank_account_number = ((formData.get('bank_account_number') as string) || '').trim()
  const bank_account_name = ((formData.get('bank_account_name') as string) || '').trim()

  const updateData: Record<string, any> = {
    promptpay_number: ((formData.get('promptpay_number') as string) || '').trim(),
    promptpay_name: ((formData.get('promptpay_name') as string) || '').trim(),
    promptpay_qr_enabled,
    bank_name,
    payment_bank_name: bank_name,
    bank_account_number,
    payment_bank_account: bank_account_number,
    bank_account_name,
    payment_bank_acc_name: bank_account_name,
    shipping_provider: (formData.get('shipping_provider') as string) || '',
    shipping_fee_type: (formData.get('shipping_fee_type') as string) || 'flat',
    shipping_fee_amount: Number(formData.get('shipping_fee_amount') || 0),
    shipping_zone_bkk,
    shipping_zone_upcountry,
    shipping_zone_remote,
    free_shipping_threshold,
    cod_enabled,
    cod_fee_type,
    cod_fee_amount,
    features: updatedFeatures,
    updated_at: new Date().toISOString(),
  }

  let { error } = await supabase
    .from('shops')
    .update(updateData)
    .eq('id', shop.id)

  if (error && (error.message?.includes('column') || error.code === '42703' || error.code === 'PGRST204')) {
    // Fallback: update only base columns and persist enhanced settings in features jsonb
    const fallbackData = {
      promptpay_number: updateData.promptpay_number,
      promptpay_name: updateData.promptpay_name,
      bank_name: updateData.bank_name,
      payment_bank_name: updateData.bank_name,
      bank_account_number: updateData.bank_account_number,
      payment_bank_account: updateData.bank_account_number,
      bank_account_name: updateData.bank_account_name,
      payment_bank_acc_name: updateData.bank_account_name,
      shipping_provider: updateData.shipping_provider,
      shipping_fee_type: updateData.shipping_fee_type,
      shipping_fee_amount: updateData.shipping_fee_amount,
      free_shipping_threshold: updateData.free_shipping_threshold,
      features: updatedFeatures,
      updated_at: updateData.updated_at,
    }
    const fallbackRes = await supabase
      .from('shops')
      .update(fallbackData)
      .eq('id', shop.id)
    error = fallbackRes.error
  }

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

  const currentFeatures = (shop.features && typeof shop.features === 'object') ? shop.features : {}
  const signatureUrl = ((formData.get('company_signature_url') as string) || '').trim()

  const updatedFeatures = {
    ...currentFeatures,
    company_signature_url: signatureUrl,
  }

  const updateData: Record<string, any> = {
    company_name: ((formData.get('company_name') as string) || '').trim(),
    company_tax_id: ((formData.get('company_tax_id') as string) || '').trim(),
    company_address: ((formData.get('company_address') as string) || '').trim(),
    company_phone: ((formData.get('company_phone') as string) || '').trim(),
    company_email: ((formData.get('company_email') as string) || '').trim(),
    company_logo_url: ((formData.get('company_logo_url') as string) || '').trim(),
    vat_enabled: formData.get('vat_enabled') === 'true' || formData.get('vat_enabled') === 'on',
    features: updatedFeatures,
    updated_at: new Date().toISOString(),
  }

  let { error } = await supabase
    .from('shops')
    .update({ ...updateData, company_signature_url: signatureUrl })
    .eq('id', shop.id)

  if (error && (error.message?.includes('company_signature_url') || error.code === '42703' || error.code === 'PGRST204')) {
    const res = await supabase
      .from('shops')
      .update(updateData)
      .eq('id', shop.id)
    error = res.error
  }

  if (error) {
    return { error: `บันทึกไม่สำเร็จ: ${error.message}` }
  }

  revalidatePath('/dashboard/settings')
  return { success: 'บันทึกข้อมูลบริษัทและใบเสนอราคาเรียบร้อยแล้ว!' }
}


export async function getPlaygroundCatalogStatus(): Promise<{ products: number; knowledge: number; services: number } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id) return null

  const [products, knowledge, services] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('shop_id', shop.id),
    supabase.from('knowledge_base').select('*', { count: 'exact', head: true }).eq('shop_id', shop.id),
    supabase.from('services').select('*', { count: 'exact', head: true }).eq('shop_id', shop.id),
  ])

  if (products.error || knowledge.error) return null

  return {
    products: products.count || 0,
    knowledge: knowledge.count || 0,
    // -1 means the services count could not be read, so the playground must not
    // treat the shop as empty and hide the real bot.
    services: services.error ? -1 : services.count || 0,
  }
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
    bot_name: customBotName || shop.bot_name || 'น้อง DealMee',
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
      isPlayground: true,
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
      if (msg.type === 'text' || msg.type === 'image') {
        bubbles.push({ type: msg.type, content: msg.content, origin: 'tool' })
      } else if (msg.type === 'flex') {
        bubbles.push({ type: 'text', content: msg.content || '📄 ใบเสนอราคา (LINE Flex Card)', origin: 'tool' })
      }
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

/** Get QR code, Deep link, and status for Admin LINE instant linking */
export async function getAdminLinkDataAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'กรุณาเข้าสู่ระบบ' }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop) return { error: 'ไม่พบข้อมูลร้านค้า' }

  const isLinked = Boolean(shop.owner_line_id || shop.features?.admin_line_user_id)
  const adminName = shop.features?.admin_line_name || null
  const adminUserId = shop.owner_line_id || shop.features?.admin_line_user_id || null

  // The QR must open the OA this shop's token belongs to: the code is checked by that
  // OA's webhook only. Until Oct 2026 a failed lookup fell back to a hard-coded OA of
  // another shop, which answered "รหัสไม่ถูกต้อง".
  let basicId = ''
  let oaName = ''
  if (shop.line_token) {
    try {
      const res = await fetch('https://api.line.me/v2/bot/info', {
        headers: { Authorization: `Bearer ${shop.line_token}` },
        cache: 'no-store',
      })
      if (res.ok) {
        const info = await res.json()
        basicId = (info.basicId || '').replace(/^@/, '')
        oaName = info.displayName || ''
      } else {
        console.warn('[getAdminLinkDataAction] bot/info failed:', res.status)
      }
    } catch (err) {
      console.warn('[getAdminLinkDataAction] bot/info error:', err)
    }
  }

  // Generate or retrieve current active link code (e.g. ADM-7492)
  let code = shop.features?.admin_link_code
  if (!code || isLinked) {
    code = 'ADM-' + Math.floor(1000 + Math.random() * 9000)
    const updatedFeatures = {
      ...(shop.features || {}),
      admin_link_code: code,
    }
    await supabase.from('shops').update({
      features: updatedFeatures,
      updated_at: new Date().toISOString(),
    }).eq('id', shop.id)
  }

  const cleanBasicId = basicId || String(shop.line_bot_id || '').replace(/^@/, '')
  // LINE Official Account deep link that pre-fills message
  const deepLink = cleanBasicId
    ? `https://line.me/R/oaMessage/@${cleanBasicId}/?${encodeURIComponent('/admin-link ' + code)}`
    : ''

  let qrDataUrl = ''
  if (deepLink) {
    try {
      qrDataUrl = await qrcode.toDataURL(deepLink, {
        width: 280,
        margin: 2,
        color: { dark: '#0F172A', light: '#FFFFFF' },
      })
    } catch (e) {
      console.warn('[getAdminLinkDataAction] QR generation error:', e)
    }
  }

  return {
    success: true,
    isLinked,
    adminName,
    adminUserId,
    code,
    deepLink,
    qrDataUrl,
    basicId: cleanBasicId,
    oaName,
  }
}

/** Unlink Admin LINE account */
export async function unlinkAdminAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'กรุณาเข้าสู่ระบบ' }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop) return { error: 'ไม่พบข้อมูลร้านค้า' }

  const updatedFeatures = {
    ...(shop.features || {}),
    admin_line_user_id: null,
    admin_line_name: null,
    admin_notify: false,
    admin_link_code: null,
  }

  const { error } = await supabase.from('shops').update({
    owner_line_id: null,
    features: updatedFeatures,
    updated_at: new Date().toISOString(),
  }).eq('id', shop.id)

  if (error) return { error: `ยกเลิกไม่สำเร็จ: ${error.message}` }
  revalidatePath('/dashboard/settings')
  return { success: 'ยกเลิกการเชื่อมต่อแอดมินเรียบร้อยแล้ว' }
}

/** Send test alert to Admin LINE account */
export async function sendTestAdminNotificationAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'กรุณาเข้าสู่ระบบ' }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop) return { error: 'ไม่พบข้อมูลร้านค้า' }

  const targetAdmin = shop.owner_line_id || shop.features?.admin_line_user_id
  if (!targetAdmin) return { error: 'ยังไม่ได้เชื่อมต่อบัญชีแอดมิน' }
  if (!shop.line_token) return { error: 'ร้านค้ายังไม่ได้เชื่อมต่อ LINE Token' }

  const text = `🔔 [ทดสอบการแจ้งเตือนแอดมิน]\nระบบ DealMee ได้เชื่อมต่อกับ LINE ของคุณเรียบร้อยแล้วค่ะ!\n\nต่อไปนี้เมื่อมี:\n• ออเดอร์ใหม่เข้ามา 🛒\n• ลูกค้าชำระเงินและตรวจสลิปผ่าน 💰\n• สลิปยอดไม่ตรงหรือผิดปกติ ⚠️\n• ลูกค้าขอคุยกับแอดมินคนจริง 👤\n\nระบบจะส่งข้อความแจ้งเตือนมาที่นี่ทันทีค่ะ ✨`

  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${shop.line_token}`,
      },
      body: JSON.stringify({
        to: targetAdmin,
        messages: [{ type: 'text', text }],
      }),
    })

    if (res.ok) {
      return { success: 'ส่งข้อความทดสอบเข้า LINE เรียบร้อยแล้ว!' }
    } else {
      const errText = await res.text()
      return { error: `ส่งไม่สำเร็จ: ${errText}` }
    }
  } catch (err: any) {
    return { error: `เกิดข้อผิดพลาด: ${err.message}` }
  }
}

/** Save manually entered LINE User ID */
export async function saveManualAdminLineIdAction(lineUserId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'กรุณาเข้าสู่ระบบ' }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop) return { error: 'ไม่พบข้อมูลร้านค้า' }

  const cleaned = (lineUserId || '').trim()
  if (!cleaned.startsWith('U') || cleaned.length !== 33) {
    return { error: 'LINE User ID ต้องขึ้นต้นด้วยตัว U และมีความยาว 33 ตัวอักษร' }
  }

  let adminName = 'แอดมิน'
  if (shop.line_token) {
    try {
      const pRes = await fetch(`https://api.line.me/v2/bot/profile/${cleaned}`, {
        headers: { Authorization: `Bearer ${shop.line_token}` },
      })
      if (pRes.ok) {
        const pData = await pRes.json()
        if (pData.displayName) adminName = pData.displayName
      }
    } catch {}
  }

  const updatedFeatures = {
    ...(shop.features || {}),
    admin_line_user_id: cleaned,
    admin_line_name: adminName,
    admin_notify: true,
  }

  const { error } = await supabase.from('shops').update({
    owner_line_id: cleaned,
    features: updatedFeatures,
    updated_at: new Date().toISOString(),
  }).eq('id', shop.id)

  if (error) return { error: `บันทึกไม่สำเร็จ: ${error.message}` }
  revalidatePath('/dashboard/settings')
  return { success: `เชื่อมต่อแอดมิน (${adminName}) เรียบร้อยแล้ว` }
}
