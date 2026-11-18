import { validateCatalogSnapshot, type CatalogSnapshot } from './catalogSnapshot'

export type LocalReplyReason = 'accepted_catalog_template' | 'unverified_catalog_draft' | 'unexpected_script' | 'empty_draft' | 'missing_catalog_evidence' | 'invalid_catalog_evidence' | 'language_only' | 'truncated_draft'

export interface LocalReplyVerdict {
  text: string
  draftAccepted: boolean
  source: 'model' | 'catalog_template' | 'safe_notice'
  reason: LocalReplyReason
  scope: 'catalog' | 'language_only'
}

function safeNotice(language: 'th' | 'en'): string {
  return language === 'th'
    ? 'ขออภัยค่ะ ข้อมูลคำตอบนี้ยังยืนยันไม่ได้ กรุณาระบุชื่อสินค้าหรือรายละเอียดเพิ่มเติมค่ะ'
    : 'Sorry, I cannot verify this answer yet. Please provide the product name or more details.'
}

function catalogText(snapshot: CatalogSnapshot, language: 'th' | 'en'): string {
  if (!snapshot.products.length) {
    return language === 'th'
      ? 'ยังไม่พบสินค้าที่ตรงกับคำค้นนี้ค่ะ กรุณาระบุชื่อหรือรุ่นเพิ่มเติมค่ะ'
      : 'No matching products were found. Please provide a product name or model.'
  }
  const format = new Intl.NumberFormat(language === 'th' ? 'th-TH' : 'en-US', { maximumFractionDigits: 2 })
  const lines = snapshot.products.map((product) => language === 'th'
    ? `${product.name}: ราคา ${format.format(product.price)} บาท — ${product.stock > 0 ? `คงเหลือ ${format.format(product.stock)} ชิ้น` : 'หมดสต๊อก'}`
    : `${product.name}: THB ${format.format(product.price)} — ${product.stock > 0 ? `${format.format(product.stock)} in stock` : 'out of stock'}`)
  return [language === 'th' ? 'ข้อมูลที่ยืนยันได้จากรายการล่าสุด:' : 'Verified information from the latest results:', ...lines].join('\n')
}

function hasUnexpectedScript(text: string, language: 'th' | 'en', snapshot?: CatalogSnapshot): boolean {
  let remaining = text
  for (const product of snapshot?.products || []) remaining = remaining.replaceAll(product.name, '')
  const permitted = language === 'th' ? /[\p{Script=Thai}\p{Script=Latin}]/u : /\p{Script=Latin}/u
  return [...remaining.matchAll(/\p{L}/gu)].some((match) => !permitted.test(match[0]))
}

export function guardLocalReply(input: {
  draft: string
  language: 'th' | 'en'
  shopId: string
  catalogRequired: boolean
  snapshot?: unknown
  truncated?: boolean
}): LocalReplyVerdict {
  const scope = input.catalogRequired ? 'catalog' : 'language_only'
  const notice = (reason: LocalReplyReason): LocalReplyVerdict => ({ text: safeNotice(input.language), draftAccepted: false, source: 'safe_notice', reason, scope })
  let snapshot: CatalogSnapshot | undefined
  if (input.catalogRequired) {
    if (input.snapshot === undefined) return notice('missing_catalog_evidence')
    try {
      snapshot = validateCatalogSnapshot(input.snapshot, input.shopId)
    } catch {
      return notice('invalid_catalog_evidence')
    }
  }
  const draft = input.draft.trim()
  const reason: LocalReplyReason = input.truncated ? 'truncated_draft'
    : !draft ? 'empty_draft'
      : hasUnexpectedScript(draft, input.language, snapshot) ? 'unexpected_script'
        : snapshot ? 'unverified_catalog_draft' : 'language_only'
  if (snapshot) {
    const verified = catalogText(snapshot, input.language)
    const accepted = !input.truncated && draft === verified
    return { text: verified, draftAccepted: accepted, source: accepted ? 'model' : 'catalog_template', reason: accepted ? 'accepted_catalog_template' : reason, scope }
  }
  if (reason !== 'language_only') return notice(reason)
  return { text: draft, draftAccepted: true, source: 'model', reason, scope }
}
