import type { SupabaseClient } from '@supabase/supabase-js'
import {
  assertGapShop,
  gapInsert,
  planGapWrite,
  questionKey,
  type GapExisting,
  type GroundingReason,
} from '@/lib/ai/grounding'
import { isMissingKnowledgeSchema } from './hybrid'

/**
 * Records a customer question the bot could not answer from shop data.
 * A missing table (migration not applied yet) is ignored so replies still send.
 * The same open question for a shop increments ask_count instead of adding a row.
 */
export async function recordKnowledgeGap(
  supabase: SupabaseClient,
  input: {
    shopId: string
    conversationId?: string | null
    question: string
    reason: GroundingReason
  }
): Promise<void> {
  try {
    const shopId = assertGapShop(input.shopId)
    const question = input.question.trim()
    if (!question) return
    const key = questionKey(question)
    const { data, error } = await supabase
      .from('knowledge_gaps')
      .select('id, status, ask_count')
      .eq('shop_id', shopId)
      .eq('question_key', key)
      .maybeSingle()
    if (error) {
      if (!isMissingKnowledgeSchema(error)) console.error('[knowledge-gap] read failed:', error.message)
      return
    }
    const plan = planGapWrite((data as GapExisting | null) || null)
    if (plan.action === 'insert') {
      const row = gapInsert(shopId, question, input.reason)
      const { error: insertError } = await supabase.from('knowledge_gaps').insert({
        ...row,
        conversation_id: input.conversationId || null,
      })
      if (insertError && !isMissingKnowledgeSchema(insertError)) {
        console.error('[knowledge-gap] insert failed:', insertError.message)
      }
      return
    }
    const { error: updateError } = await supabase
      .from('knowledge_gaps')
      .update({
        status: 'open',
        ask_count: plan.askCount,
        reason: input.reason,
        last_asked_at: new Date().toISOString(),
        conversation_id: input.conversationId || null,
      })
      .eq('id', plan.id)
      .eq('shop_id', shopId)
    if (updateError && !isMissingKnowledgeSchema(updateError)) {
      console.error('[knowledge-gap] update failed:', updateError.message)
    }
  } catch (err) {
    console.error('[knowledge-gap]', err instanceof Error ? err.message : err)
  }
}
