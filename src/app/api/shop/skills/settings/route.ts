import { NextResponse } from 'next/server'
import { requireShop } from '@/lib/auth/requireShop'
import { mergeSkillSettings, parseSkillSettings } from '@/lib/ai/skillSettings'
import { createAdminClient } from '@/lib/supabase/admin'

function settingsResponse(features: Record<string, unknown> | null) {
  return {
    enabled: features?.shop_skills_enabled === true,
    qaOnly: features?.assistant_qa_only === true,
    globalAvailable: process.env.SHOP_SKILLS_RETRIEVAL_ENABLED !== 'false',
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireShop()
    if (auth.error) return auth.error
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const parsed = parseSkillSettings(body)
    if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 })

    const supabase = createAdminClient()
    const { data: shop, error: readError } = await supabase
      .from('shops').select('features, updated_at').eq('id', auth.shopId).maybeSingle()
    if (readError) return NextResponse.json({ error: 'Unable to load runtime settings' }, { status: 500 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const features = mergeSkillSettings(shop.features, parsed.data)
    // Invalidate stale AI response cache before changing shop skill/Q&A settings.
    const { error: cacheError } = await supabase.from('ai_response_cache').delete().eq('shop_id', auth.shopId)
    if (cacheError && cacheError.code !== '42P01') {
      return NextResponse.json({ error: 'Unable to invalidate cached responses before saving runtime settings' }, { status: 500 })
    }
    const previousTime = shop.updated_at ? Date.parse(shop.updated_at) : 0
    const updatedAt = new Date(Math.max(Date.now(), (Number.isFinite(previousTime) ? previousTime : 0) + 1)).toISOString()
    let update = supabase.from('shops').update({ features, updated_at: updatedAt }).eq('id', auth.shopId)
    update = shop.updated_at == null ? update.is('updated_at', null) : update.eq('updated_at', shop.updated_at)
    // Some existing writers do not advance updated_at; compare the JSON snapshot too.
    update = shop.features == null ? update.is('features', null) : update.eq('features', JSON.stringify(shop.features))
    const { data: written, error: writeError } = await update.select('id').maybeSingle()
    if (writeError) return NextResponse.json({ error: 'Unable to save runtime settings' }, { status: 500 })
    if (!written) return NextResponse.json({ error: 'Settings changed concurrently. Reload and try again.' }, { status: 409 })

    const { data: saved, error: verifyError } = await supabase
      .from('shops').select('features').eq('id', auth.shopId).maybeSingle()
    if (verifyError || !saved) {
      return NextResponse.json({ error: 'Settings may have been saved, but verification failed. Reload to check.' }, { status: 500 })
    }
    const settings = settingsResponse(saved.features)
    if (settings.enabled !== parsed.data.enabled || settings.qaOnly !== parsed.data.qaOnly) {
      return NextResponse.json({ error: 'Settings changed concurrently. Reload and try again.' }, { status: 409 })
    }
    return NextResponse.json(settings, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Unable to save runtime settings. Reload to check the current values.' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const auth = await requireShop()
    if (auth.error) return auth.error
    const { data, error } = await createAdminClient()
      .from('shops').select('features').eq('id', auth.shopId).maybeSingle()
    if (error) return NextResponse.json({ error: 'Unable to load runtime settings' }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    return NextResponse.json(settingsResponse(data.features), { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Unable to load runtime settings' }, { status: 500 })
  }
}
