/**
 * Pure helpers that guard FAQ auto-synthesis (src/lib/ai/faqSynthesis.ts).
 * No I/O here so each rule can be unit-tested on its own.
 */

export interface RawChatMessage {
  sender_type: string | null
  message: string | null
}

export interface SynthesisTurn {
  role: 'customer' | 'admin'
  text: string
}

/**
 * Keep only the speakers whose words may become knowledge:
 *  - 'user'            → customer (the question)
 *  - 'agent' / 'human' → a real admin (the answer)
 * Everything else — 'bot', 'system', unknown — is dropped, so the bot's own (possibly
 * wrong) replies can never be learned back as FAQ.
 */
export function selectSynthesisTurns(messages: RawChatMessage[]): SynthesisTurn[] {
  const turns: SynthesisTurn[] = []
  for (const m of messages) {
    const text = (m.message ?? '').trim()
    if (!text) continue
    if (m.sender_type === 'user') turns.push({ role: 'customer', text })
    else if (m.sender_type === 'agent' || m.sender_type === 'human') turns.push({ role: 'admin', text })
  }
  return turns
}
