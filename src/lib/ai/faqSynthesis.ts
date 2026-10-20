import { createAdminClient } from '@/lib/supabase/admin'
import { platformSecret } from '@/lib/platformSecrets'

export interface SynthesizedFaq {
  title: string
  content: string
  category: 'faq' | 'policy' | 'product'
}

/**
 * Hermes-inspired Continuous Learning & Auto-FAQ Synthesis
 *
 * Analyzes conversation transcripts (especially when human staff steps in or
 * after customer inquiries) to synthesize reusable FAQ entries in 'draft' status.
 */
export async function synthesizeFaqFromConversation({
  shopId,
  conversationId,
}: {
  shopId: string
  conversationId: string
}): Promise<{ success: boolean; createdCount: number; message?: string }> {
  try {
    const supabase = createAdminClient()

    // 1. Fetch recent messages in this conversation
    const { data: messages, error: msgError } = await supabase
      .from('chat_messages')
      .select('sender_type, message, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(25)

    if (msgError || !messages || messages.length < 2) {
      return { success: false, createdCount: 0, message: 'บทสนทนามีข้อความไม่เพียงพอสำหรับการวิเคราะห์' }
    }

    // 2. Fetch existing knowledge base titles to prevent duplicates
    const { data: existingKb } = await supabase
      .from('knowledge_base')
      .select('title')
      .eq('shop_id', shopId)

    const existingTitles = (existingKb || []).map((k) => k.title.toLowerCase().trim())

    // 3. Format transcript for Gemini
    const transcript = messages
      .map((m) => `${m.sender_type === 'user' ? 'ลูกค้า' : m.sender_type === 'human' || m.sender_type === 'agent' ? 'แอดมินคนจริง' : 'บอท AI'}: ${m.message}`)
      .join('\n')

    const apiKey = await platformSecret('GEMINI_API_KEY')
    if (!apiKey) {
      console.warn('[FaqSynthesis] GEMINI_API_KEY not configured, skipping auto-synthesis')
      return { success: false, createdCount: 0, message: 'ยังไม่ได้ตั้งค่า API Key' }
    }

    const model = (await platformSecret('GEMINI_MODEL')) || 'gemini-2.5-flash'
    const prompt = `คุณคือผู้เชี่ยวชาญการถอดบทเรียนและสร้างคลังความรู้ (Knowledge Synthesizer) สำหรับร้านค้า
บทบาทของคุณคือวิเคราะห์บทสนทนาระหว่างลูกค้าและร้านค้าด้านล่างนี้ และตรวจสอบว่ามี "คำถามสำคัญที่ลูกค้าถาม และได้รับคำตอบที่ชัดเจนถูกต้อง" ซึ่งควรค่าแก่การเก็บเป็น FAQ ประจำร้านหรือไม่

กติกาเข้มงวด:
1. หากบทสนทนาเป็นเพียงการทักทายทั่วไป, การสั่งซื้อปกติที่ไม่มีคำถามพิเศษ, หรือยังไม่มีคำตอบที่ชัดเจน ให้ตอบเป็น Array ว่าง []
2. ห้ามสกัดข้อมูลส่วนบุคคลของลูกค้า เช่น ชื่อ เบอร์โทร เลขที่บ้าน เลขสลิป หรือเลขบัญชีเด็ดขาด
3. ให้สกัดเฉพาะข้อมูลนโยบายร้าน, วิธีการใช้งาน, คุณสมบัติสินค้า, เงื่อนไขบริการ, วิธีชำระเงิน, หรือรอบส่งของที่ตอบเป็นความรู้ทั่วไปได้
4. หัวข้อ (title) ต้องเป็นรูปประโยคคำถามชัดเจน เช่น "ร้านมีบริการเก็บเงินปลายทางไหม", "สินค้ามีรับประกันกี่วัน", "ส่งของกี่วันถึง"
5. คำตอบ (content) ต้องกระชับ สุภาพ ครบถ้วน และถูกต้องตามที่ร้านหรือแอดมินตอบจริง
6. ตอบเป็น JSON array เท่านั้น รูปแบบ: [{"title":"...","content":"...","category":"faq"}]

รายการ FAQ ที่ร้านมีอยู่แล้ว (ห้ามสร้างซ้ำ):
${existingTitles.length > 0 ? existingTitles.map((t) => `- ${t}`).join('\n') : '(ยังไม่มี)'}

บทสนทนาจริง:
"""
${transcript}
"""`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
          },
        }),
      }
    )

    if (!response.ok) {
      console.error('[FaqSynthesis] Gemini API error:', await response.text())
      return { success: false, createdCount: 0, message: 'AI generation error' }
    }

    const data = await response.json()
    const raw = (data.candidates?.[0]?.content?.parts || [])
      .map((part: { text?: string }) => part.text || '')
      .join('')

    if (!raw.trim()) {
      return { success: true, createdCount: 0 }
    }

    let parsed: SynthesizedFaq[] = []
    try {
      const json = JSON.parse(raw)
      parsed = Array.isArray(json) ? json : []
    } catch {
      console.error('[FaqSynthesis] Failed to parse model output:', raw)
      return { success: false, createdCount: 0, message: 'JSON parse error' }
    }

    // Filter out duplicates and empty items
    const candidates = parsed.filter((item) => {
      const cleanTitle = (item.title || '').toLowerCase().trim()
      const cleanContent = (item.content || '').trim()
      return (
        cleanTitle.length > 3 &&
        cleanContent.length > 5 &&
        !existingTitles.includes(cleanTitle)
      )
    })

    if (candidates.length === 0) {
      return { success: true, createdCount: 0 }
    }

    // Insert as draft items in knowledge_base
    const toInsert = candidates.map((item) => ({
      shop_id: shopId,
      title: item.title.trim(),
      content: item.content.trim(),
      category: item.category || 'faq',
      status: 'draft',
      source: 'ai_synthesis',
      source_ref: conversationId,
    }))

    const { error: insertError } = await supabase.from('knowledge_base').insert(toInsert)
    if (insertError) {
      console.error('[FaqSynthesis] Insert draft KB error:', insertError)
      return { success: false, createdCount: 0, message: insertError.message }
    }

    console.log(`[FaqSynthesis] Successfully synthesized ${toInsert.length} draft FAQs for shop ${shopId}`)
    return { success: true, createdCount: toInsert.length }
  } catch (err: any) {
    console.error('[FaqSynthesis] Exception:', err)
    return { success: false, createdCount: 0, message: err.message }
  }
}

