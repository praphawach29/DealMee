/**
 * Catalog rows that become a product card. LINE renders these as a Flex
 * carousel and Facebook/Instagram as a Messenger carousel. Both channels
 * share this selection so a reply never sends two carousels.
 */
export interface ProductCard {
  id: string
  name: string
  price: number
  stock?: number | null
  description?: string | null
  image_url?: string | null
  category?: string | null
}

/** LINE and Messenger both cap a carousel at 10 bubbles. */
export const PRODUCT_CAROUSEL_LIMIT = 10

const KEYWORD_PRODUCT_QUERY =
  /(มี|ขอ|ดู|ค้นหา|แนะนำ|ซื้อ|สั่ง|ขาย)\s*(เสื้อ|กางเกง|กระเป๋า|รองเท้า|หมวก|เคส|ผ้าพันคอ|กระบอกน้ำ|สินค้า|แคตตาล็อก)/i
const KEYWORD_PRODUCT_QUERY_LOOSE =
  /(มี.*ไหม|มี.*มั้ย|ขอดู.*หน่อย|ราคาเท่าไหร่|มีแบบไหนบ้าง)/i
const CATALOG_WIDE_QUERY = /(สินค้าทั้งหมด|มีอะไรบ้าง|มีอะไรขายบ้าง|ขอดูสินค้า|แนะนำสินค้า)/i
const DOCUMENT_TURN = /(ใบเสนอราคา|เสนอราคา|quotation|หนังสือราชการ|บันทึกข้อความ|เอกสารทางการ)/i

export function toProductCard(row: unknown): ProductCard | null {
  if (!row || typeof row !== 'object') return null
  const record = row as Record<string, unknown>
  const name = String(record.name || '').trim()
  if (!name) return null
  const stockRaw = record.stock
  const stock =
    stockRaw === null || stockRaw === undefined || stockRaw === ''
      ? null
      : Number(stockRaw)
  return {
    id: String(record.id || '').trim(),
    name,
    price: Number(record.price || 0),
    stock: Number.isFinite(stock) ? stock : null,
    description: record.description == null ? null : String(record.description),
    image_url: record.image_url == null ? null : String(record.image_url),
    category: record.category == null ? null : String(record.category),
  }
}

export function toProductCards(rows: unknown[] | null | undefined): ProductCard[] {
  if (!rows || rows.length === 0) return []
  const cards: ProductCard[] = []
  for (const row of rows) {
    const card = toProductCard(row)
    if (card) cards.push(card)
  }
  return cards
}

function cardKey(card: ProductCard): string {
  return card.id ? `id:${card.id}` : `name:${card.name.toLowerCase()}`
}

/**
 * Joins cards from every tool in one turn (search, then a stock check of one
 * of those products) and drops a second copy of the same catalog row.
 */
export function mergeProductCards(
  current: unknown[] | null | undefined,
  incoming: unknown[] | null | undefined
): ProductCard[] {
  const merged: ProductCard[] = []
  const seen = new Set<string>()
  for (const row of [...(current || []), ...(incoming || [])]) {
    const card = toProductCard(row)
    if (!card) continue
    const key = cardKey(card)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(card)
    if (merged.length >= PRODUCT_CAROUSEL_LIMIT) break
  }
  return merged
}

export function isKeywordProductQuery(userText: string | null | undefined): boolean {
  const raw = String(userText || '').toLowerCase().trim()
  if (!raw) return false
  return KEYWORD_PRODUCT_QUERY.test(raw) || KEYWORD_PRODUCT_QUERY_LOOSE.test(raw)
}

/**
 * The fallback used when the model did not return catalog rows: match the
 * customer's words against the shop's products, or the first five when they
 * asked for the whole catalog. Unchanged from the webhook heuristic.
 */
export function selectKeywordCarouselProducts(
  userText: string | null | undefined,
  catalog: unknown[] | null | undefined
): ProductCard[] {
  if (!isKeywordProductQuery(userText)) return []
  const raw = String(userText || '').toLowerCase().trim()
  const cards = toProductCards(catalog)
  const matched = cards.filter((product) => {
    const name = product.name.toLowerCase()
    const category = (product.category || '').toLowerCase()
    return (
      raw.includes(name) ||
      (category && raw.includes(category)) ||
      name.split(' ').some((word) => word.length >= 2 && raw.includes(word))
    )
  })
  if (matched.length > 0) return matched.slice(0, PRODUCT_CAROUSEL_LIMIT)
  if (CATALOG_WIDE_QUERY.test(raw)) return cards.slice(0, 5)
  return []
}

export function isProductCardSuppressed(userText: string | null | undefined, toolNames: string[]): boolean {
  if (DOCUMENT_TURN.test(String(userText || ''))) return true
  return toolNames.some((name) => name === 'create_quotation' || name === 'create_official_letter')
}

/**
 * One carousel per reply. Tool rows win. The keyword fallback runs only when
 * the tools returned nothing, so a search result is never concatenated with
 * a second keyword match of the same catalog.
 */
export function resolveChannelProductCards(input: {
  suppress: boolean
  toolProducts?: unknown[] | null
  userText?: string | null
  catalogProducts?: unknown[] | null
}): ProductCard[] {
  if (input.suppress) return []
  const fromTool = mergeProductCards([], input.toolProducts)
  if (fromTool.length > 0) return fromTool
  return selectKeywordCarouselProducts(input.userText, input.catalogProducts)
}
