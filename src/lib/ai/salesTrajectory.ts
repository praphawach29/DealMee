import { createAdminClient } from '@/lib/supabase/admin'

export type ObjectionType =
  | 'price_hesitation'
  | 'product_comparison'
  | 'shipping_doubt'
  | 'trust_building'
  | 'urgency_promotion'
  | 'general_purchase'

export interface GoldenTrajectory {
  id: string
  shop_id: string
  conversation_id: string | null
  order_id: string | null
  customer_objection_type: ObjectionType
  customer_intent_summary: string
  winning_turn_dialogue: Array<{ sender: 'customer' | 'bot' | 'agent'; text: string }>
  closing_technique: string
  revenue: number
  status: 'active' | 'archived'
  created_at: string
}

/**
 * Hermes-inspired Golden Trajectory Extractor
 *
 * Automatically analyzes a completed order conversation transcript to extract
 * the winning dialogue turns, customer objection type, and effective closing technique.
 */
export async function extractGoldenTrajectoryFromOrder({
  shopId,
  orderId,
  conversationId,
  revenue = 0,
}: {
  shopId: string
  orderId?: string | null
  conversationId?: string | null
  revenue?: number
}): Promise<{ success: boolean; trajectoryId?: string; error?: string }> {
  try {
    if (!conversationId) return { success: false, error: 'No conversationId provided' }

    const supabase = createAdminClient()

    // 1. Fetch transcript messages
    const { data: messages, error: msgErr } = await supabase
      .from('chat_messages')
      .select('sender_type, message, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(30)

    if (msgErr || !messages || messages.length < 2) {
      return { success: false, error: 'Not enough conversation turns to extract trajectory' }
    }

    const transcript = messages
      .map((m) => `${m.sender_type === 'user' ? 'ลูกค้า' : 'พนักงานขาย/บอท'}: ${m.message}`)
      .join('\n')

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
    if (!apiKey) {
      return { success: false, error: 'Missing Gemini API Key' }
    }

    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    const prompt = `คุณคือสุดยอดโค้ชวิเคราะห์การขาย (Sales Trajectory Analyst)
จงวิเคราะห์บทสนทนานี้ซึ่งปิดการขายสำเร็จและลูกค้าโอนเงินแล้ว เพื่อถอดรหัส "จังหวะปิดการขายที่ดีที่สุด" (Winning Closing Turn)

หน้าที่ของคุณ:
1. สรุปความต้องการหรือข้อกังวลหลักของลูกค้า (customer_intent_summary) เช่น "ลูกค้าลังเลเรื่องราคาเทียบกับรุ่นอื่น"
2. ระบุประเภทข้อกังวล (customer_objection_type) เลือกหนึ่งข้อจาก:
   - "price_hesitation" (ลังเลราคา/ขอส่วนลด)
   - "product_comparison" (เปรียบเทียบรุ่น/ไม่แน่ใจว่าเหมาะกับตัวเองไหม)
   - "shipping_doubt" (ถามเรื่องรอบส่ง/ระยะเวลาจัดส่ง)
   - "trust_building" (ถามเรื่องของแท้/การรับประกัน/ความน่าเชื่อถือ)
   - "urgency_promotion" (ถามเรื่องโปรโมชั่น/ของแถม)
   - "general_purchase" (สอบถามและสั่งซื้อตามปกติ)
3. สกัดช่วงบทสนทนาสำคัญ (winning_turn_dialogue) ประมาณ 2-4 ประโยค ที่ลูกค้าถามข้อสงสัย แล้วร้านตอบจนลูกค้าตกลงซื้อ
4. ระบุชื่อเทคนิคปิดการขายที่ใช้ (closing_technique) เช่น "อธิบายความคุ้มค่าพร้อมสร้างความมั่นใจเรื่องการรับประกัน", "เสนอทางเลือกที่ตรงกับการใช้งานและบอกรอบส่งวันนี้"

กติกาเข้มงวด:
- ลบข้อมูลส่วนบุคคล (ชื่อจริง, เบอร์โทร, ที่อยู่, เลขสลิป) ออกจากบทสนทนา
- ตอบกลับเป็น JSON รูปแบบนี้เท่านั้น:
{
  "customer_objection_type": "price_hesitation",
  "customer_intent_summary": "...",
  "winning_turn_dialogue": [
    { "sender": "customer", "text": "..." },
    { "sender": "bot", "text": "..." }
  ],
  "closing_technique": "..."
}

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
      console.error('[SalesTrajectory] Gemini API error:', await response.text())
      return { success: false, error: 'Gemini extraction failed' }
    }

    const data = await response.json()
    const raw = (data.candidates?.[0]?.content?.parts || [])
      .map((part: { text?: string }) => part.text || '')
      .join('')

    if (!raw.trim()) {
      return { success: false, error: 'Empty output from model' }
    }

    const parsed = JSON.parse(raw)
    if (!parsed.customer_intent_summary || !parsed.winning_turn_dialogue?.length) {
      return { success: false, error: 'Invalid structure returned' }
    }

    // Insert into sales_trajectories
    const { data: inserted, error: insertErr } = await supabase
      .from('sales_trajectories')
      .insert({
        shop_id: shopId,
        conversation_id: conversationId,
        order_id: orderId || null,
        customer_objection_type: parsed.customer_objection_type || 'general_purchase',
        customer_intent_summary: parsed.customer_intent_summary,
        winning_turn_dialogue: parsed.winning_turn_dialogue,
        closing_technique: parsed.closing_technique || 'ปิดการขายด้วยข้อมูลชัดเจน',
        revenue: revenue || 0,
        status: 'active',
      })
      .select('id')
      .single()

    if (insertErr) {
      console.error('[SalesTrajectory] Insert error:', insertErr)
      return { success: false, error: insertErr.message }
    }

    console.log(`[SalesTrajectory] Successfully extracted Golden Trajectory ${inserted.id} for shop ${shopId}`)
    return { success: true, trajectoryId: inserted.id }
  } catch (err: any) {
    console.error('[SalesTrajectory] Exception extracting trajectory:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Retrieve the most relevant winning trajectories (Few-Shot examples) based on customer query
 */
export async function retrieveWinningTrajectories({
  shopId,
  userQuery,
  limit = 2,
}: {
  shopId: string
  userQuery: string
  limit?: number
}): Promise<GoldenTrajectory[]> {
  try {
    const supabase = createAdminClient()
    const { data: trajectories, error } = await supabase
      .from('sales_trajectories')
      .select('*')
      .eq('shop_id', shopId)
      .eq('status', 'active')
      .order('revenue', { ascending: false })
      .limit(15)

    if (error || !trajectories || trajectories.length === 0) {
      return []
    }

    const queryLower = userQuery.toLowerCase()

    // Detect objection keywords
    let detectedType: ObjectionType = 'general_purchase'
    if (queryLower.includes('แพง') || queryLower.includes('ลด') || queryLower.includes('ราคา') || queryLower.includes('งบ') || queryLower.includes('บาท')) {
      detectedType = 'price_hesitation'
    } else if (queryLower.includes('ต่าง') || queryLower.includes('รุ่น') || queryLower.includes('ดีกว่า') || queryLower.includes('แบบไหน')) {
      detectedType = 'product_comparison'
    } else if (queryLower.includes('ส่ง') || queryLower.includes('ถึงเมื่อ') || queryLower.includes('กี่วัน') || queryLower.includes('ด่วน')) {
      detectedType = 'shipping_doubt'
    } else if (queryLower.includes('แท้') || queryLower.includes('ประกัน') || queryLower.includes('รีวิว') || queryLower.includes('เชื่อถือ')) {
      detectedType = 'trust_building'
    } else if (queryLower.includes('โปร') || queryLower.includes('แถม') || queryLower.includes('ของแถม') || queryLower.includes('โค้ด')) {
      detectedType = 'urgency_promotion'
    }

    // Rank trajectories by relevance match
    const scored = (trajectories as GoldenTrajectory[]).map((t) => {
      let score = 0
      if (t.customer_objection_type === detectedType) score += 5
      const summaryWords = t.customer_intent_summary.toLowerCase().split(' ')
      for (const w of summaryWords) {
        if (w.length > 2 && queryLower.includes(w)) score += 2
      }
      return { t, score }
    })

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, limit).map((s) => s.t)
  } catch (err) {
    console.error('[SalesTrajectory] Exception retrieving trajectories:', err)
    return []
  }
}

/**
 * Format winning trajectories into a clean few-shot prompt context
 */
export function formatGoldenClosersPromptContext(trajectories: GoldenTrajectory[]): string {
  if (!trajectories || trajectories.length === 0) return ''

  const lines: string[] = [
    '🏆 [ตัวอย่างบทสนทนาจริงที่ปิดการขายสำเร็จในอดีต (Golden Closing Trajectories)]',
    'ให้ใช้เป็นแนวทางในการเลือกใช้ถ้อยคำ โน้มน้าวใจ และตอบข้อกังวลของลูกค้าเหมือนพนักงานขายมือทองของร้าน:',
  ]

  trajectories.forEach((traj, idx) => {
    lines.push(`\nตัวอย่างที่ ${idx + 1} (กรณี: ${traj.customer_intent_summary} | เทคนิค: ${traj.closing_technique}):`)
    if (Array.isArray(traj.winning_turn_dialogue)) {
      traj.winning_turn_dialogue.forEach((turn) => {
        lines.push(`- ${turn.sender === 'customer' ? 'ลูกค้า' : 'พนักงานขาย'}: "${turn.text}"`)
      })
    }
  })

  return lines.join('\n')
}
