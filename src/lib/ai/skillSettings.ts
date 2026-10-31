export type SkillSettingsInput = { enabled: boolean; qaOnly: boolean }

export function mergeSkillSettings(features: unknown, settings: SkillSettingsInput): Record<string, unknown> {
  if (features != null && (typeof features !== 'object' || Array.isArray(features))) {
    throw new Error('Invalid stored shop features')
  }
  return {
    ...(features as Record<string, unknown> | null),
    shop_skills_enabled: settings.enabled,
    assistant_qa_only: settings.qaOnly,
  }
}

export function parseSkillSettings(input: unknown): { data: SkillSettingsInput; error?: never } | { error: string; data?: never } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { error: 'Expected enabled and qaOnly booleans' }
  }
  const value = input as Record<string, unknown>
  if (Object.keys(value).length !== 2 || typeof value.enabled !== 'boolean' || typeof value.qaOnly !== 'boolean') {
    return { error: 'Only enabled and qaOnly boolean fields are accepted' }
  }
  return { data: { enabled: value.enabled, qaOnly: value.qaOnly } }
}
