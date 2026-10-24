/**
 * Picks which knowledge-base entries ride along in the system prompt for one
 * customer message. Every AI call re-sends the prompt, so inlining a whole
 * imported FAQ/website (tens of thousands of characters) on every message was
 * the largest single cost per reply. Now only the entries most related to what
 * the customer is talking about are inlined; the rest stay reachable through
 * the search_knowledge_base tool.
 *
 * Thai has no spaces between words, so relevance is measured with character
 * bigrams rather than words.
 */

export const KNOWLEDGE_RELEVANT_MAX_CHARS = 6000

const PARTICLES = [
  'นะคะ', 'นะครับ', 'ครับ', 'ค่ะ', 'คะ', 'จ้า', 'จ้ะ', 'หน่อย', 'ไหม', 'มั้ย', 'บ้าง', 'ด้วย', 'เลย',
  'ยังไง', 'อย่างไร', 'เท่าไหร่', 'เท่าไร', 'สอบถาม', 'อยากทราบ', 'รบกวน', 'ขอ', 'ได้',
]

function bigrams(text: string): Set<string> {
  let t = (text || '').toLowerCase()
  for (const p of PARTICLES) t = t.split(p).join(' ')
  t = t.replace(/[\s.,!?()"'“”:;\-–—/\\[\]{}]+/g, ' ')
  const out = new Set<string>()
  for (const word of t.split(' ')) {
    for (let i = 0; i + 1 < word.length; i++) out.add(word.slice(i, i + 2))
  }
  return out
}

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0
  for (const g of a) if (b.has(g)) n++
  return n
}

export interface KnowledgeItem {
  title: string | null
  content: string | null
  id?: string | null
  source?: string | null
  source_ref?: string | null
}

/**
 * Legacy in-memory selector, used only when the chunk tables are not installed
 * or this shop has not been backfilled yet. Live answers go through hybrid
 * retrieval in src/lib/knowledge/retrieve.ts.
 *
 * `inline` keeps the old prompt behaviour (a small base is sent whole, and a
 * message that matches nothing still gets a little shop context). `search`
 * returns only positive matches, so the tool can say "nothing found" instead
 * of handing the model an unrelated FAQ.
 */
export function selectRelevantKnowledge(
  items: KnowledgeItem[],
  currentMessage: string,
  recentMessages: string[] = [],
  maxChars = KNOWLEDGE_RELEVANT_MAX_CHARS,
  mode: 'inline' | 'search' = 'inline',
  maxItems = Number.POSITIVE_INFINITY
): { blocks: string[]; omitted: number; indexes: number[] } {
  const blocks = items.map((it) => `Q: ${it.title || ''}\nA: ${it.content || ''}`)
  const total = blocks.reduce((sum, b) => sum + b.length, 0)
  if (mode === 'inline' && total <= maxChars) {
    const indexes = items.map((_, index) => index).slice(0, maxItems)
    return { blocks: indexes.map((index) => blocks[index]), omitted: items.length - indexes.length, indexes }
  }

  const current = bigrams(currentMessage)
  const recent = bigrams(recentMessages.slice(-4).join(' '))

  const scored = items.map((it, index) => {
    const title = bigrams(it.title || '')
    const head = bigrams((it.content || '').slice(0, 400))
    const score =
      overlap(current, title) * 3 + overlap(current, head) +
      overlap(recent, title) * 1.5 + overlap(recent, head) * 0.5
    return { index, score }
  })
  scored.sort((a, b) => b.score - a.score || a.index - b.index)

  const chosen: number[] = []
  let budget = maxChars
  for (const { index, score } of scored) {
    if (score <= 0) break
    const len = blocks[index].length
    if (len > budget) continue
    chosen.push(index)
    budget -= len
  }
  // Nothing related to this message: keep a little general context (the first
  // entries, usually shop basics) instead of an empty knowledge section.
  // Search mode must not do this — an unrelated FAQ is how the bot starts guessing.
  if (chosen.length === 0 && mode === 'inline') {
    let generalBudget = Math.min(2000, maxChars)
    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].length > generalBudget) continue
      chosen.push(i)
      generalBudget -= blocks[i].length
    }
  }

  const limited = chosen.slice(0, maxItems)
  return { blocks: limited.map((i) => blocks[i]), omitted: items.length - limited.length, indexes: limited }
}
