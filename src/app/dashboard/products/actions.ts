'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { platformSecret } from '@/lib/platformSecrets'
import { effectivePlanKey } from '@/lib/billing/trial'

export async function createProduct(formData: FormData) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: 'กรุณาเข้าสู่ระบบอีกครั้ง' }
  }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id) {
    return { error: 'ไม่พบข้อมูลร้านค้า' }
  }

  const name = formData.get('name') as string
  const category = formData.get('category') as string || 'ทั่วไป'
  const price = parseFloat(formData.get('price') as string || '0')
  const stock = parseInt(formData.get('stock') as string || '0', 10)
  const description = formData.get('description') as string
  const image_url = formData.get('image_url') as string

  if (!name) {
    return { error: 'กรุณากรอกชื่อสินค้า' }
  }

  const { error } = await supabase
    .from('products')
    .insert({
      shop_id: shop.id,
      name,
      category,
      price,
      stock,
      description,
      image_url,
    })

  if (error) {
    return { error: `เพิ่มสินค้าไม่สำเร็จ: ${error.message}` }
  }

  revalidatePath('/dashboard/products')
  revalidatePath('/dashboard')
  return { success: 'เพิ่มสินค้าเรียบร้อยแล้ว!' }
}

export async function updateProduct(id: string, formData: FormData) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: 'กรุณาเข้าสู่ระบบอีกครั้ง' }
  }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id) {
    return { error: 'ไม่พบข้อมูลร้านค้า' }
  }

  const name = String(formData.get('name') || '').trim()
  const category = String(formData.get('category') || '').trim() || 'ทั่วไป'
  const price = parseFloat(formData.get('price') as string || '0')
  const stock = parseInt(formData.get('stock') as string || '0', 10)
  const description = String(formData.get('description') || '').trim()
  const image_url = String(formData.get('image_url') || '').trim()

  if (!id || !name) {
    return { error: 'กรุณากรอกชื่อสินค้า' }
  }

  if (!Number.isFinite(price) || price < 0) {
    return { error: 'กรุณากรอกราคาสินค้าให้ถูกต้อง' }
  }

  if (!Number.isInteger(stock) || stock < 0) {
    return { error: 'กรุณากรอกจำนวนสต็อกเป็นเลขจำนวนเต็มตั้งแต่ 0 ขึ้นไป' }
  }

  const { data: updatedProduct, error } = await supabase
    .from('products')
    .update({
      name,
      category,
      price,
      stock,
      description,
      image_url,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('shop_id', shop.id)
    .select('id')
    .maybeSingle()

  if (!error && !updatedProduct) {
    return { error: 'ไม่พบสินค้านี้ หรือคุณไม่มีสิทธิ์แก้ไขสินค้า' }
  }

  if (error) {
    return { error: `แก้ไขสินค้าไม่สำเร็จ: ${error.message}` }
  }

  revalidatePath('/dashboard/products')
  revalidatePath('/dashboard')
  return { success: 'อัปเดตข้อมูลสินค้าเรียบร้อยแล้ว!' }
}

export async function deleteProduct(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: `ลบสินค้าไม่สำเร็จ: ${error.message}` }
  }

  revalidatePath('/dashboard/products')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function generateAiProductDescription(productId: string) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: 'กรุณาเข้าสู่ระบบอีกครั้ง' }
  }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id) {
    return { error: 'ไม่พบข้อมูลร้านค้า' }
  }

  if (!['pro', 'agency', 'byok', 'trial'].includes(effectivePlanKey(shop))) {
    return { error: 'AI Copywriter ใช้ได้กับแพ็กเกจ Pro, Business และ BYOK กรุณาอัปเกรดแพ็กเกจก่อนใช้งาน' }
  }

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('name, category, price, stock, description')
    .eq('id', productId)
    .eq('shop_id', shop.id)
    .maybeSingle()

  if (productError || !product) {
    return { error: 'ไม่พบสินค้านี้ หรือคุณไม่มีสิทธิ์ใช้งาน' }
  }

  const apiKey = await platformSecret('GEMINI_API_KEY')
  const modelName = (await platformSecret('GEMINI_MODEL')) || 'gemini-2.5-flash'
  if (!apiKey) {
    return { error: 'ระบบไม่ได้ตั้งค่า GEMINI_API_KEY กรุณาติดต่อแอดมิน' }
  }

  const prompt = `You are a Thai e-commerce copywriter. Write a short Thai product description using only this verified product record from the store:\n${JSON.stringify(product, null, 2)}\n\nRules:\n- Treat this record as the only source of truth.\n- Never invent ingredients, benefits, skin suitability, medical claims, materials, sizes, certifications, promotions, shipping, warranty, or availability details.\n- If product attributes are missing, write a concise neutral description from the name, category, and price only.\n- Write 2-4 natural Thai sentences. No markdown heading and no bullet list.`

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
    })

    if (!res.ok) {
      return { error: 'ไม่สามารถสร้างเนื้อหาด้วย AI ได้ในขณะนี้' }
    }

    const data = await res.json()
    const description = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!description) {
      return { error: 'AI ไม่ได้ส่งคำตอบกลับมา กรุณาลองใหม่อีกครั้ง' }
    }

    return { success: true, description }
  } catch (error) {
    return { error: error instanceof Error ? `เกิดข้อผิดพลาด: ${error.message}` : 'เกิดข้อผิดพลาดขณะสร้างรายละเอียดสินค้า' }
  }
}
export async function bulkImportProducts(productsList: Array<{
  name: string
  category?: string
  price?: number
  stock?: number
  description?: string
  image_url?: string
}>) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: 'กรุณาเข้าสู่ระบบอีกครั้ง' }
  }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id) {
    return { error: 'ไม่พบข้อมูลร้านค้า' }
  }

  if (!productsList || productsList.length === 0) {
    return { error: 'ไม่พบรายการสินค้าสำหรับนำเข้า' }
  }

  const insertData = productsList.map((p) => ({
    shop_id: shop.id,
    name: p.name,
    category: p.category || 'ทั่วไป',
    price: p.price || 0,
    stock: p.stock || 0,
    description: p.description || '',
    image_url: p.image_url || '',
  }))

  const { error } = await supabase.from('products').insert(insertData)

  if (error) {
    return { error: `นำเข้าสินค้าล้มเหลว: ${error.message}` }
  }

  revalidatePath('/dashboard/products')
  revalidatePath('/dashboard')
  return { success: `นำเข้าสินค้าสำเร็จจำนวน ${insertData.length} รายการ!` }
}

