/**
 * Broad offer questions often use different words from the shop's knowledge
 * articles (for example, "มีสินค้าไหม" vs. "แพ็กเกจราคา"). Add retrieval
 * anchors for info-only shops so their catalog-like knowledge is surfaced.
 */
export function buildKnowledgeQuery(
  question: string,
  options: { catalogEmpty?: boolean } = {},
): string {
  const query = String(question || '').trim()
  if (!query || !options.catalogEmpty) return query

  const asksAboutOffer =
    /สินค้า|บริการ|แพ็กเกจ|แพ็คเกจ|ราคา|ค่าใช้จ่าย|ขายอะไร|มีอะไร|รายการ/i.test(query)
  if (!asksAboutOffer) return query

  return `${query}\nสินค้า บริการ แพ็กเกจ ราคา ค่าใช้จ่าย วิธีเริ่มใช้งาน`
}
