import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Log skill exposures for a conversation turn.
 * Called after retrieveActiveShopSkills returns skills that were used in the prompt.
 */
export async function logSkillExposures({
  shopId,
  conversationId,
  chatMessageId,
  skills,
}: {
  shopId: string
  conversationId: string
  chatMessageId?: string | null
  skills: Array<{ id: string; version: string }>
}): Promise<void> {
  if (!skills || skills.length === 0) return

  try {
    const supabase = createAdminClient()

    // Use RPC for batch insert
    const skillIds = skills.map((s) => s.id)
    const skillVersions = skills.map((s) => s.version)

    const { error } = await supabase.rpc('record_skill_exposure', {
      p_shop_id: shopId,
      p_conversation_id: conversationId,
      p_chat_message_id: chatMessageId || null,
      p_skill_ids: skillIds,
      p_skill_versions: skillVersions,
    })

    if (error) {
      console.warn('[SkillExposure] RPC failed, falling back to direct insert:', error.message)
      // Fallback: direct insert
      const rows = skills.map((s) => ({
        shop_id: shopId,
        conversation_id: conversationId,
        chat_message_id: chatMessageId || null,
        skill_id: s.id,
        skill_version: s.version,
      }))
      await supabase.from('skill_exposures').insert(rows)
    }
  } catch (err) {
    console.error('[SkillExposure] Failed to log exposures:', err)
  }
}

/**
 * Get conversion stats for a shop's skills.
 */
export async function getSkillConversionStats(shopId: string): Promise<any[]> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('skill_conversion_stats')
      .select('*')
      .eq('shop_id', shopId)
      .order('conversion_rate_pct', { ascending: false })

    if (error) {
      console.error('[SkillConversionStats] Query failed:', error.message)
      return []
    }
    return data || []
  } catch (err) {
    console.error('[SkillConversionStats] Exception:', err)
    return []
  }
}
