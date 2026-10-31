import { NextRequest, NextResponse } from 'next/server'
import { requireShop } from '@/lib/auth/requireShop'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const auth = await requireShop()
  if (auth.error) return auth.error

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('shop_agent_memory')
    .select('*')
    .eq('shop_id', auth.shopId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Unable to load memories' }, { status: 500 })
  }
  return NextResponse.json({ memories: data ?? [] })
}

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
  const memoryType = String(input.memory_type || 'fact')
  const category = String(input.category || 'general').trim()
  const content = String(input.content || '').trim()

  if (!content) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('shop_agent_memory')
    .insert({
      shop_id: auth.shopId,
      memory_type: memoryType,
      category,
      content: content.slice(0, 2000),
      confidence: 0.8,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Unable to create memory' }, { status: 500 })
  }
  return NextResponse.json({ memory: data }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireShop()
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('shop_agent_memory')
    .delete()
    .eq('id', id)
    .eq('shop_id', auth.shopId)

  if (error) {
    return NextResponse.json({ error: 'Unable to delete memory' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
