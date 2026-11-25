/**
 * Answers a burst of customer messages once, instead of once per message.
 *
 * Seen live (CheckMee, 24 Nov 2026): a customer sent "จะขึ้นแจ้งเตือนมั้ยคะ" and,
 * four seconds later, "หรือว่าต้องกดเข้าไปดูเท่านั้น". Each webhook call answered
 * its own message, so the customer got two replies that did not quite agree.
 *
 * Each text message now waits BATCH_WAIT_MS after it is saved. If a newer
 * customer message has arrived by then, this one stays silent: the newer one
 * answers for both. The newest message answers every customer message since the
 * bot (or an admin) last spoke, limited to BATCH_MAX_SPAN_MS so messages left
 * unanswered during an admin pause are not dragged into a fresh reply.
 *
 * Dependency-free so tests/ can import it directly.
 */

/** How long a message waits for the customer to keep typing. */
export const BATCH_WAIT_MS = 4000

/** Oldest message, relative to the newest, that can join the same reply. */
export const BATCH_MAX_SPAN_MS = 2 * 60 * 1000

export interface BatchMessage {
  id: string
  sender_type: string
  message: string | null
  created_at: string
}

export interface PendingTurn {
  /** The newest customer message; only its webhook call should answer. */
  latestId: string
  /** Customer texts to answer together, oldest first. */
  texts: string[]
}

/**
 * The customer messages still waiting for an answer, from messages ordered
 * oldest first. Null when the newest message is not the customer's.
 */
export function pendingCustomerTurn(messages: BatchMessage[]): PendingTurn | null {
  const latest = messages[messages.length - 1]
  if (!latest || latest.sender_type !== 'user') return null
  const newestAt = Date.parse(latest.created_at)
  const texts: string[] = []
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.sender_type !== 'user') break
    if (Number.isFinite(newestAt) && newestAt - Date.parse(msg.created_at) > BATCH_MAX_SPAN_MS) break
    const text = (msg.message || '').trim()
    // Commands (/ai, /admin-link) and image placeholders are handled on their own
    if (!text || text.startsWith('/') || /^\[รูปภาพ\]$/.test(text)) continue
    texts.unshift(text)
  }
  return { latestId: latest.id, texts }
}

/** One query for the model from a burst of customer messages. */
export function mergeCustomerTexts(texts: string[]): string {
  return texts.join('\n')
}

/**
 * Indexes of text events that a later text event from the same customer in the
 * same webhook delivery will answer for. LINE can put several messages in one
 * delivery, and they are handled one after another, so the database check
 * alone would not see the later ones yet.
 */
export function supersededTextEvents(events: Array<{ type?: string; message?: { type?: string; text?: string }; source?: { userId?: string } }>): Set<number> {
  const lastByUser = new Map<string, number>()
  events.forEach((event, index) => {
    const userId = event.source?.userId
    // A command (/ai, /admin-link) never reaches the AI, so it cannot answer for earlier messages
    const isCommand = (event.message?.text || '').trim().startsWith('/')
    if (userId && event.type === 'message' && event.message?.type === 'text' && !isCommand) lastByUser.set(userId, index)
  })
  const superseded = new Set<number>()
  events.forEach((event, index) => {
    const userId = event.source?.userId
    if (!userId || event.type !== 'message' || event.message?.type !== 'text') return
    const last = lastByUser.get(userId)
    if (last !== undefined && index < last) superseded.add(index)
  })
  return superseded
}
