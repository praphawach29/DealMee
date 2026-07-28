/**
 * AI provider pricing, USD per 1M tokens. Update here when a provider
 * changes rates — this is the single source of truth for the admin
 * Margin Dashboard's cost estimates.
 *
 * Verified via web search at implementation time (July 2026), since
 * these are all models released after the assistant's training cutoff:
 * - Gemini 3.6 Flash: $1.50 / $7.50 (input / output)
 * - Claude Sonnet 5: introductory $2 / $10 through 2026-08-31, then
 *   standard $3 / $15. Cache reads are billed at 0.1x the input rate,
 *   cache writes at 1.25x the input rate (Anthropic's standard model).
 * - GPT-5.6 Luna: $1 / $6 (input / output) — configured as the final
 *   fallback provider but not currently reachable by the routing logic.
 */

export type AiProviderName = 'gemini' | 'claude' | 'openai'

/** Approximate — the admin Margin Dashboard displays cost in THB since plans are priced in THB. Adjust as the rate moves. */
export const THB_PER_USD = 35

const CLAUDE_STANDARD_PRICING_STARTS_AT = new Date('2026-09-01T00:00:00Z')

function claudeBaseRates() {
  const isIntroPeriod = new Date() < CLAUDE_STANDARD_PRICING_STARTS_AT
  return isIntroPeriod
    ? { input: 2, output: 10 }
    : { input: 3, output: 15 }
}

export const AI_PRICING_USD_PER_1M = {
  gemini: { input: 1.5, output: 7.5 },
  get claude() {
    return claudeBaseRates()
  },
  openai: { input: 1, output: 6 },
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
  const rates = provider === 'claude' ? claudeBaseRates() : AI_PRICING_USD_PER_1M[provider]

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

  const inputCost = (usage.promptTokens / 1_000_000) * rates.input
  return inputCost + outputCost
}
