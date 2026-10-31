import { NextRequest, NextResponse } from 'next/server'
import { requireShop } from '@/lib/auth/requireShop'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const auth = await requireShop()
  if (auth.error) return auth.error

  const admin = createAdminClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 100)

  let query = admin
    .from('slip_transactions')
    .select('*')
    .eq('shop_id', auth.shopId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status && ['pending', 'confirmed', 'rejected'].includes(status)) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: 'Unable to load transactions' }, { status: 500 })
  }
  return NextResponse.json({ transactions: data ?? [] })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireShop()
  if (auth.error) return auth.error

  const body = await request.json().catch(() => ({}))
  const id = body.id
  const action = body.action // 'confirm' | 'reject'
  const note = body.note

  if (!id || !['confirm', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'id and action (confirm/reject) required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('slip_transactions')
    .update({
      status: action === 'confirm' ? 'confirmed' : 'rejected',
      confirmed_by: auth.userId,
      confirmed_at: new Date().toISOString(),
      note: note || null,
    })
    .eq('id', id)
    .eq('shop_id', auth.shopId)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
  return NextResponse.json({ transaction: data })
}
