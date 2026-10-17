import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-side pricing for the sales bot. Totals, QR amounts and quotation lines
 * are computed here from the shop's own catalog and shipping settings, never
 * taken from the model's arguments: a mis-added total or a customer talking the
 * model into a discount would otherwise become a real order and a real QR.
 */

export interface CatalogProduct {
  id: string
  name: string
  price: number
  stock: number | null
}

export type ProductResolution =
  | { status: 'found'; product: CatalogProduct }
  | { status: 'not_found' }
  | { status: 'ambiguous'; candidates: string[] }

function escapeLike(text: string) {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`)
}

function toProduct(row: any): CatalogProduct {
  const stock = row.stock === null || row.stock === undefined ? null : Number(row.stock)
  return { id: row.id, name: row.name, price: Number(row.price) || 0, stock }
}

/** Finds the single catalog product the model meant by `rawName`, or says why it can't. */
export async function resolveCatalogProduct(
  supabase: SupabaseClient,
  shopId: string,
  rawName: string
): Promise<ProductResolution> {
  const name = (rawName || '').trim()
  if (!name) return { status: 'not_found' }

  // 1. Exact name (case-insensitive)
  const { data: exact } = await supabase
    .from('products')
    .select('id, name, price, stock')
    .eq('shop_id', shopId)
    .ilike('name', escapeLike(name))
    .limit(2)
  if (exact && exact.length === 1) return { status: 'found', product: toProduct(exact[0]) }

  // 2. Catalog name inside the model's text, e.g. "Runner Pro สีดำ ไซส์ 42" → "Runner Pro".
  //    The longest such name wins only when it is unique.
  const { data: all } = await supabase
    .from('products')
    .select('id, name, price, stock')
    .eq('shop_id', shopId)
    .limit(500)
  const rows = all || []
  const lower = name.toLowerCase()
  const contained = rows.filter((p: any) => p.name && lower.includes(String(p.name).toLowerCase()))
  if (contained.length > 0) {
    const longest = Math.max(...contained.map((p: any) => String(p.name).length))
    const best = contained.filter((p: any) => String(p.name).length === longest)
    if (best.length === 1) return { status: 'found', product: toProduct(best[0]) }
    return { status: 'ambiguous', candidates: best.map((p: any) => p.name).slice(0, 5) }
  }

  // 3. The model's text inside a catalog name, e.g. "Runner" → "Runner Pro"
  const partial = rows.filter((p: any) => p.name && String(p.name).toLowerCase().includes(lower))
  if (partial.length === 1) return { status: 'found', product: toProduct(partial[0]) }
  if (partial.length > 1) return { status: 'ambiguous', candidates: partial.map((p: any) => p.name).slice(0, 5) }

  return { status: 'not_found' }
}

export function describeUnresolved(rawName: string, res: ProductResolution): string {
  if (res.status === 'ambiguous') {
    return `ชื่อสินค้า "${rawName}" ตรงกับหลายรายการ (${res.candidates.join(', ')}) ให้ถามลูกค้าว่าหมายถึงรายการไหน แล้วใช้ชื่อตามระบบเป๊ะๆ`
  }
  return `ไม่พบสินค้า "${rawName}" ในระบบของร้าน ให้ใช้ search_products หาชื่อสินค้าที่ถูกต้องก่อน ห้ามเดาราคาเอง`
}

/** Parses a quantity the model sent as text ("2", "2 ชิ้น"); null when unusable. */
export function parseQuantity(raw: unknown, max = 999): number | null {
  const match = String(raw ?? '').match(/\d+/)
  if (!match) return null
  const qty = parseInt(match[0], 10)
  return qty >= 1 && qty <= max ? qty : null
}

export function detectThaiShippingZone(address: string): 'bkk' | 'remote' | 'upcountry' {
  const addr = address.toLowerCase()

  // 1. Remote areas, Islands, Southern Border Provinces (พื้นที่ห่างไกล / เกาะ / 3 จังหวัดชายแดน)
  const remoteKeywords = [
    'ยะลา', 'ปัตตานี', 'นราธิวาส', 'แม่ฮ่องสอน', 'เกาะ', 'samui', 'phangan', 'tao', 'chang', 'lanta', 'lipe',
    'อุ้มผาง', 'ท่าสองยาง', 'เวียงแก่น', 'เฉลิมพระเกียรติ', 'บ่อเกลือ', 'ปาย', 'ปางมะผ้า', 'ขุนยวม', 'แม่สะเรียง',
    '95000', '95110', '95120', '95130', '95140', '95150',
    '94000', '94110', '94120', '94130', '94140', '94150',
    '96000', '96110', '96120', '96130', '96140', '96150',
    '58000', '58110', '58120', '58130', '84280', '84320', '84330'
  ]

  // 2. Bangkok & Vicinity (กทม. และ 5 จังหวัดปริมณฑล)
  const bkkKeywords = [
    'กรุงเทพ', 'กทม', 'bangkok', 'นนทบุรี', 'ปทุมธานี', 'สมุทรปราการ', 'สมุทรสาคร', 'นครปฐม',
    '10100', '10110', '10120', '10140', '10150', '10160', '10170', '10200', '10210', '10220', '10230', '10240', '10250', '10260', '10270', '10280', '10290', '10300', '10310', '10320', '10330', '10400', '10500', '10510', '10520', '10530', '10540', '10560', '10600', '10700', '10800', '10900',
    '11000', '11110', '11120', '11130', '11140', '11150',
    '12000', '12110', '12120', '12130', '12140', '12150', '12160', '12170',
    '73000', '73110', '73120', '74000', '74110', '74120'
  ]

  if (remoteKeywords.some((k) => addr.includes(k))) {
    return 'remote'
  }
  if (bkkKeywords.some((k) => addr.includes(k))) {
    return 'bkk'
  }
  return 'upcountry'
}

/** Shipping fee from the shop's own settings, with its free-shipping threshold applied. */
export function computeShippingFee(shop: Record<string, any>, address: string, subtotal: number) {
  const feeType = shop.shipping_fee_type || 'flat'
  let rate = Number(shop.shipping_fee_amount ?? 40)
  let zoneName = 'ทั่วไป'

  if (feeType === 'free') {
    rate = 0
  } else if (feeType === 'zone') {
    const zone = detectThaiShippingZone(address)
    if (zone === 'bkk') {
      rate = Number(shop.shipping_zone_bkk ?? 40)
      zoneName = 'กทม. และปริมณฑล'
    } else if (zone === 'remote') {
      rate = Number(shop.shipping_zone_remote ?? 100)
      zoneName = 'พื้นที่ห่างไกล / เกาะ'
    } else {
      rate = Number(shop.shipping_zone_upcountry ?? 60)
      zoneName = 'ต่างจังหวัด'
    }
  }

  const freeThreshold = Number(shop.free_shipping_threshold || 0)
  if (freeThreshold > 0 && subtotal >= freeThreshold) rate = 0

  return { fee: Math.max(0, rate || 0), zoneName, freeThreshold }
}
