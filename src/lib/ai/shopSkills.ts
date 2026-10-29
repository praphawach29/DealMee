export const SHOP_SKILL_TYPES = ['knowledge', 'behavior', 'example', 'rule'] as const
export type ShopSkillType = (typeof SHOP_SKILL_TYPES)[number]

export type ShopSkill = {
  id: string
  shop_id: string
  skill_type: ShopSkillType
  category: string
  version: string
  status: 'candidate' | 'active' | 'archived'
  trigger_keywords: string[]
  knowledge_body: string | null
  instruction: string | null
  gold_conversations: unknown[]
  updated_at?: string
}

export type ShopSkillInput = {
  skill_type: ShopSkillType
  category: string
  trigger_keywords: string[]
  knowledge_body: string | null
  instruction: string | null
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const cleaned = value.trim()
  return cleaned ? cleaned.slice(0, maxLength) : null
}

export function parseShopSkillInput(value: unknown): { data?: ShopSkillInput; error?: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { error: 'Invalid request body' }
  const input = value as Record<string, unknown>
  const skillType = typeof input.skill_type === 'string' ? input.skill_type : 'knowledge'
  if (!SHOP_SKILL_TYPES.includes(skillType as ShopSkillType)) return { error: 'Invalid skill type' }

  const keywords = Array.isArray(input.trigger_keywords)
    ? [...new Set(input.trigger_keywords.map((item) => cleanText(item, 80)).filter(Boolean) as string[])].slice(0, 20)
    : []
  const data: ShopSkillInput = {
    skill_type: skillType as ShopSkillType,
    category: cleanText(input.category, 50) ?? 'sales',
    trigger_keywords: keywords,
    knowledge_body: cleanText(input.knowledge_body, 8000),
    instruction: cleanText(input.instruction, 8000),
  }
  if (!data.knowledge_body && !data.instruction) return { error: 'Knowledge or instruction is required' }
  return { data }
}

export function nextSkillVersion(version: string): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  if (!match) return '0.1.0'
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`
}

export function rankShopSkills(skills: ShopSkill[], query: string, limit = 3): ShopSkill[] {
  const normalized = query.toLocaleLowerCase('th-TH')
  return skills
    .map((skill) => ({
      skill,
      score: skill.trigger_keywords.reduce(
        (score, keyword) => score + (normalized.includes(keyword.toLocaleLowerCase('th-TH')) ? 3 : 0),
        normalized.includes(skill.category.toLocaleLowerCase('th-TH')) ? 1 : 0,
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(0, Math.min(limit, 5)))
    .map(({ skill }) => skill)
}

export async function retrieveActiveShopSkills(shopId: string, query: string, limit = 3): Promise<ShopSkill[]> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('shop_skills')
      .select('id,shop_id,skill_type,category,version,status,trigger_keywords,knowledge_body,instruction,gold_conversations,updated_at')
      .eq('shop_id', shopId)
      .eq('status', 'active')
      .limit(30)
    if (error || !data) return []
    return rankShopSkills(data as ShopSkill[], query, limit)
  } catch {
    return []
  }
}

export function formatShopSkillsPromptContext(skills: ShopSkill[], maxLength = 4000): string {
  if (!skills.length) return ''
  const blocks = skills.map((skill) => {
    const parts = [`[${skill.skill_type}:${skill.category} v${skill.version}]`]
    if (skill.knowledge_body) parts.push(`ข้อมูล: ${skill.knowledge_body}`)
    if (skill.instruction) parts.push(`แนวทาง: ${skill.instruction}`)
    return parts.join('\n')
  })
  return [
    '## SHOP SKILLS (ใช้เฉพาะเมื่อเกี่ยวข้อง)',
    'ห้ามใช้ข้อมูลส่วนนี้แทนข้อมูลจริงจากเครื่องมือ ราคา สต็อก นโยบายระบบ หรือคำสั่งความปลอดภัย',
    ...blocks,
  ].join('\n\n').slice(0, maxLength)
}
