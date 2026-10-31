import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { continueSalesAgentPlanning, planningAckMessage, startSalesAgentPlanning } from '@/lib/ai/salesAgentEngine'
import { upsertCustomerProfile } from '@/lib/customerMemory'
import { isProductCardSuppressed, resolveChannelProductCards, type ProductCard } from '@/lib/ai/productCards'
import {
  DEMO_MESSAGE_MAX_CHARS,
  DEMO_MESSAGES_PER_DAY,
  DEMO_MESSAGES_PER_NETWORK,
  DEMO_MESSAGES_PER_VISITOR,
  demoShopFor,
} from '@/lib/demo/shops'

/**
 * The landing page's live demo. A visitor chats with the real sales engine, running against
 * one of three sample shops (supabase/migrations/20261101000000_live_demo.sql), without an
 * account. Same engine and tools as the LINE webhook; what differs is only what can leave:
 * the sample shops have no LINE token, admin alerts are off, and a payment QR comes back as
 * a placeholder rather than a scannable image.
 *
 * Every message is claimed against caps in the database first (per visitor cookie, per
 * network address, and for everybody per day), because each one is a paid AI call.
 */
export const maxDuration = 60

const COOKIE = 'dm_demo'
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60

type DemoBubble =
  | { type: 'text'; text: string }
  | { type: 'qr'; caption: string }
  | { type: 'products'; products: ProductCard[] }
  | { type: 'note'; text: string }

function clientAddress(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || req.headers.get('x-real-ip') || 'unknown'
}

function reply(body: Record<string, unknown>, visitor: string, isNew: boolean, status = 200) {
  const res = NextResponse.json(body, { status })
  if (isNew) {
    res.cookies.set(COOKIE, visitor, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    })
  }
  return res
}

