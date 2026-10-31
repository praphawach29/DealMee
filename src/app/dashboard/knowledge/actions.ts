'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { extractFromUrl, extractUniversalDocument, type ExtractedSource } from '@/lib/knowledge/extract'
import { toKnowledgeEntries, csvToEntriesDirect, markdownToEntriesDirect, type KnowledgeEntry } from '@/lib/knowledge/ingest'
import { embedderForShop } from '@/lib/knowledge/embedAuth'
import { isMissingKnowledgeSchema } from '@/lib/knowledge/hybrid'
import {
  forgetDocument,
  forgetKnowledgeEntry,
  indexImportedKnowledge,
  indexKnowledgeEntry,
  type IndexReport,
  type KnowledgeEntryRow,
} from '@/lib/knowledge/indexKnowledge'
import { PAID_ORDER_STATUSES } from '@/lib/orders/paymentState'

/** Roughly the ceiling on what a shop owner might reasonably upload; larger files are almost always the wrong document. */
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

function indexNote(report: IndexReport | null, err?: unknown): string | null {
  if (err) {
    console.error('[knowledge] index failed:', err instanceof Error ? err.message : err)
    if (isMissingKnowledgeSchema(err)) {
      return 'บันทึกคำถาม-คำตอบแล้ว แต่ยังไม่ได้ติดตั้งตารางชิ้นส่วนความรู้ จึงค้นจากคำถาม-คำตอบแบบเดิม'
    }
    return 'บันทึกคำถาม-คำตอบแล้ว แต่จัดเก็บเนื้อหาเต็มไม่สำเร็จ ระบบจะค้นจากคำถาม-คำตอบไปก่อน'
  }
  if (!report) return null
  if (report.failed > 0) return 'บันทึกเนื้อหาเต็มแล้ว แต่สร้างดัชนีความหมายไม่ครบ จะค้นด้วยคำสำคัญไปก่อน'
  if (report.pending > 0 && report.embedded === 0) return 'บันทึกเนื้อหาเต็มแล้ว ยังไม่มีคีย์ embedding จึงค้นด้วยคำสำคัญไปก่อน'
  return null
}

function withIndexNote(message: string, note: string | null) {
  return note ? `${message} ${note}` : message
}

async function indexRows(supabase: Awaited<ReturnType<typeof createClient>>, shopId: string, entries: KnowledgeEntryRow[]) {
  const { embedder } = await embedderForShop(shopId)
  let note: string | null = null
  for (const entry of entries) {
    const report = await indexKnowledgeEntry({ supabase, shopId, entry, embedder })
    note = indexNote(report) || note
  }
  return note
}

export async function createKnowledgeItem(formData: FormData) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: 'กรุณาเข้าสู่ระบบอีกครั้ง' }
  }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id) {
    return { error: 'ไม่พบข้อมูลร้านค้า' }
  }

  const title = formData.get('title') as string
  const content = formData.get('content') as string
  const category = formData.get('category') as string || 'faq'

  if (!title || !content) {
    return { error: 'กรุณากรอกหัวข้อและรายละเอียดข้อมูล' }
  }

  const { data, error } = await supabase
    .from('knowledge_base')
    .insert({
      shop_id: shop.id,
      title,
      content,
      category,
    })
    .select('id, title, content, status, source, source_ref')
    .single()

  if (error || !data) {
    return { error: `เพิ่มข้อมูลไม่สำเร็จ: ${error?.message || 'ไม่ทราบสาเหตุ'}` }
  }

  let note: string | null = null
  try {
    note = await indexRows(supabase, shop.id, [data])
  } catch (err) {
    note = indexNote(null, err)
  }

  revalidatePath('/dashboard/knowledge')
  revalidatePath('/dashboard')
  return { success: withIndexNote('เพิ่มข้อมูลความรู้เรียบร้อยแล้ว!', note) }
}

/**
 * Shared tail of every import: write the extracted entries, replacing any
 * earlier import from the same source so re-importing an updated price list
 * refreshes it instead of stacking a second, contradictory copy the bot
 * would then have to choose between.
 */
