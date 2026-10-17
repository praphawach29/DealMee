import { NextRequest, NextResponse } from 'next/server'
import { getCompetitors, deleteCompetitor } from '@/lib/competitors/competitorStore'
import { createAdminClient } from '@/lib/supabase/admin'
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

    const hasApiKey = Boolean(keySetting?.value || process.env.RAPIDAPI_KEY)
    const maskedKey = keySetting?.value
      ? `${keySetting.value.slice(0, 6)}••••••••${keySetting.value.slice(-4)}`
      : (process.env.RAPIDAPI_KEY ? '•••••••• (ใช้คีย์จากระบบ Vercel)' : '')

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

      // Synthesize high-converting objection-handling battlecard for the sales AI
      let finalContent = content
      if (!finalContent && Array.isArray(strategy_bullets) && strategy_bullets.length > 0) {
        const bulletsText = strategy_bullets.map((b: string) => `- ${b}`).join('\n')
        finalContent = `# [แนวทางรับมือข้อโต้แย้งราคาและเปรียบเทียบคู่แข่ง: ${compName}]

## 🎯 คำถามและข้อโต้แย้งที่พบบ่อยจากลูกค้า:
- "ทำไมร้านเราถึงแพงกว่าร้าน ${compName} หรือร้านอื่น?"
- "เห็นร้านอื่นขายราคาถูกกว่า มีส่วนลดมั้ย?"
- "คุณภาพต่างจากร้านดัง/ร้านอื่นยังไงบ้าง?"

## 💡 แนวทางการตอบของ AI (สุภาพ มั่นใจ ไม่พาดพิงเชิงลบ ชูจุดเด่นที่คุ้มค่ากว่า):
${bulletsText}

${verdict ? `## 📊 กลยุทธ์ภาพรวม:\n${verdict}\n` : ''}
## 🛡️ จุดขายที่เหนือกว่า (Value Superiority):
- สินค้าพร้อมส่งด่วนจากไทยใน 24 ชั่วโมง (ไม่ต้องรอพรีออเดอร์ ไม่ต้องลุ้น)
- คัดสรรเกรดพรีเมียม สัมผัสนุ่ม ทรงสวย คุ้มค่าในระยะยาว
- รับประกันสินค้าตรงปก 100% มีบริการดูแลเปลี่ยนเคลมทันที
- สั่งซื้อในแชทมีสิทธิพิเศษและโปรโมชั่นของแถมเฉพาะช่องทางนี้`
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
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select('id')
          .single()

        if (updateError) throw updateError

        return NextResponse.json({
          success: true,
          message: `อัปเดตกลยุทธ์รับมือ "${compName}" ในคลังความรู้บอทเรียบร้อยแล้ว!`,
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
          status: 'active',
        })
        .select('id')
        .single()

      if (kbError) throw kbError

      return NextResponse.json({
        success: true,
        message: `เพิ่มกลยุทธ์รับมือ "${compName}" เข้าคลังความรู้บอทเรียบร้อยแล้ว!`,
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
