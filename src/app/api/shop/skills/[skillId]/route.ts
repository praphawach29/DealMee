import { NextRequest, NextResponse } from 'next/server'
import { requireShop } from '@/lib/auth/requireShop'
import { nextSkillVersion, parseShopSkillInput, type ShopSkill } from '@/lib/ai/shopSkills'
import { createAdminClient } from '@/lib/supabase/admin'

type RouteContext = { params: Promise<{ skillId: string }> }

async function ownedSkill(skillId: string, shopId: string) {
  return createAdminClient()
    .from('shop_skills')
    .select('*')
    .eq('id', skillId)
    .eq('shop_id', shopId)
    .maybeSingle()
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireShop()
  if (auth.error) return auth.error
  const { skillId } = await context.params
  const { data: existing, error: loadError } = await ownedSkill(skillId, auth.shopId)
  if (loadError || !existing) return NextResponse.json({ error: 'Skill not found' }, { status: 404 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()
  if (body.action === 'activate') {
    if (existing.status !== 'candidate') {
      return NextResponse.json({ error: 'Only candidate skills can be activated' }, { status: 409 })
    }
    const version = nextSkillVersion(existing.version)
    const snapshot = existing as ShopSkill
    const { error: revisionError } = await supabase.from('shop_skill_revisions').upsert({
      skill_id: skillId,
      shop_id: auth.shopId,
      version,
      skill_type: snapshot.skill_type,
      category: snapshot.category,
      instruction: snapshot.instruction,
      knowledge_body: snapshot.knowledge_body,
      gold_conversations: snapshot.gold_conversations,
      trigger_keywords: snapshot.trigger_keywords,
      created_by: auth.userId,
    }, { onConflict: 'skill_id,version', ignoreDuplicates: true })
    if (revisionError) {
      console.error('[shop-skills] revision failed', revisionError.message)
      return NextResponse.json({ error: 'Unable to activate skill' }, { status: 500 })
    }
    const { data, error } = await supabase.from('shop_skills').update({
      status: 'active', version, approved_by: auth.userId, approved_at: now, updated_at: now,
    }).eq('id', skillId).eq('shop_id', auth.shopId).eq('status', 'candidate').select('*').single()
    if (error) return NextResponse.json({ error: 'Unable to activate skill' }, { status: 500 })
    return NextResponse.json({ skill: data })
  }

  if (body.action === 'archive') {
    const { data, error } = await supabase.from('shop_skills').update({ status: 'archived', updated_at: now })
      .eq('id', skillId).eq('shop_id', auth.shopId).select('*').single()
    if (error) return NextResponse.json({ error: 'Unable to archive skill' }, { status: 500 })
    return NextResponse.json({ skill: data })
  }

  if (existing.status !== 'candidate') {
    return NextResponse.json({ error: 'Only candidate skills can be edited' }, { status: 409 })
  }
  const parsed = parseShopSkillInput(body)
  if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { data, error } = await supabase.from('shop_skills').update({ ...parsed.data, updated_at: now })
    .eq('id', skillId).eq('shop_id', auth.shopId).eq('status', 'candidate').select('*').single()
  if (error) return NextResponse.json({ error: 'Unable to update skill' }, { status: 500 })
  return NextResponse.json({ skill: data })
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await requireShop()
  if (auth.error) return auth.error
  const { skillId } = await context.params
  const { data: existing } = await ownedSkill(skillId, auth.shopId)
  if (!existing) return NextResponse.json({ error: 'Skill not found' }, { status: 404 })

  const supabase = createAdminClient()
  if (existing.status !== 'candidate') {
    const { error } = await supabase.from('shop_skills').update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', skillId).eq('shop_id', auth.shopId)
    if (error) return NextResponse.json({ error: 'Unable to archive skill' }, { status: 500 })
  } else {
    const { error } = await supabase.from('shop_skills').delete().eq('id', skillId).eq('shop_id', auth.shopId)
    if (error) return NextResponse.json({ error: 'Unable to delete skill' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