export async function seedSampleShopData() {
  return { error: 'ข้อมูลตัวอย่างถูกปิดใช้งานสำหรับร้านจริง เพื่อป้องกันยอดขายและสินค้าปลอม' }
}

export async function syncMarketplaceProducts(platform: 'all' | 'shopee' | 'tiktok' = 'all') {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: 'กรุณาเข้าสู่ระบบอีกครั้ง' }
  }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id) {
    return { error: 'ไม่พบข้อมูลร้านค้า' }
  }

  const { syncMarketplaceProductsEngine } = await import('@/lib/marketplace/inventoryManager')
  const res = await syncMarketplaceProductsEngine(shop.id, platform)

  if (!res.success) {
    return { error: res.error || 'ซิงค์สินค้าจากมาร์เก็ตเพลสไม่สำเร็จ' }
  }

  revalidatePath('/dashboard/products')
  revalidatePath('/dashboard')
  return {
    success: true,
    message: `ซิงค์สินค้าจาก ${platform === 'all' ? 'TikTok Shop & Shopee' : platform.toUpperCase()} สำเร็จแล้ว ${res.syncedCount} รายการ! ข้อมูลสต็อกเชื่อมเข้าสู่คลังสต็อกกลางเรียบร้อย`,
    syncedCount: res.syncedCount,
  }
}

export async function updateCentralProductStock(
  productId: string,
  newStock: number,
  reason: string = 'ปรับยอดสต็อกกลางโดยแอดมิน'
) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: 'กรุณาเข้าสู่ระบบอีกครั้ง' }
  }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id) {
    return { error: 'ไม่พบข้อมูลร้านค้า' }
  }

  const { updateCentralStockEngine } = await import('@/lib/marketplace/inventoryManager')
  const res = await updateCentralStockEngine(shop.id, productId, newStock, reason, 'manual')

  if (res.error) {
    return { error: res.error }
  }

  revalidatePath('/dashboard/products')
  revalidatePath('/dashboard')
  return { success: true, message: 'อัปเดตสต็อกกลางและบันทึกประวัติสำเร็จเรียบร้อย' }
}

export async function getStockAuditLogs() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: 'กรุณาเข้าสู่ระบบอีกครั้ง', logs: [] }
  }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id) {
    return { error: 'ไม่พบข้อมูลร้านค้า', logs: [] }
  }

  const { getMarketplaceStockLogs } = await import('@/lib/marketplace/inventoryManager')
  const logs = await getMarketplaceStockLogs(shop.id, 30)

  return { success: true, logs }
}

