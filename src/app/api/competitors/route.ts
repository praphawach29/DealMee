import { NextRequest, NextResponse } from 'next/server'
import { getCompetitors, deleteCompetitor } from '@/lib/competitors/competitorStore'
import { createAdminClient } from '@/lib/supabase/admin'

const supabase = createAdminClient()

/**
 * GET /api/competitors?shop_id=...
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const shopId = searchParams.get('shop_id')

    if (!shopId) {
      return NextResponse.json({ error: 'Missing shop_id query parameter' }, { status: 400 })
    }

    const competitors = await getCompetitors(shopId)

    // Check if shop has a saved RapidAPI key
    const { data: keySetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', `rapidapi_key_${shopId}`)
      .maybeSingle()

    const hasApiKey = Boolean(keySetting?.value || process.env.RAPIDAPI_KEY)
    const maskedKey = keySetting?.value
      ? `${keySetting.value.slice(0, 6)}••••••••${keySetting.value.slice(-4)}`
      : (process.env.RAPIDAPI_KEY ? '•••••••• (ใช้คีย์จากระบบ Vercel)' : '')

    return NextResponse.json({
      success: true,
      competitors,
      has_api_key: hasApiKey,
      masked_api_key: maskedKey,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}

/**
 * POST /api/competitors
 * Action: save_api_key
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, shop_id, rapidapi_key } = body

    if (!shop_id) {
      return NextResponse.json({ error: 'Missing shop_id' }, { status: 400 })
    }

    if (action === 'save_api_key') {
      const trimmedKey = (rapidapi_key || '').trim()
      await supabase.from('settings').upsert({
        key: `rapidapi_key_${shop_id}`,
        value: trimmedKey,
      }, { onConflict: 'key' })

      return NextResponse.json({
        success: true,
        message: trimmedKey ? 'บันทึก RapidAPI Key เรียบร้อยแล้ว' : 'ลบ API Key เรียบร้อยแล้ว',
        has_api_key: Boolean(trimmedKey),
      })
    }

    if (action === 'sync_knowledge') {
      const { title, content, competitor_name } = body
      if (!title || !content) {
        return NextResponse.json({ error: 'Missing title or content' }, { status: 400 })
      }

      const { data: item, error: kbError } = await supabase.from('knowledge_base').insert({
        shop_id,
        title,
        content,
        category: 'กลยุทธ์คู่แข่ง',
        source: 'competitor_spy',
        source_ref: competitor_name || null,
        status: 'active',
      }).select('id').single()

      if (kbError) throw kbError

      return NextResponse.json({
        success: true,
        message: 'เพิ่มข้อมูลเข้าคลังความรู้บอทเรียบร้อยแล้ว!',
        id: item?.id,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/competitors?shop_id=...&id=...
 */
export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const shopId = searchParams.get('shop_id')
    const competitorId = searchParams.get('id')

    if (!shopId || !competitorId) {
      return NextResponse.json({ error: 'Missing shop_id or id parameter' }, { status: 400 })
    }

    const deleted = await deleteCompetitor(shopId, competitorId)
    return NextResponse.json({ success: deleted })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
