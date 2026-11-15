import { after, NextResponse } from 'next/server'
import { requireShop } from '@/lib/auth/requireShop'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ShopSkill } from '@/lib/ai/shopSkills'
import { beginShadowEval, listLatestShadowEvals } from '@/lib/ai/shadowEvalStore'

export const maxDuration = 60

export async function GET() {
  const auth = await requireShop()
  if (auth.error) return auth.error
  const evals = await listLatestShadowEvals(auth.shopId)
  return NextResponse.json({ evals })
}

export async function POST(request: Request) {
  const auth = await requireShop()
  if (auth.error) return auth.error
  let body: { skillId?: unknown; confirmFacts?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'ไม่พบสกิลนี้' }, { status: 400 })
  }
  const skillId = typeof body.skillId === 'string' ? body.skillId : ''
  if (!skillId) return NextResponse.json({ error: 'ไม่พบสกิลนี้' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: skill } = await supabase
    .from('shop_skills')
    .select('*')
    .eq('id', skillId)
    .eq('shop_id', auth.shopId)
    .maybeSingle()
  if (!skill || skill.shop_id !== auth.shopId) return NextResponse.json({ error: 'ไม่พบสกิลนี้' }, { status: 404 })

  const { data: shop } = await supabase.from('shops').select('features').eq('id', auth.shopId).maybeSingle()
  const features = (shop?.features || {}) as Record<string, unknown>
  const confirmFacts = body.confirmFacts === true
  const started = await beginShadowEval({
    shopId: auth.shopId,
    skill: skill as ShopSkill,
    confirmFacts,
    skillsEnabled: features.shop_skills_enabled === true,
  })
  if (!started.ok) return NextResponse.json({ error: started.error }, { status: started.status })
  if (!started.already) {
    const evalId = started.id
    after(() => {
      void import('@/lib/ai/shadowEval')
        .then(({ executeShadowEval }) => executeShadowEval({
          shopId: auth.shopId,
          skillId,
          evalId,
          confirmFacts: confirmFacts || skill.facts_confirmed === true,
        }))
        .catch((err) => console.error('[ShadowEval]', err instanceof Error ? err.message : err))
    })
  }
  return NextResponse.json({ evalId: started.id, status: 'running' }, { status: 202 })
}
