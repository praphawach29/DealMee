import type { ShopSkill, ShopSkillType } from './shopSkills'

export interface SkillExtractionResult {
  success: boolean
  skillId?: string
  error?: string
  skipped?: boolean
  reason?: string
}

export interface ExtractedSkill {
  skill_type: ShopSkillType
  category: string
  trigger_keywords: string[]
  knowledge_body: string | null
  instruction: string | null
}

/**
 * Extract a candidate skill from a completed conversation.
 * Follows the pattern of extractGoldenTrajectoryFromOrder but produces a shop_skill candidate.
 */
export async function extractSkillFromConversation({
  shopId,
  conversationId,
  outcome,
  revenue = 0,
}: {
  shopId: string
  conversationId: string
  outcome: string // 'conversion' | 'handoff' | 'cancelled' | 'no_response'
  revenue?: number
}): Promise<SkillExtractionResult> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const supabase = createAdminClient()

    // 1. Fetch transcript
    const { data: messages, error: msgErr } = await supabase
      .from('chat_messages')
      .select('sender_type, message, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(40)

    if (msgErr || !messages || messages.length < 3) {
      return { success: false, error: 'Not enough conversation turns', skipped: true, reason: 'insufficient_turns' }
    }

    // 2. Check if already extracted (dedup by conversation)
    const { data: existingSources } = await supabase
      .from('shop_skill_sources')
      .select('skill_id')
      .eq('conversation_id', conversationId)
      .limit(1)

    if (existingSources && existingSources.length > 0) {
      return { success: false, skipped: true, reason: 'already_extracted', error: 'Skill already extracted from this conversation' }
    }

    // 3. Fetch outcome details
    const { data: outcomeRow } = await supabase
      .from('conversation_outcomes')
      .select('outcome, ai_confidence, intent, sales_stage_final')
      .eq('conversation_id', conversationId)
      .maybeSingle()

    const aiConfidence = outcomeRow?.ai_confidence ?? 0.5
    const intent = outcomeRow?.intent ?? 'info_request'

    // 4. Build transcript (redact PII)
    const transcript = messages
      .map((m: any) => `${m.sender_type === 'user' ? 'ลูกค้า' : 'บอท'}: ${redactPii(m.message)}`)
      .join('\n')

const { platformSecret } = await import('@/lib/platformSecrets')
    const apiKey = await platformSecret('GEMINI_API_KEY')
    if (!apiKey) {
      return { success: false, error: 'Missing Gemini API Key' }
    }

    const model = (await platformSecret('GEMINI_MODEL')) || 'gemini-2.5-flash'

    const prompt = `คุณคือผู้เชี่ยวชาญด้านการสกัดความรู้ (Knowledge Extraction Specialist) สำหรับร้านค้า

จงวิเคราะห์บทสนทนานี้และสกัด "สกิล" (skill) ที่เป็นประโยชน์สำหรับบอทขายของร้าน

ประเภทสกิล (skill_type) — เลือกหนึ่ง:
- "knowledge": ข้อมูลความรู้ที่ควรจำ (เช่น นโยบาย, ข้อมูลสินค้า, FAQ)
- "behavior": แนวทางการตอบ/พฤติกรรมที่ควรทำ (เช่น วิธีทักทาย, วิธีปิดการขาย)
- "example": ตัวอย่างบทสนทนาที่ดี (เช่น วิธีตอบคำถามราคา)
- "rule": กฎ/ข้อห้าม (เช่น ห้ามลดราคาเกิน X%, ห้ามสัญญาวันส่ง)

ผลลัพธ์ของ conversation: ${outcome}
AI confidence: ${aiConfidence}
Intent: ${intent}

กติกา:
- สกัดเฉพาะข้อมูลที่ "เป็นประโยชน์" และ "ใช้ซ้ำได้" ในอนาคต
- อย่าสกัดข้อมูลส่วนบุคคล (ชื่อ, เบอร์, ที่อยู่, สลิป)
- อย่าสกัดข้อมูลที่เป็น "เฉพาะครั้งนี้" (เช่น เลขออเดอร์, วันที่)
- trigger_keywords: คำสำคัญ 2-5 คำ ที่ควร trigger สกิลนี้
- category: หมวดหมู่ เช่น "sales", "shipping", "product_info", "greeting", "objection_handling"
- knowledge_body: ข้อมูลความรู้ (ถ้า skill_type = knowledge/example) หรือ null
- instruction: แนวทาง/กฎ (ถ้า skill_type = behavior/rule) หรือ null
- ต้องมี knowledge_body หรือ instruction อย่างน้อยหนึ่ง

ตอบกลับเป็น JSON รูปแบบนี้เท่านั้น:
{
  "skill_type": "knowledge",
  "category": "sales",
  "trigger_keywords": ["คำ1", "คำ2"],
  "knowledge_body": "ข้อมูลที่ควรจำ...",
  "instruction": "แนวทางที่ควรทำ..."
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
            temperature: 0.2,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
          },
        }),
      }
    )

    if (!response.ok) {
      console.error('[SkillExtractor] Gemini API error:', await response.text())
      return { success: false, error: 'Gemini extraction failed' }
    }

    const data = await response.json()
    const raw = (data.candidates?.[0]?.content?.parts || [])
      .map((part: { text?: string }) => part.text || '')
      .join('')

    if (!raw.trim()) {
      return { success: false, error: 'Empty output from model' }
    }

    let parsed: ExtractedSkill
    try {
      parsed = JSON.parse(raw)
    } catch {
      return { success: false, error: 'Invalid JSON from model' }
    }

    // Validate
    const validTypes: ShopSkillType[] = ['knowledge', 'behavior', 'example', 'rule']
    if (!validTypes.includes(parsed.skill_type)) {
      parsed.skill_type = 'knowledge'
    }
    if (!parsed.knowledge_body && !parsed.instruction) {
      return { success: false, error: 'No useful content extracted', skipped: true, reason: 'no_content' }
    }
    if (!parsed.trigger_keywords || parsed.trigger_keywords.length === 0) {
      parsed.trigger_keywords = [parsed.category || 'general']
    }

    // 5. Dedup check - find similar existing skills
    const { data: existingSkills } = await supabase
      .from('shop_skills')
      .select('id, skill_type, category, trigger_keywords, knowledge_body, instruction, status')
      .eq('shop_id', shopId)
      .eq('skill_type', parsed.skill_type)

    const isDuplicate = checkDuplicate(parsed, existingSkills || [])
    if (isDuplicate) {
      return { success: false, skipped: true, reason: 'duplicate', error: 'Similar skill already exists' }
    }

    // 6. Conflict check against active skills
    const conflict = checkConflict(parsed, (existingSkills || []).filter((s: any) => s.status === 'active'))
    if (conflict) {
      console.warn(`[SkillExtractor] Conflict detected: ${conflict}`)
      // Still create as candidate, but log the conflict
    }

    // 7. Create candidate skill
    const { data: inserted, error: insertErr } = await supabase
      .from('shop_skills')
      .insert({
        shop_id: shopId,
        skill_type: parsed.skill_type,
        category: parsed.category || 'sales',
        version: '0.1.0',
        status: 'candidate',
        trigger_keywords: parsed.trigger_keywords.slice(0, 20),
        knowledge_body: parsed.knowledge_body,
        instruction: parsed.instruction,
        gold_conversations: [],
      })
      .select('id')
      .single()

    if (insertErr || !inserted) {
      console.error('[SkillExtractor] Insert error:', insertErr)
      return { success: false, error: insertErr?.message || 'Insert failed' }
    }

    // 8. Link source
    await supabase.from('shop_skill_sources').insert({
      skill_id: inserted.id,
      shop_id: shopId,
      conversation_id: conversationId,
      weight: outcome === 'conversion' ? 1.0 : outcome === 'handoff' ? 0.7 : 0.5,
    })

    console.log(`[SkillExtractor] Created candidate skill ${inserted.id} from conversation ${conversationId} (outcome: ${outcome})`)
    return { success: true, skillId: inserted.id }
  } catch (err: any) {
    console.error('[SkillExtractor] Exception:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Check if a new skill is a duplicate of an existing one.
 * Uses keyword overlap + content similarity.
 */
function checkDuplicate(newSkill: ExtractedSkill, existing: any[]): boolean {
  for (const skill of existing) {
    // Same type + category + high keyword overlap
    if (skill.skill_type !== newSkill.skill_type) continue
    if (skill.category !== newSkill.category) continue

    const existingKw = new Set((skill.trigger_keywords || []).map((k: string) => k.toLowerCase()))
    const newKw = newSkill.trigger_keywords.map((k: string) => k.toLowerCase())
    const overlap = newKw.filter((k) => existingKw.has(k)).length
    const overlapRatio = newKw.length > 0 ? overlap / newKw.length : 0

    if (overlapRatio >= 0.6) {
      // High keyword overlap → likely duplicate
      // Also check content similarity
      const existingContent = (skill.knowledge_body || skill.instruction || '').toLowerCase()
      const newContent = (newSkill.knowledge_body || newSkill.instruction || '').toLowerCase()
      if (existingContent && newContent) {
        // Simple: check if one contains the other or they share >50% words
        const existingWords = new Set(existingContent.split(/\s+/))
        const newWords = newContent.split(/\s+/)
        const wordOverlap = newWords.filter((w) => existingWords.has(w)).length
        const wordRatio = newWords.length > 0 ? wordOverlap / newWords.length : 0
        if (wordRatio >= 0.5) return true
      }
      return true
    }
  }
  return false
}

/**
 * Check if a new skill conflicts with existing active skills.
 * Returns a description of the conflict, or null if no conflict.
 */
function checkConflict(newSkill: ExtractedSkill, activeSkills: any[]): string | null {
  for (const skill of activeSkills) {
    if (skill.skill_type !== newSkill.skill_type) continue
    if (skill.category !== newSkill.category) continue

    // Check for contradictory instructions (simple heuristic)
    const existingContent = (skill.knowledge_body || skill.instruction || '').toLowerCase()
    const newContent = (newSkill.knowledge_body || newSkill.instruction || '').toLowerCase()

    // Look for negation patterns
    const negationPairs = [
      ['ห้าม', 'อนุญาต'],
      ['ไม่', 'ได้'],
      ['ปฏิเสธ', 'อนุมัติ'],
    ]

    for (const [neg, pos] of negationPairs) {
      if (existingContent.includes(neg) && newContent.includes(pos)) {
        return `Possible conflict: existing says "${neg}" but new says "${pos}"`
      }
      if (existingContent.includes(pos) && newContent.includes(neg)) {
        return `Possible conflict: existing says "${pos}" but new says "${neg}"`
      }
    }
  }
  return null
}

/**
 * Redact PII from text for safe storage in skills.
 */
function redactPii(text: string): string {
  if (!text) return ''
  return text
    // Phone numbers
    .replace(/\b0\d{8,9}\b/g, '[เบอร์โทร]')
    // Email
    .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, '[อีเมล]')
    // Thai ID (13 digits)
    .replace(/\b\d{13}\b/g, '[เลขบัตรประชาชน]')
    // LINE user IDs
    .replace(/\bU[0-9a-f]{32}\b/gi, '[LINE ID]')
    // Bank account numbers (10-12 digits)
    .replace(/\b\d{10,12}\b/g, '[เลขบัญชี]')
    // Order/booking numbers
    .replace(/\b(ORD|BK|QT)-\d+\b/gi, '[เลขที่เอกสาร]')
}

/**
 * Batch extract skills from all completed conversations for a shop.
 * Used by cron for reconciliation.
 */
export async function batchExtractSkillsForShop(shopId: string, limit = 10): Promise<{
  processed: number
  created: number
  skipped: number
  errors: number
}> {
const { createAdminClient } = await import('@/lib/supabase/admin')
  const supabase = createAdminClient()
  const result = { processed: 0, created: 0, skipped: 0, errors: 0 }

  // Find conversations with outcomes but no skill extraction yet
  const { data: conversations } = await supabase
    .from('conversation_outcomes')
    .select('conversation_id, outcome, revenue')
    .eq('shop_id', shopId)
    .in('outcome', ['conversion', 'handoff'])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!conversations || conversations.length === 0) return result

  for (const conv of conversations) {
    result.processed++
    const extraction = await extractSkillFromConversation({
      shopId,
      conversationId: conv.conversation_id,
      outcome: conv.outcome,
      revenue: conv.revenue || 0,
    })

    if (extraction.success) result.created++
    else if (extraction.skipped) result.skipped++
    else result.errors++
  }

  return result
}
