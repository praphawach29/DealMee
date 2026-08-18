'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { extractFromUrl, extractFromPdf, extractFromCsv, type ExtractedSource } from '@/lib/knowledge/extract'
import { toKnowledgeEntries, csvToEntriesDirect, type KnowledgeEntry } from '@/lib/knowledge/ingest'

/** Roughly the ceiling on what a shop owner might reasonably upload; larger files are almost always the wrong document. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

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

  const { error } = await supabase
    .from('knowledge_base')
    .insert({
      shop_id: shop.id,
      title,
      content,
      category,
    })

  if (error) {
    return { error: `เพิ่มข้อมูลไม่สำเร็จ: ${error.message}` }
  }

  revalidatePath('/dashboard/knowledge')
  revalidatePath('/dashboard')
  return { success: 'เพิ่มข้อมูลความรู้เรียบร้อยแล้ว!' }
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
  source: 'url' | 'pdf' | 'csv',
  sourceRef: string
) {
  await supabase
    .from('knowledge_base')
    .delete()
    .eq('shop_id', shopId)
    .eq('source', source)
    .eq('source_ref', sourceRef)

  const { error } = await supabase.from('knowledge_base').insert(
    entries.map((entry) => ({
      shop_id: shopId,
      title: entry.title,
      content: entry.content,
      category: 'faq',
      source,
      source_ref: sourceRef,
    }))
  )

  if (error) return { error: `บันทึกข้อมูลไม่สำเร็จ: ${error.message}` }

  revalidatePath('/dashboard/knowledge')
  revalidatePath('/dashboard')
  return { success: `เพิ่มข้อมูลจาก ${sourceRef} จำนวน ${entries.length} ข้อเรียบร้อยแล้ว!` }
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
    return await saveImportedEntries(supabase, resolved.shop.id, entries, 'url', source.label)
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
  if (file.size > MAX_UPLOAD_BYTES) return { error: 'ไฟล์ใหญ่เกิน 10 MB กรุณาแบ่งไฟล์ให้เล็กลง' }

  const isPdf = file.name.toLowerCase().endsWith('.pdf')
  const isCsv = file.name.toLowerCase().endsWith('.csv')
  if (!isPdf && !isCsv) return { error: 'รองรับเฉพาะไฟล์ .pdf และ .csv เท่านั้น' }

  try {
    // A spreadsheet already laid out as question/answer columns is taken
    // as-is: exact, free, and it keeps the shop's own wording rather than
    // letting a model paraphrase a policy.
    if (isCsv) {
      const direct = csvToEntriesDirect(await file.text())
      if (direct && direct.length > 0) {
        return await saveImportedEntries(supabase, resolved.shop.id, direct, 'csv', file.name)
      }
    }

    const source: ExtractedSource = isPdf ? await extractFromPdf(file) : await extractFromCsv(file)
    const entries = await toKnowledgeEntries(source.text, resolved.shop.name || 'ร้านค้า')
    return await saveImportedEntries(supabase, resolved.shop.id, entries, isPdf ? 'pdf' : 'csv', source.label)
  } catch (err: any) {
    return { error: err.message || 'อ่านไฟล์ไม่สำเร็จ' }
  }
}

/** Removes every entry that came from one import in a single step, so a stale price list doesn't have to be deleted row by row. */
export async function deleteKnowledgeSource(source: string, sourceRef: string) {
  const supabase = await createClient()
  const resolved = await resolveShop(supabase)
  if ('error' in resolved) return { error: resolved.error }

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

  const { error } = await supabase
    .from('knowledge_base')
    .delete()
    .eq('id', id)

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

  const { error } = await supabase
    .from('knowledge_base')
    .update({ status: 'active' })
    .eq('id', id)
    .eq('shop_id', resolved.shop.id)

  if (error) {
    return { error: `อนุมัติข้อมูลไม่สำเร็จ: ${error.message}` }
  }

  revalidatePath('/dashboard/knowledge')
  revalidatePath('/dashboard')
  return { success: 'อนุมัติเพิ่มเข้าคลังความรู้ของร้านเรียบร้อยแล้ว!' }
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

  const { error } = await supabase
    .from('knowledge_base')
    .update(updatePayload)
    .eq('id', id)
    .eq('shop_id', resolved.shop.id)

  if (error) {
    return { error: `บันทึกการแก้ไขไม่สำเร็จ: ${error.message}` }
  }

  revalidatePath('/dashboard/knowledge')
  revalidatePath('/dashboard')
  return {
    success: approveImmediately
      ? 'บันทึกและอนุมัติเข้าคลังความรู้เรียบร้อยแล้ว!'
      : 'บันทึกการแก้ไขเรียบร้อยแล้ว!',
  }
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
    .eq('payment_status', 'paid')
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



