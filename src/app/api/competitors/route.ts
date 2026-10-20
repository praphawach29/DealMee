import { NextRequest, NextResponse } from 'next/server'
import { getCompetitors, deleteCompetitor } from '@/lib/competitors/competitorStore'
import { createAdminClient } from '@/lib/supabase/admin'
import { platformSecret } from '@/lib/platformSecrets'
import { getCompetitorQuota } from '@/lib/billing/competitorQuota'
import { requireShop } from '@/lib/auth/requireShop'

const supabase = createAdminClient()

/**
 * GET /api/competitors?shop_id=...
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireShop()
    if (auth.error) return auth.error
    const shopId = auth.shopId

    const [competitors, quota] = await Promise.all([
      getCompetitors(shopId),
      getCompetitorQuota(shopId),
    ])

    // Check if shop has a saved RapidAPI key
    const { data: keySetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', `rapidapi_key_${shopId}`)
      .maybeSingle()

    const platformKey = await platformSecret('RAPIDAPI_KEY')
    const hasApiKey = Boolean(keySetting?.value || platformKey)
    const maskedKey = keySetting?.value
      ? `${keySetting.value.slice(0, 6)}••••••••${keySetting.value.slice(-4)}`
      : (platformKey ? '•••••••• (ใช้คีย์กลางของระบบ)' : '')

    return NextResponse.json({
      success: true,
      competitors,
      quota,
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
    const auth = await requireShop()
    if (auth.error) return auth.error
    const shop_id = auth.shopId
    const body = await req.json()
    const { action, rapidapi_key } = body

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
      const { title, content, competitor_name, strategy_bullets, verdict } = body
      const compName = competitor_name || 'คู่แข่ง'
      const finalTitle = title || `กลยุทธ์รับมือข้อโต้แย้งราคาและคู่แข่ง: ${compName}`

      // Built only from the analysis the shop is looking at. It is saved as a draft:
      // the bot reads active entries only, so nothing reaches customers until the
      // shop has read it and pressed approve on the knowledge page. (Until Oct 2026
      // this went live at once with promises the shop never made: dispatch within
      // 24 hours, "100% as pictured" with instant exchanges, free gifts in chat.)
      let finalContent = content
      if (!finalContent && Array.isArray(strategy_bullets) && strategy_bullets.length > 0) {
        const bulletsText = strategy_bullets.map((b: string) => `- ${b}`).join('\n')
        finalContent = `# แนวทางเมื่อลูกค้าเทียบกับร้าน ${compName}

## คำถามที่อาจเจอ
- "ทำไมร้านนี้แพงกว่าร้าน ${compName} หรือร้านอื่น?"
- "ร้านอื่นถูกกว่า มีส่วนลดไหม?"

## แนวทางตอบ (สุภาพ ไม่พูดถึงคู่แข่งในทางลบ)
${bulletsText}
${verdict ? `\n## ภาพรวม\n${verdict}\n` : ''}
## ร้านต้องเติมเอง
- จุดเด่นจริงของร้าน (เช่น ระยะเวลาจัดส่ง การรับประกัน การเปลี่ยนคืน) ใส่เฉพาะที่ร้านทำได้จริง
- ห้ามให้บอทเสนอส่วนลดหรือของแถมที่ร้านไม่ได้กำหนดไว้`
      } else if (!finalContent) {
        return NextResponse.json({ error: 'Missing title, content, or strategy_bullets' }, { status: 400 })
      }

      // Check for existing battlecard for this competitor to prevent duplicate bloat
      const { data: existing } = await supabase
        .from('knowledge_base')
        .select('id')
        .eq('shop_id', shop_id)
        .eq('category', 'กลยุทธ์คู่แข่ง')
        .eq('source_ref', compName)
        .maybeSingle()

      if (existing) {
        const { data: updatedItem, error: updateError } = await supabase
          .from('knowledge_base')
          .update({
            title: finalTitle,
            content: finalContent,
            status: 'draft',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select('id')
          .single()

        if (updateError) throw updateError

        return NextResponse.json({
          success: true,
          message: `อัปเดตร่างกลยุทธ์รับมือ "${compName}" แล้ว ตรวจแก้และกดอนุมัติที่หน้าคลังความรู้ก่อน บอทจึงจะนำไปใช้`,
          id: updatedItem?.id,
          updated: true,
        })
      }

      const { data: item, error: kbError } = await supabase
        .from('knowledge_base')
        .insert({
          shop_id,
          title: finalTitle,
          content: finalContent,
          category: 'กลยุทธ์คู่แข่ง',
          source: 'competitor_spy',
          source_ref: compName,
          status: 'draft',
        })
        .select('id')
        .single()

      if (kbError) throw kbError

      return NextResponse.json({
        success: true,
        message: `บันทึกร่างกลยุทธ์รับมือ "${compName}" แล้ว ตรวจแก้และกดอนุมัติที่หน้าคลังความรู้ก่อน บอทจึงจะนำไปใช้`,
        id: item?.id,
        updated: false,
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
    const auth = await requireShop()
    if (auth.error) return auth.error
    const shopId = auth.shopId
    const competitorId = req.nextUrl.searchParams.get('id')

    if (!competitorId) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 })
    }

    const deleted = await deleteCompetitor(shopId, competitorId)
    return NextResponse.json({ success: deleted })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
