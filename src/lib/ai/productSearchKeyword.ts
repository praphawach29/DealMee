// Turns a model's search_products keyword into a name filter. Broad words such as
// "สินค้า", "บริการ" or "อะไรบ้าง" mean "list the catalog", so they are removed;
// an empty result means no filter. Kept free of imports so tests can load it.

const GENERIC_PRODUCT_SEARCH_WORDS = [
  'สินค้า',
  'รายการสินค้า',
  'สินค้าทั้งหมด',
  'ทั้งหมด',
  'ทุกอย่าง',
  'อะไรบ้าง',
  'มีอะไร',
  'ของขาย',
  'ของ',
  // Service and package shops: "มีบริการอะไรบ้าง" must list the catalog, not
  // search product names for the word "บริการ" and find nothing.
  'บริการ',
  'แพ็กเกจ',
  'แพ็คเกจ',
  'แพคเกจ',
  'products',
  'product',
  'services',
  'service',
  'packages',
  'package',
  'all',
]

export function normalizeProductSearchKeyword(rawKeyword: unknown): string {
  if (typeof rawKeyword !== 'string') return ''

  let keyword = rawKeyword
    .toLowerCase()
    .replace(/["'`“”‘’!?？,，.。:;()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  for (const word of [...GENERIC_PRODUCT_SEARCH_WORDS].sort((a, b) => b.length - a.length)) {
    keyword = keyword.replaceAll(word, ' ')
  }

  keyword = keyword
    .replace(/\b(please|show|list|what|do|you|have)\b/g, ' ')
    .replace(/(ครับ|ค่ะ|คะ|จ้า|หน่อย|ขอ|ช่วย|แนะนำ|ดู|ให้|มี)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return keyword.length >= 2 ? keyword : ''
}