async function saveImportedEntries(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shopId: string,
  entries: KnowledgeEntry[],
  source: string,
  sourceRef: string,
  rawText: string | null = null
) {
  await supabase
    .from('knowledge_base')
    .delete()
    .eq('shop_id', shopId)
    .eq('source', source)
    .eq('source_ref', sourceRef)

  const { data, error } = await supabase.from('knowledge_base').insert(
    entries.map((entry) => ({
      shop_id: shopId,
      title: entry.title,
      content: entry.content,
      category: 'faq',
      source,
      source_ref: sourceRef,
    }))
  ).select('id, title, content, status, source, source_ref')

  if (error || !data) return { error: `บันทึกข้อมูลไม่สำเร็จ: ${error?.message || 'ไม่ทราบสาเหตุ'}` }

  let note: string | null = null
  try {
    const { embedder } = await embedderForShop(shopId)
    const report = await indexImportedKnowledge({
      supabase,
      shopId,
      source,
      sourceRef,
      fullText: rawText,
      entries: data,
      embedder,
    })
    note = indexNote(report)
  } catch (err) {
    note = indexNote(null, err)
  }

  revalidatePath('/dashboard/knowledge')
  revalidatePath('/dashboard')
  return { success: withIndexNote(`เพิ่มข้อมูลจาก ${sourceRef} จำนวน ${entries.length} ข้อเรียบร้อยแล้ว!`, note) }
}

async function resolveShop(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { error: 'กรุณาเข้าสู่ระบบอีกครั้ง' as const }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id) return { error: 'ไม่พบข้อมูลร้านค้า' as const }

  return { shop }
}

export async function importKnowledgeFromUrl(formData: FormData) {
  const supabase = await createClient()
  const resolved = await resolveShop(supabase)
  if ('error' in resolved) return { error: resolved.error }

  const url = String(formData.get('url') || '').trim()
  if (!url) return { error: 'กรุณาใส่ลิงก์เว็บไซต์' }

  try {
    const source = await extractFromUrl(url)
    const entries = await toKnowledgeEntries(source.text, resolved.shop.name || 'ร้านค้า')
    return await saveImportedEntries(supabase, resolved.shop.id, entries, 'url', source.label, source.text)
  } catch (err: any) {
    return { error: err.message || 'ดึงข้อมูลจากลิงก์ไม่สำเร็จ' }
  }
}

export async function importKnowledgeFromFile(formData: FormData) {
  const supabase = await createClient()
  const resolved = await resolveShop(supabase)
  if ('error' in resolved) return { error: resolved.error }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'กรุณาเลือกไฟล์' }
  if (file.size > MAX_UPLOAD_BYTES) return { error: 'ไฟล์ใหญ่เกิน 15 MB กรุณาแบ่งไฟล์ให้เล็กลง' }

  const lowerName = file.name.toLowerCase()
  const isSupported = /\.(pdf|docx?|xlsx?|pptx?|csv|png|jpe?g|webp|md|markdown|txt)$/i.test(lowerName)
  if (!isSupported) {
    return { error: 'รองรับไฟล์ PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), CSV, Markdown (.md, .txt) และรูปภาพ เท่านั้น' }
  }

  let sourceTag = 'document'
  if (lowerName.endsWith('.pdf')) sourceTag = 'pdf'
  else if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) sourceTag = 'docx'
  else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) sourceTag = 'xlsx'
  else if (lowerName.endsWith('.pptx') || lowerName.endsWith('.ppt')) sourceTag = 'pptx'
  else if (lowerName.endsWith('.csv')) sourceTag = 'csv'
  else if (lowerName.endsWith('.md') || lowerName.endsWith('.markdown')) sourceTag = 'markdown'
  else if (lowerName.endsWith('.txt')) sourceTag = 'text'
  else if (/\.(png|jpe?g|webp)$/i.test(lowerName)) sourceTag = 'image'

  try {
    // A spreadsheet already laid out as question/answer columns is taken
    // as-is: exact, free, and it keeps the shop's own wording rather than
    // letting a model paraphrase a policy.
    if (lowerName.endsWith('.csv')) {
      const csvText = await file.text()
      const direct = csvToEntriesDirect(csvText)
      if (direct && direct.length > 0) {
        return await saveImportedEntries(supabase, resolved.shop.id, direct, 'csv', file.name, csvText)
      }
    }

    if (lowerName.endsWith('.md') || lowerName.endsWith('.markdown')) {
      const markdownText = await file.text()
      const direct = markdownToEntriesDirect(markdownText)
      if (direct && direct.length > 0) {
        return await saveImportedEntries(supabase, resolved.shop.id, direct, 'markdown', file.name, markdownText)
      }
    }

    const source: ExtractedSource = await extractUniversalDocument(file)
    const entries = await toKnowledgeEntries(source.text, resolved.shop.name || 'ร้านค้า')
    return await saveImportedEntries(supabase, resolved.shop.id, entries, sourceTag, source.label, source.text)
  } catch (err: any) {
    return { error: err.message || 'อ่านไฟล์ไม่สำเร็จ' }
  }
}

