import {
  formatShopSkillsEvidence,
  formatShopSkillsPromptContext,
  type ShopSkill,
} from './shopSkills'

export type ShadowSkillReplay = {
  extraSkills?: ShopSkill[]
  omitSkillIds?: string[]
  maxSteps?: number
}

/**
 * Skills the shadow arm may see. Extras from another shop are dropped.
 * The copy is marked active in memory only; nothing is written back.
 */
export function shadowSkillContext(
  active: ShopSkill[],
  replay: ShadowSkillReplay | undefined,
  shopId: string,
): { skills: ShopSkill[]; prompt: string; evidence: string } {
  let skills = active.filter((skill) => skill.shop_id === shopId)
  const omit = new Set(replay?.omitSkillIds || [])
  if (omit.size > 0) skills = skills.filter((skill) => !omit.has(skill.id))
  for (const extra of replay?.extraSkills || []) {
    if (extra.shop_id !== shopId) continue
    skills = skills.filter((skill) => skill.id !== extra.id)
    skills.push({ ...extra, status: 'active' })
  }
  return {
    skills,
    prompt: formatShopSkillsPromptContext(skills),
    evidence: formatShopSkillsEvidence(skills),
  }
}
