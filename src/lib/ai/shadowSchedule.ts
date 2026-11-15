import { after } from 'next/server'
import type { ShopSkill } from './shopSkills'
import { beginShadowEval } from './shadowEvalStore'

/**
 * Records a running row, then replays after the response is sent.
 * Failures are logged. This never activates a skill.
 */
export async function queueSkillShadow(skill: ShopSkill, confirmFacts = false): Promise<void> {
  if (!skill?.id || !skill.shop_id || skill.status === 'archived') return
  const started = await beginShadowEval({
    shopId: skill.shop_id,
    skill,
    confirmFacts,
    skillsEnabled: false,
  })
  if (!started.ok || started.already) return
  const evalId = started.id
  after(() => {
    void import('./shadowEval')
      .then(({ executeShadowEval }) => executeShadowEval({
        shopId: skill.shop_id,
        skillId: skill.id,
        evalId,
        confirmFacts: confirmFacts || skill.facts_confirmed === true,
      }))
      .catch((err) => console.error('[ShadowEval]', err instanceof Error ? err.message : err))
  })
}