/** Removes every entry that came from one import in a single step, so a stale price list doesn't have to be deleted row by row. */
export async function deleteKnowledgeSource(source: string, sourceRef: string) {
  const supabase = await createClient()
  const resolved = await resolveShop(supabase)
  if ('error' in resolved) return { error: resolved.error }

  try {
    await forgetDocument(supabase, resolved.shop.id, source, sourceRef)
  } catch (err) {
    console.error('[knowledge] document delete failed:', err instanceof Error ? err.message : err)
  }

  const { error } = await supabase
    .from('knowledge_base')
    .delete()
    .eq('shop_id', resolved.shop.id)
    .eq('source', source)
    .eq('source_ref', sourceRef)

  if (error) return { error: `ลบไม่สำเร็จ: ${error.message}` }

  revalidatePath('/dashboard/knowledge')
  revalidatePath('/dashboard')
  return { success: `ลบข้อมูลจาก ${sourceRef} เรียบร้อยแล้ว` }
}

export async function deleteKnowledgeItem(id: string) {
  const supabase = await createClient()
  const resolved = await resolveShop(supabase)
  if ('error' in resolved) return { error: resolved.error }

  try {
    await forgetKnowledgeEntry(supabase, resolved.shop.id, id)
  } catch (err) {
    console.error('[knowledge] chunk delete failed:', err instanceof Error ? err.message : err)
  }

  const { error } = await supabase
    .from('knowledge_base')
    .delete()
    .eq('id', id)
    .eq('shop_id', resolved.shop.id)

  if (error) {
    return { error: `ลบไม่สำเร็จ: ${error.message}` }
  }

  revalidatePath('/dashboard/knowledge')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function approveDraftFaq(id: string) {
  const supabase = await createClient()
  const resolved = await resolveShop(supabase)
  if ('error' in resolved) return { error: resolved.error }

  const { data, error } = await supabase
    .from('knowledge_base')
    .update({ status: 'active' })
    .eq('id', id)
    .eq('shop_id', resolved.shop.id)
    .select('id, title, content, status, source, source_ref')
    .single()

  if (error || !data) {
    return { error: `อนุมัติข้อมูลไม่สำเร็จ: ${error?.message || 'ไม่ทราบสาเหตุ'}` }
  }

  let note: string | null = null
  try {
    note = await indexRows(supabase, resolved.shop.id, [data])
  } catch (err) {
    note = indexNote(null, err)
  }

  revalidatePath('/dashboard/knowledge')
  revalidatePath('/dashboard')
  return { success: withIndexNote('อนุมัติเพิ่มเข้าคลังความรู้ของร้านเรียบร้อยแล้ว!', note) }
}

export async function updateKnowledgeItem(id: string, formData: FormData) {
  const supabase = await createClient()
  const resolved = await resolveShop(supabase)
  if ('error' in resolved) return { error: resolved.error }

  const title = (formData.get('title') as string || '').trim()
  const content = (formData.get('content') as string || '').trim()
  const category = (formData.get('category') as string || 'faq').trim()
  const approveImmediately = formData.get('approveImmediately') === 'true'

  if (!title || !content) {
    return { error: 'กรุณากรอกหัวข้อและรายละเอียดข้อมูล' }
  }

  const updatePayload: Record<string, any> = {
    title,
    content,
    category,
  }

  if (approveImmediately) {
    updatePayload.status = 'active'
  }

  const { data, error } = await supabase
    .from('knowledge_base')
    .update(updatePayload)
    .eq('id', id)
    .eq('shop_id', resolved.shop.id)
    .select('id, title, content, status, source, source_ref')
    .single()

  if (error || !data) {
    return { error: `บันทึกการแก้ไขไม่สำเร็จ: ${error?.message || 'ไม่ทราบสาเหตุ'}` }
  }

  let note: string | null = null
  try {
    note = await indexRows(supabase, resolved.shop.id, [data])
  } catch (err) {
    note = indexNote(null, err)
  }

  revalidatePath('/dashboard/knowledge')
  revalidatePath('/dashboard')
  const saved = approveImmediately
    ? 'บันทึกและอนุมัติเข้าคลังความรู้เรียบร้อยแล้ว!'
    : 'บันทึกการแก้ไขเรียบร้อยแล้ว!'
  return { success: withIndexNote(saved, note) }
}

export async function triggerChatFaqScan() {
  const supabase = await createClient()
  const resolved = await resolveShop(supabase)
  if ('error' in resolved) return { error: resolved.error }

  const { synthesizeFaqFromShopConversations } = await import('@/lib/ai/faqSynthesis')
  const result = await synthesizeFaqFromShopConversations({
    shopId: resolved.shop.id,
    limit: 10,
  })

  revalidatePath('/dashboard/knowledge')
  revalidatePath('/dashboard')

  if (!result.success) {
    return { error: result.message }
  }

  return { success: result.message }
}

export async function deleteTrajectory(id: string) {
  const supabase = await createClient()
  const resolved = await resolveShop(supabase)
  if ('error' in resolved) return { error: resolved.error }

  const { error } = await supabase
    .from('sales_trajectories')
    .delete()
    .eq('id', id)
    .eq('shop_id', resolved.shop.id)

  if (error) {
    return { error: `ลบไม่สำเร็จ: ${error.message}` }
  }

  revalidatePath('/dashboard/knowledge')
  return { success: 'ลบตัวอย่างการปิดการขายเรียบร้อยแล้ว' }
}

export async function toggleTrajectoryStatus(id: string, currentStatus: string) {
  const supabase = await createClient()
  const resolved = await resolveShop(supabase)
  if ('error' in resolved) return { error: resolved.error }

  const nextStatus = currentStatus === 'active' ? 'archived' : 'active'
  const { error } = await supabase
    .from('sales_trajectories')
    .update({ status: nextStatus })
    .eq('id', id)
    .eq('shop_id', resolved.shop.id)

  if (error) {
    return { error: `เปลี่ยนสถานะไม่สำเร็จ: ${error.message}` }
  }

  revalidatePath('/dashboard/knowledge')
  return { success: nextStatus === 'active' ? 'เปิดใช้งานตัวอย่างนี้แล้ว' : 'ปิดใช้งานตัวอย่างนี้ชั่วคราวแล้ว' }
}

export async function dismissKnowledgeGap(id: string) {
  const supabase = await createClient()
  const resolved = await resolveShop(supabase)
  if ('error' in resolved) return { error: resolved.error }
  if (!id) return { error: 'ไม่พบคำถามนี้' }

  const { error } = await supabase
    .from('knowledge_gaps')
    .update({ status: 'dismissed' })
    .eq('id', id)
    .eq('shop_id', resolved.shop.id)
    .eq('status', 'open')

  if (error) {
    if (isMissingKnowledgeSchema(error)) return { error: 'ยังไม่ได้ติดตั้งตารางบันทึกคำถาม' }
    return { error: `ปิดรายการไม่สำเร็จ: ${error.message}` }
  }

  revalidatePath('/dashboard/knowledge')
  return { success: 'ปิดรายการนี้แล้ว' }
}

export async function triggerScanGoldenClosers() {
  const supabase = await createClient()
  const resolved = await resolveShop(supabase)
  if ('error' in resolved) return { error: resolved.error }

  const { extractGoldenTrajectoryFromOrder } = await import('@/lib/ai/salesTrajectory')
  
  // Find completed/paid orders with conversations that don't have trajectories yet
  const { data: paidOrders, error: orderErr } = await supabase
    .from('orders')
    .select('id, conversation_id, total_amount')
    .eq('shop_id', resolved.shop.id)
    .in('status', [...PAID_ORDER_STATUSES])
    .not('conversation_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(8)

  if (orderErr || !paidOrders || paidOrders.length === 0) {
    return { success: 'ยังไม่พบบทสนทนาของออเดอร์ที่ชำระเงินแล้วเพื่อนำมาวิเคราะห์' }
  }

  let extractedCount = 0
  for (const ord of paidOrders) {
    const res = await extractGoldenTrajectoryFromOrder({
      shopId: resolved.shop.id,
      orderId: ord.id,
      conversationId: ord.conversation_id,
      revenue: Number(ord.total_amount) || 0,
    })
    if (res.success) extractedCount++
  }

  revalidatePath('/dashboard/knowledge')
  return {
    success: extractedCount > 0
      ? `สกัดบทสนทนาปิดการขายชั้นเยี่ยมได้สำเร็จ ${extractedCount} รายการ!`
      : 'วิเคราะห์ออเดอร์แล้ว ไม่มีบทสนทนาใหม่ที่ต้องสกัดเพิ่มเติม',
  }
}



