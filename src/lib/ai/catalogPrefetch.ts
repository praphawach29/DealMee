import { isGreetingOnlyMessage } from './handoffGuard'
import { validateCatalogSnapshot, type CatalogSnapshot } from './catalogSnapshot'

export type CatalogReadTool = 'search_products' | 'check_stock'

/**
 * The real catalog search is a plain `ilike '%keyword%'` against the product
 * name, so a keyword longer than the name (the whole customer sentence) never
 * matches. Strips only unambiguous trailing price/stock question phrases —
 * never a bare "ไหม", since that's also part of real product names like
 * "ผ้าพันคอไหม" (silk scarf). Leading filler words ("แล้ว", "มี") are not
 * stripped; this is a narrower, verified fix, not a full query rewrite.
 */
const TRAILING_QUESTION_SUFFIXES = [
  /\s*ราคา\s*เท่าไหร่\s*(?:คะ|ครับ|ค่ะ)?[?？!.]*$/u,
  /\s*เท่าไหร่\s*(?:คะ|ครับ|ค่ะ)?[?？!.]*$/u,
  /\s*เหลือ\s*กี่\s*(?:ชิ้น|ตัว|อัน|ขวด|ถุง|หลอด|กล่อง)?\s*(?:คะ|ครับ|ค่ะ)?[?？!.]*$/u,
  /\s*กี่\s*บาท\s*(?:คะ|ครับ|ค่ะ)?[?？!.]*$/u,
  /\s*(?:คะ|ครับ|ค่ะ)[?？!.]*$/u,
]

export function extractSearchKeyword(query: string): string {
  const trimmed = query.trim()
  for (const suffix of TRAILING_QUESTION_SUFFIXES) {
    const stripped = trimmed.replace(suffix, '').trim()
    if (stripped && stripped !== trimmed) return stripped
  }
  return trimmed
}

export interface CatalogPrefetchCall {
  name: CatalogReadTool
  args: Record<string, unknown>
  result: string
  snapshot?: CatalogSnapshot
}

export async function prefetchCatalog(input: {
  shopId: string
  query: string
  allowedTools: readonly string[]
  execute: (name: CatalogReadTool, args: Record<string, unknown>, scope: { shopId: string }) => Promise<{ resultForAi: string; catalogSnapshot?: unknown }>
}): Promise<CatalogPrefetchCall[]> {
  if (!input.shopId.trim()) throw new Error('Catalog prefetch requires a shop identity')
  const query = input.query.trim()
  if (!query || isGreetingOnlyMessage(query)) return []
  if (query.length > 2000) throw new Error('Catalog prefetch query exceeds the supported limit')
  const calls: CatalogPrefetchCall[] = []
  const broad = /^(?:มี|ขอดู|ดู|แสดง)?\s*(?:สินค้า|รายการสินค้า|สินค้าทั้งหมด|products)(?:\s*(?:อะไรบ้าง|บ้าง|ทั้งหมด))?\s*(?:ครับ|ค่ะ|คะ)?[?？!]*$/iu.test(query)
  const names: CatalogReadTool[] = ['search_products', 'check_stock']
  for (const name of names) {
    if (!input.allowedTools.includes(name)) continue
    if (broad && name === 'check_stock') continue
    const args = name === 'search_products' ? { keyword: broad ? '' : extractSearchKeyword(query), limit: 5 } : { product_name: extractSearchKeyword(query) }
    let result: string
    let snapshot: CatalogSnapshot | undefined
    try {
      const response = await input.execute(name, args, { shopId: input.shopId })
      if (typeof response.resultForAi !== 'string' || !response.resultForAi.trim() || response.resultForAi.length > 12000) {
        throw new Error('Invalid catalog result')
      }
      result = response.resultForAi
      if (response.catalogSnapshot !== undefined) snapshot = validateCatalogSnapshot(response.catalogSnapshot, input.shopId)
    } catch {
      throw new Error(`Catalog prefetch failed at ${name}; no model answer should be generated`)
    }
    calls.push({ name, args, result, ...(snapshot ? { snapshot } : {}) })
  }
  return calls
}
