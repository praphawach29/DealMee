export interface CatalogFact {
  id: string
  name: string
  price: number
  stock: number
}

export interface CatalogSnapshot {
  shopId: string
  products: CatalogFact[]
}

function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maximum && !/[\p{Cc}\p{Cf}<>]/u.test(value)
}

export function validateCatalogSnapshot(value: unknown, shopId: string): CatalogSnapshot {
  if (!shopId.trim() || !value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid catalog evidence')
  const record = value as Record<string, unknown>
  if (record.shopId !== shopId || !Array.isArray(record.products) || record.products.length > 5) throw new Error('Invalid catalog evidence')
  const ids = new Set<string>()
  const products = record.products.map((entry: unknown): CatalogFact => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Invalid catalog evidence')
    const product = entry as Record<string, unknown>
    if (!boundedText(product.id, 160) || !boundedText(product.name, 160) || ids.has(product.id)) throw new Error('Invalid catalog evidence')
    if (typeof product.price !== 'number' || !Number.isFinite(product.price) || product.price < 0 || product.price > 1_000_000_000 || Math.abs(product.price * 100 - Math.round(product.price * 100)) > 0.000001) throw new Error('Invalid catalog evidence')
    if (typeof product.stock !== 'number' || !Number.isSafeInteger(product.stock) || product.stock < 0) throw new Error('Invalid catalog evidence')
    ids.add(product.id)
    return { id: product.id, name: product.name.trim(), price: product.price, stock: product.stock }
  })
  return { shopId, products }
}
