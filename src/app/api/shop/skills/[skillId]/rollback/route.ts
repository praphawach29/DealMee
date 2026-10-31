import { NextRequest, NextResponse } from 'next/server'
import { requireShop } from '@/lib/auth/requireShop'
import { createAdminClient } from '@/lib/supabase/admin'

// GET: list revisions for a skill
export async function GET(request: NextRequest, { params }: { params: Promise<{ skillId: string }> }) {
  const auth = await requireShop()
  if (auth.error) return auth.error

  const { skillId } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('shop_skill_revisions')
    .select('*')
    .eq('skill_id', skillId)
    .eq('shop_id', auth.shopId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Unable to load revisions' }, { status: 500 })
  }
  return NextResponse.json({ revisions: data ?? [] })
}

// POST: rollback skill to a specific revision
export async function POST(request: NextRequest, { params }: { params: Promise<{ skillId: string }> }) {
  const auth = await requireShop()
  if (auth.error) return auth.error

  const { skillId } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const revisionId = String((body as Record<string, unknown>).revision_id || '').trim()
  if (!revisionId) {
    return NextResponse.json({ error: 'revision_id is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch the revision
  const { data: revision } = await admin
    .from('shop_skill_revisions')
    .select('*')
    .eq('id', revisionId)
    .eq('skill_id', skillId)
    .eq('shop_id', auth.shopId)
    .maybeSingle()

  if (!revision) {
    return NextResponse.json({ error: 'Revision not found' }, { status: 404 })
  }

  // Apply rollback: update skill with revision's data + increment version
  const { data: skill } = await admin
    .from('shop_skills')
    .select('version')
    .eq('id', skillId)
    .eq('shop_id', auth.shopId)
    .single()

  if (!skill) {
    return NextResponse.json({ error: 'Skill not found' }, { status: 404 })
  }

  // Parse version and increment patch
  const parts = (skill.version || '0.1.0').split('.')
  const newVersion = `${parts[0]}.${parts[1]}.${Number(parts[2] || 0) + 1}`

  const { error: updateErr } = await admin
    .from('shop_skills')
    .update({
      skill_type: revision.skill_type,
      category: revision.category,
      trigger_keywords: revision.trigger_keywords,
      knowledge_body: revision.knowledge_body,
      instruction: revision.instruction,
      version: newVersion,
      updated_at: new Date().toISOString(),
    })
    .eq('id', skillId)
    .eq('shop_id', auth.shopId)

  if (updateErr) {
    return NextResponse.json({ error: 'Rollback failed' }, { status: 500 })
  }

  await admin.from('ai_response_cache').delete().eq('shop_id', auth.shopId)

  return NextResponse.json({ success: true, newVersion, rolledBackTo: revision.version })
}
