import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Admin takeover: the bot steps back for an hour whenever a human takes the chat
 * (the customer asks for a person, the AI hands over, or the admin replies from the
 * inbox), then returns on its own.
 *
 * Every pause writes `paused_until`. Rows without it (written before this module)
 * are measured from the admin's last message instead, never from `last_message_at`:
 * the webhooks refresh that on every customer message, so a customer who kept
 * writing kept the bot muted for good (23 Oct 2026).
 */
export const PAUSE_MINUTES = 60

const PAUSE_MS = PAUSE_MINUTES * 60 * 1000

/** Columns that put a conversation into admin-takeover mode for one hour. */
export function adminPausePayload(now = new Date()) {
  return {
    status: 'human' as const,
    ai_mode: 'manual' as const,
    paused_until: new Date(now.getTime() + PAUSE_MS).toISOString(),
  }
}

/** Columns that hand the chat back to the bot. */
export function resumePayload() {
  return { status: 'ai' as const, ai_mode: 'auto' as const, paused_until: null }
}

/** When the admin last wrote in this conversation, or null when they never did. */
async function lastAdminMessageAt(supabase: any, conversationId: string): Promise<Date | null> {
  const { data } = await supabase
    .from('chat_messages')
    .select('created_at')
    .eq('conversation_id', conversationId)
    .in('sender_type', ['agent', 'human'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.created_at ? new Date(data.created_at) : null
}

/**
 * Whether the bot may take a paused conversation back. Only called for
 * conversations already in `human` status.
 */
export async function isPauseExpired(
  supabase: any,
  conv: { id: string; paused_until?: string | null },
  now = new Date()
): Promise<boolean> {
  if (conv.paused_until) return now > new Date(conv.paused_until)
  const lastAdmin = await lastAdminMessageAt(supabase, conv.id)
  return !lastAdmin || now.getTime() - lastAdmin.getTime() > PAUSE_MS
}

/**
 * Hands expired chats back to the bot without waiting for the customer to write
 * again, so the hour is real and the inbox shows the true state. Run from the
 * follow-up cron.
 */
export async function expirePausedConversations(limit = 200): Promise<{ resumed: number; timerSet: number }> {
  const admin = createAdminClient()
  const now = new Date()

  const { data, error } = await admin
    .from('conversations')
    .select('id, paused_until')
    .eq('status', 'human')
    .order('last_message_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[AdminPause] Could not read paused conversations:', error.message)
    return { resumed: 0, timerSet: 0 }
  }

  let resumed = 0
  let timerSet = 0

  for (const conv of data || []) {
    if (await isPauseExpired(admin, conv, now)) {
      const { error: resumeError } = await admin.from('conversations').update(resumePayload()).eq('id', conv.id)
      if (resumeError) {
        console.error(`[AdminPause] Could not resume conversation ${conv.id}:`, resumeError.message)
        continue
      }
      resumed++
      continue
    }

    // Still inside the hour but with no timer stored: give it one so the next pass
    // (and the webhooks) agree on when the bot comes back.
    if (!conv.paused_until) {
      const lastAdmin = await lastAdminMessageAt(admin, conv.id)
      if (!lastAdmin) continue
      await admin
        .from('conversations')
        .update({ paused_until: new Date(lastAdmin.getTime() + PAUSE_MS).toISOString() })
        .eq('id', conv.id)
      timerSet++
    }
  }

  if (resumed || timerSet) {
    console.log(`[AdminPause] Resumed ${resumed} conversation(s), set a timer on ${timerSet}`)
  }
  return { resumed, timerSet }
}
