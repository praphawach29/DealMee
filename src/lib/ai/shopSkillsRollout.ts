export function shopSkillsTelemetryEnabled(features?: Record<string, unknown> | null): boolean {
  return (
    process.env.SHOP_SKILLS_TELEMETRY_ENABLED === 'true' &&
    features?.shop_skills_enabled === true
  )
}

export function shopSkillsRetrievalEnabled(features?: Record<string, unknown> | null): boolean {
  return (
    process.env.SHOP_SKILLS_RETRIEVAL_ENABLED !== 'false' &&
    features?.shop_skills_enabled === true
  )
}
