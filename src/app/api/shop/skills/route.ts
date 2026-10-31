import { NextRequest, NextResponse } from 'next/server'
import { requireShop } from '@/lib/auth/requireShop'
import { parseShopSkillInput } from '@/lib/ai/shopSkills'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const auth = await requireShop()
  if (auth.error) return auth.error

  const { data, error } = await createAdminClient()
    .from('shop_skills')
    .select('*')
    .eq('shop_id', auth.shopId)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('[shop-skills] list failed', error.message)
    return NextResponse.json({ error: 'Unable to load skills' }, { status: 500 })
  }
  return NextResponse.json({ skills: data ?? [] })
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
  const parsed = parseShopSkillInput(body)
  if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { data, error } = await createAdminClient()
    .from('shop_skills')
    .insert({
      ...parsed.data,
      shop_id: auth.shopId,
      status: 'candidate',
      created_by: auth.userId,
      facts_confirmed: true,
    })
    .select('*')
    .single()

  if (error) {
    console.error('[shop-skills] create failed', error.message)
    return NextResponse.json({ error: 'Unable to create skill' }, { status: 500 })
  }
  return NextResponse.json({ skill: data }, { status: 201 })
}