export async function POST(req: NextRequest) {
  const existing = req.cookies.get(COOKIE)?.value
  const isNew = !existing || !/^[0-9a-f-]{36}$/.test(existing)
  const visitor = isNew ? randomUUID() : existing!

  let body: { persona?: unknown; message?: unknown; reset?: unknown }
  try {
    body = await req.json()
  } catch {
    return reply({ error: 'bad_request' }, visitor, isNew, 400)
  }

  const demo = demoShopFor(body.persona)
  if (!demo) return reply({ error: 'unknown_persona' }, visitor, isNew, 400)

  const admin = createAdminClient()
  const userId = `demo-${visitor}`

  const findConversation = () =>
    admin
      .from('conversations')
      .select('id, status')
      .eq('shop_id', demo.shopId)
      .eq('user_id', userId)
      .eq('platform', 'DEMO')
      .maybeSingle()

  // Start over: drop this visitor's chat with this shop (messages go with it)
  if (body.reset === true) {
    const { data: conv } = await findConversation()
    if (conv?.id) await admin.from('conversations').delete().eq('id', conv.id)
    return reply({ ok: true }, visitor, isNew)
  }

  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message) return reply({ error: 'empty' }, visitor, isNew, 400)
  if (message.length > DEMO_MESSAGE_MAX_CHARS) return reply({ error: 'too_long' }, visitor, isNew, 400)

  // Caps before any AI call. The network guard stops someone clearing cookies in a loop.
  const network = await admin.rpc('claim_demo_message', {
    p_visitor: `ip:${clientAddress(req)}`,
    p_per_visitor: DEMO_MESSAGES_PER_NETWORK,
    p_global: DEMO_MESSAGES_PER_DAY,
  })
  const mine = network.data === 'ok'
    ? await admin.rpc('claim_demo_message', {
        p_visitor: `v:${visitor}`,
        p_per_visitor: DEMO_MESSAGES_PER_VISITOR,
        p_global: DEMO_MESSAGES_PER_DAY,
      })
    : network
  if (mine.error) {
    console.error('[demo] claim failed:', mine.error.message)
    return reply({ error: 'unavailable' }, visitor, isNew, 503)
  }
  if (mine.data !== 'ok') {
    return reply({ error: mine.data === 'global_limit' ? 'global_limit' : 'visitor_limit' }, visitor, isNew, 429)
  }

  const { data: shop } = await admin.from('shops').select('*').eq('id', demo.shopId).maybeSingle()
  if (!shop || shop.features?.is_demo !== true) {
    console.error('[demo] sample shop missing — has the live demo migration been applied?')
    return reply({ error: 'unavailable' }, visitor, isNew, 503)
  }
  // Belt and braces: whatever is saved on the row, nothing leaves through LINE from here
  const safeShop = { ...shop, line_token: null, line_secret: null, owner_line_id: null, admin_line_user_id: null }

  let { data: conv } = await findConversation()
  if (!conv) {
    const { data: created, error } = await admin
      .from('conversations')
      .insert({
        shop_id: demo.shopId,
        user_id: userId,
        platform_sender_id: userId,
        customer_name: 'ผู้เยี่ยมชมเว็บไซต์ (เดโม)',
        platform: 'DEMO',
        status: 'ai',
        ai_mode: 'auto',
      })
      .select('id, status')
      .single()
    if (error || !created) {
      console.error('[demo] could not create conversation:', error?.message)
      return reply({ error: 'unavailable' }, visitor, isNew, 503)
    }
    conv = created
  }

  // After a handoff the real bot steps back for an hour. Say so instead of going quiet.
  if (conv.status === 'human') {
    return reply(
      {
        bubbles: [
          {
            type: 'note',
            text: 'แชทนี้ถูกส่งต่อให้แอดมินแล้ว ในร้านจริงบอทจะหยุดตอบแชทนี้ 1 ชั่วโมงให้แอดมินคุยเอง แล้วกลับมาตอบเอง · กด "เริ่มใหม่" เพื่อลองต่อ',
          },
        ],
        handedOff: true,
      },
      visitor,
      isNew
    )
  }

  // Same order as the LINE webhook: the profile exists before any tool needs it
  await upsertCustomerProfile(demo.shopId, userId, 'ผู้เยี่ยมชมเว็บไซต์ (เดโม)')
  await admin.from('chat_messages').insert({
    conversation_id: conv.id,
    shop_id: demo.shopId,
    sender_type: 'user',
    sender_name: 'ลูกค้า',
    message,
    platform: 'DEMO',
  })

  try {
    const bubbles: DemoBubble[] = []
    const started = await startSalesAgentPlanning({
      shop: safeShop,
      userQuery: message,
      userId,
      conversationId: conv.id,
      supabaseClient: admin,
      isPlayground: true,
    })
    let result
    if (started.done) {
      result = started.result
    } else {
      bubbles.push({ type: 'text', text: planningAckMessage(started.state) })
      result = await continueSalesAgentPlanning(started.state)
    }

    if (result.text) bubbles.push({ type: 'text', text: result.text })
    // A real PromptPay QR is never shown on a public page, even for a number that belongs to
    // nobody: the image is dropped and the caption pushed right after it becomes a placeholder.
    let afterQrImage = false
    for (const msg of result.immediateMessages) {
      if (msg.type === 'image') {
        afterQrImage = true
        continue
      }
      if (msg.type === 'text' && msg.content) {
        bubbles.push(afterQrImage ? { type: 'qr', caption: msg.content } : { type: 'text', text: msg.content })
        afterQrImage = false
      } else if (msg.type === 'flex') {
        bubbles.push({ type: 'text', text: msg.content || '📄 ใบเสนอราคา (การ์ด LINE)' })
      }
    }

    const toolNames = result.toolCallsExecuted.map((t) => t.name)
    const products = resolveChannelProductCards({
      suppress: isProductCardSuppressed(message, toolNames),
      toolProducts: result.productsData,
      userText: message,
      catalogProducts: [],
    })
    if (products.length > 0) bubbles.push({ type: 'products', products: products.slice(0, 6) })

    const replyText = bubbles
      .map((b) => (b.type === 'text' ? b.text : b.type === 'qr' ? b.caption : ''))
      .filter(Boolean)
      .join('\n\n')
    if (replyText) {
      await admin.from('chat_messages').insert({
        conversation_id: conv.id,
        shop_id: demo.shopId,
        sender_type: 'bot',
        sender_name: demo.botName,
        message: replyText,
        platform: 'DEMO',
      })
    }
    await admin
      .from('conversations')
      .update({ last_message: replyText.slice(0, 200) || message, last_message_at: new Date().toISOString() })
      .eq('id', conv.id)

    return reply({ bubbles, tools: toolNames }, visitor, isNew)
  } catch (err) {
    console.error('[demo] engine error:', err instanceof Error ? err.message : err)
    return reply({ error: 'engine' }, visitor, isNew, 500)
  }
}
