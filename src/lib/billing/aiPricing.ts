/**
 * AI provider pricing, USD per 1M tokens. Update here when a provider
 * changes rates — this is the single source of truth for the admin
 * Margin Dashboard's cost estimates.
 *
 * Verified via web search at implementation time (July 2026), since
 * these are all models released after the assistant's training cutoff:
 * - Gemini 3.8 Flash (Oct 2026): introductory $0.75 / $3.75 until
 *   2026-12-31, then $1.50 / $7.50. Thinking tokens bill as output; cached
 *   input bills at 0.1x.
 * - Claude Sonnet 5: introductory $2 / $10 through 2026-08-31, then
 *   standard $3 / $15. Cache reads are billed at 0.1x the input rate,
 *   cache writes at 1.25x the input rate (Anthropic's standard model).
 * - GPT-5.6 Luna: $0.20 / $1.20 (input / output) after the July 30, 2026 cut
 *   (was $1 / $6).
 */

export type AiProviderName = 'gemini' | 'claude' | 'openai'

/** Approximate — the admin Margin Dashboard displays cost in THB since plans are priced in THB. Adjust as the rate moves. */
export const THB_PER_USD = 35

const CLAUDE_STANDARD_PRICING_STARTS_AT = new Date('2026-09-01T00:00:00Z')
const GEMINI_STANDARD_PRICING_STARTS_AT = new Date('2027-01-01T00:00:00Z')

function geminiBaseRates() {
  return new Date() < GEMINI_STANDARD_PRICING_STARTS_AT
    ? { input: 0.75, output: 3.75 }
    : { input: 1.5, output: 7.5 }
}

function claudeBaseRates() {
  const isIntroPeriod = new Date() < CLAUDE_STANDARD_PRICING_STARTS_AT
  return isIntroPeriod
    ? { input: 2, output: 10 }
    : { input: 3, output: 15 }
}

export const AI_PRICING_USD_PER_1M = {
  get gemini() {
    return geminiBaseRates()
  },
  get claude() {
    return claudeBaseRates()
  },
  openai: { input: 0.2, output: 1.2 },
}

const CLAUDE_CACHE_READ_MULTIPLIER = 0.1
const CLAUDE_CACHE_WRITE_MULTIPLIER = 1.25

export interface ProviderUsageTotals {
  promptTokens: number
  completionTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

/** Estimated USD cost for a bucket of usage on one provider. */
export function estimateCostUsd(provider: AiProviderName, usage: ProviderUsageTotals): number {
  const rates = provider === 'claude' ? claudeBaseRates() : provider === 'gemini' ? geminiBaseRates() : AI_PRICING_USD_PER_1M[provider]

  const outputCost = (usage.completionTokens / 1_000_000) * rates.output

  if (provider === 'claude') {
    const cacheReadTokens = usage.cacheReadTokens || 0
    const cacheWriteTokens = usage.cacheWriteTokens || 0
    // promptTokens here represents the non-cached portion of the input
    const uncachedInputTokens = Math.max(0, usage.promptTokens - cacheReadTokens - cacheWriteTokens)
    const uncachedCost = (uncachedInputTokens / 1_000_000) * rates.input
    const cacheReadCost = (cacheReadTokens / 1_000_000) * rates.input * CLAUDE_CACHE_READ_MULTIPLIER
    const cacheWriteCost = (cacheWriteTokens / 1_000_000) * rates.input * CLAUDE_CACHE_WRITE_MULTIPLIER
    return uncachedCost + cacheReadCost + cacheWriteCost + outputCost
  }

  // Gemini reports cached tokens inside promptTokens; they bill at 0.1x
  const cachedTokens = provider === 'gemini' ? Math.min(usage.cacheReadTokens || 0, usage.promptTokens) : 0
  const inputCost = ((usage.promptTokens - cachedTokens) / 1_000_000) * rates.input +
    (cachedTokens / 1_000_000) * rates.input * 0.1
  return inputCost + outputCost
}
