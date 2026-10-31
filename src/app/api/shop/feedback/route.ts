import { NextRequest, NextResponse } from 'next/server'
import { requireShop } from '@/lib/auth/requireShop'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractSkillFromConversation } from '@/lib/ai/skillExtractor'

export async function POST(request: NextRequest) {
  const auth = await requireShop()
  if (auth.error) return auth.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const input = body as Record<string, unknown>
  const chatMessageId = String(input.chat_message_id || '').trim()
  const rating = String(input.rating || '').trim()
  const reason = input.reason ? String(input.reason).trim() : null
  const correctedResponse = input.corrected_response ? String(input.corrected_response).trim() : null

  if (!chatMessageId) {
    return NextResponse.json({ error: 'chat_message_id is required' }, { status: 400 })
  }
  if (rating !== 'up' && rating !== 'down') {
    return NextResponse.json({ error: 'rating must be up or down' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify the message belongs to this shop
  const { data: msg } = await admin
    .from('chat_messages')
    .select('id, conversation_id, shop_id, sender_type, message')
    .eq('id', chatMessageId)
    .eq('shop_id', auth.shopId)
    .maybeSingle()

  if (!msg) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  // Upsert feedback
  const { data: feedback, error: fbErr } = await admin
    .from('chat_message_feedback')
    .upsert({
      shop_id: auth.shopId,
      conversation_id: msg.conversation_id,
      chat_message_id: chatMessageId,
      rating,
      reason: reason || null,
      corrected_response: correctedResponse || null,
      reviewed_by: auth.userId,
      reviewed_at: new Date().toISOString(),
    }, { onConflict: 'chat_message_id' })
    .select('*')
    .single()

  if (fbErr) {
    console.error('[feedback] upsert failed', fbErr.message)
    return NextResponse.json({ error: 'Unable to save feedback' }, { status: 500 })
  }

  // If thumbs down with corrected response → extract candidate skill
  let skillResult = null
  if (rating === 'down' && correctedResponse) {
    try {
      skillResult = await extractSkillFromConversation({
        shopId: auth.shopId,
        conversationId: msg.conversation_id,
        outcome: 'handoff',
      })
    } catch (err) {
      console.warn('[feedback] skill extraction failed:', err)
    }
  }

  return NextResponse.json({ feedback, skillExtraction: skillResult }, { status: 201 })
}

export async function GET(request: NextRequest) {
  const auth = await requireShop()
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const rating = searchParams.get('rating')
  const limit = Math.min(Number(searchParams.get('limit')) || 20, 50)

  const admin = createAdminClient()
  let query = admin
    .from('chat_message_feedback')
    .select('*')
    .eq('shop_id', auth.shopId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (rating === 'up' || rating === 'down') {
    query = query.eq('rating', rating)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: 'Unable to load feedback' }, { status: 500 })
  }
  return NextResponse.json({ feedback: data ?? [] })
}