/**
 * Scans multiple recent conversations of a shop and synthesizes candidate FAQs
 * into draft status (On-demand scan trigger).
 */
export async function synthesizeFaqFromShopConversations({
  shopId,
  limit = 8,
}: {
  shopId: string
  limit?: number
}): Promise<{ success: boolean; totalCreated: number; message: string }> {
  try {
    const supabase = createAdminClient()
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('id, status, last_message_at')
      .eq('shop_id', shopId)
      .order('last_message_at', { ascending: false })
      .limit(limit)

    if (error || !conversations || conversations.length === 0) {
      return { success: true, totalCreated: 0, message: 'ไม่พบบทสนทนาที่สามารถนำมาวิเคราะห์ได้' }
    }

    let totalCreated = 0
    for (const conv of conversations) {
      const res = await synthesizeFaqFromConversation({
        shopId,
        conversationId: conv.id,
      })
      if (res.success && res.createdCount > 0) {
        totalCreated += res.createdCount
      }
    }

    return {
      success: true,
      totalCreated,
      message: totalCreated > 0
        ? `วิเคราะห์บทสนทนาเรียบร้อย สังเคราะห์คำถามแนะนำใหม่ได้ ${totalCreated} ข้อ!`
        : 'วิเคราะห์บทสนทนาแล้ว ยังไม่พบคำถาม-คำตอบใหม่ที่ต้องเพิ่มเข้าคลังความรู้',
    }
  } catch (err: any) {
    console.error('[FaqSynthesis] synthesizeFaqFromShopConversations error:', err)
    return { success: false, totalCreated: 0, message: err.message || 'เกิดข้อผิดพลาดในการสแกน' }
  }
}
