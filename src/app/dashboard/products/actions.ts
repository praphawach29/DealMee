'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { platformSecret } from '@/lib/platformSecrets'
import { effectivePlanKey } from '@/lib/billing/trial'
import { embedderForShop } from '@/lib/knowledge/embedAuth'
import { indexKnowledgeEntries } from '@/lib/knowledge/indexKnowledge'

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
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: 'กรุณาเข้าสู่ระบบอีกครั้ง' }
  }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id) {
    return { error: 'ไม่พบข้อมูลร้านค้า' }
  }

  const shopId = shop.id

  // 1. Enriched sample products with rich descriptions & high-res image URLs
  const enrichedProductsData: Record<string, { description: string; image_url: string; price: number; category: string }> = {
    'เสื้อยืดลายการ์ตูน': {
      category: 'เสื้อผ้า',
      price: 259,
      description: 'เสื้อยืดผ้าคอตตอนคอมบ์ (Comb Cotton) 100% เนื้อผ้านุ่มระบายอากาศดี ไม่ร้อน พิมพ์ลายการ์ตูนด้วยเทคโนโลยี DTG สีสดติดทน ทรง Unisex สวมใส่ได้ทั้งชายและหญิง (มีไซส์ S, M, L, XL)',
      image_url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80',
    },
    'กางเกงยีนส์ขาบอร์ด': {
      category: 'เสื้อผ้า',
      price: 590,
      description: 'กางเกงยีนส์เอวสูงทรงขาบอร์ด (Wide-Leg Board Jeans) ผ้ายีนส์เดนิมฟอกนุ่ม ทรงสวยใส่สบาย กระเป๋าจริงหน้าหลัง เหมาะกับแต่งลุค Streetwear (มีไซส์ S 25-26", M 27-28", L 29-30")',
      image_url: 'https://images.unsplash.com/photo-1542272604-780c36856d67?w=800&auto=format&fit=crop&q=80',
    },
    'กระเป๋าสะพายหนัง PU': {
      category: 'กระเป๋า',
      price: 890,
      description: 'กระเป๋าสะพายหนัง PU พรีเมียม สัมผัสนุ่มทนทาน กันน้ำได้ สายสะพายปรับระดับและถอดได้ มีช่องซิปหลักและช่องใส่ของย่อย 3 ช่อง จุของได้เยอะ เหมาะสำหรับทำงานและเที่ยว',
      image_url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80',
    },
    'รองเท้าผ้าใบสีขาว': {
      category: 'รองเท้า',
      price: 1290,
      description: 'รองเท้าผ้าใบสีขาวดีไซน์ Minimalist ผลิตจากผ้าแคนวาสอย่างดี พื้นยางกันลื่น นุ่มสบายเท้า ระบายอากาศได้ดี เดินทั้งวันไม่เจ็บเท้า (ไซส์ 36-44)',
      image_url: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&auto=format&fit=crop&q=80',
    },
    'หมวกแก๊ปปีกกลาย': {
      category: 'เครื่องประดับ',
      price: 350,
      description: 'หมวกแก๊ปปีกกลายสไตล์ Streetwear ผ้าคอตตอนทวิลล์ ทรงสวย ปักโลโก้ประณีต ด้านหลังมีสายปรับขนาดโลหะ เหมาะกับทุกรูปหน้า',
      image_url: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&auto=format&fit=crop&q=80',
    },
    'เคสมือถือลายการ์ตูน': {
      category: 'อุปกรณ์เสริม',
      price: 199,
      description: 'เคสมือถือซิลิโคน TPU แบบกันกระแทก ขอบหนาปกป้องกล้องและหน้าจอ ผิวมะเหนียวนุ่มจับกระชับมือ ลายพิมพ์เกรดพรีเมียมสีไม่ลอก (รองรับ iPhone และ Samsung)',
      image_url: 'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=800&auto=format&fit=crop&q=80',
    },
    'ผ้าพันคอไหมพรม': {
      category: 'เครื่องประดับ',
      price: 450,
      description: 'ผ้าพันคอไหมพรมเนื้อหนานุ่มพิเศษ ถักทอละเอียด กันลมและเก็บความอบอุ่นดีเยี่ยม ไม่ระคายเคืองผิว ยาว 180 ซม. แมตช์ได้กับทุกชุด',
      image_url: 'https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=800&auto=format&fit=crop&q=80',
    },
    'กระบอกน้ำสแตนเลส': {
      category: 'ของใช้ทั่วไป',
      price: 320,
      description: 'กระบอกน้ำสแตนเลส 304 ฟู้ดเกรด ปลอดสาร BPA เก็บความเย็นได้ 24 ชั่วโมง และเก็บความร้อนได้ 12 ชั่วโมง ฝาล็อคกันรั่วซึม ขนาด 500ml พกพาสะดวก',
      image_url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&auto=format&fit=crop&q=80',
    },
  }

  const { data: existingProds } = await supabase
    .from('products')
    .select('id, name, image_url, description')
    .eq('shop_id', shopId)

  if (existingProds && existingProds.length > 0) {
    for (const p of existingProds) {
      const enriched = enrichedProductsData[p.name]
      const updatePayload: Record<string, unknown> = {}
      if (enriched) {
        updatePayload.image_url = enriched.image_url
        updatePayload.description = enriched.description
      } else {
        if (!p.image_url || p.image_url.trim() === '') {
          updatePayload.image_url = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80'
        }
      }
      if (Object.keys(updatePayload).length > 0) {
        await supabase
          .from('products')
          .update(updatePayload)
          .eq('id', p.id)
      }
    }
  } else {
    // Insert initial 8 sample products if shop has 0 products
    const initialProds = Object.entries(enrichedProductsData).map(([name, data]) => ({
      shop_id: shopId,
      name,
      category: data.category,
      price: data.price,
      stock: 20,
      description: data.description,
      image_url: data.image_url,
    }))
    await supabase.from('products').insert(initialProds)
  }

  // 2. Insert sample orders if shop has 0 orders
  const { count: existingOrdersCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('shop_id', shopId)

  if (!existingOrdersCount || existingOrdersCount === 0) {
    const sampleOrders = [
      {
        shop_id: shopId,
        order_no: 'ORD-20260803-1001',
        customer_name: 'คุณสมชาย สายโอน',
        phone: '0812345678',
        customer_phone: '0812345678',
        address: '123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กทม. 10110',
        product_name: 'เสื้อยืดลายการ์ตูน',
        items_summary: 'เสื้อยืดลายการ์ตูน (2 ชิ้น)',
        quantity: '2',
        total_amount: 518.00,
        status: 'paid',
        payment_status: 'paid',
        payment_method: 'promptpay',
      },
      {
        shop_id: shopId,
        order_no: 'ORD-20260803-1002',
        customer_name: 'คุณวิภาดา แฟชั่น',
        phone: '0898765432',
        customer_phone: '0898765432',
        address: '456 ถนนพหลโยธิน แขวงจตุจักร เขตจตุจักร กทม. 10900',
        product_name: 'กางเกงยีนส์ขาบอร์ด',
        items_summary: 'กางเกงยีนส์ขาบอร์ด (1 ชิ้น)',
        quantity: '1',
        total_amount: 590.00,
        status: 'shipped',
        payment_status: 'paid',
        payment_method: 'promptpay',
      },
      {
        shop_id: shopId,
        order_no: 'ORD-20260803-1003',
        customer_name: 'คุณนพดล ชอบช็อป',
        phone: '0865554321',
        customer_phone: '0865554321',
        address: '789 ถนนพระราม 9 เขตห้วยขวาง กทม. 10310',
        product_name: 'กระเป๋าสะพายหนัง PU',
        items_summary: 'กระเป๋าสะพายหนัง PU (1 ชิ้น)',
        quantity: '1',
        total_amount: 890.00,
        status: 'pending',
        payment_status: 'pending',
        payment_method: 'promptpay',
      },
    ]
    await supabase.from('orders').insert(sampleOrders)
  }

  // 3. Insert sample knowledge base if empty
  const { count: existingKbCount } = await supabase
    .from('knowledge_base')
    .select('*', { count: 'exact', head: true })
    .eq('shop_id', shopId)

  if (!existingKbCount || existingKbCount === 0) {
    const sampleKb = [
      {
        shop_id: shopId,
        title: 'นโยบายการจัดส่งสินค้า',
        content: 'ทางร้านจัดส่งสินค้าวันจันทร์-เสาร์ ตัดรอบส่ง 14:00 น. จัดส่งด้วย Kerry Express / Flash Express ค่าจัดส่งเหมาจ่าย 50 บาท (สั่งซื้อครบ 800 บาท ส่งฟรี)',
        category: 'การจัดส่ง',
      },
      {
        shop_id: shopId,
        title: 'เงื่อนไขการเปลี่ยนและคืนสินค้า',
        content: 'สามารถเปลี่ยนสินค้าได้ภายใน 7 วันหลังได้รับสินค้า หากสินค้ามีชำรุดจากโรงงาน หรือส่งผิดไซส์ โดยสินค้าต้องอยู่ในสภาพสมบูรณ์และยังไม่ซัก',
        category: 'นโยบายร้าน',
      },
    ]
    const { data: insertedKb, error: kbError } = await supabase
      .from('knowledge_base')
      .insert(sampleKb)
      .select('id, title, content, status, source, source_ref')
    if (!kbError && insertedKb && insertedKb.length > 0) {
      try {
        const { embedder } = await embedderForShop(shopId)
        await indexKnowledgeEntries({ supabase, shopId, entries: insertedKb, embedder })
      } catch (err) {
        console.error('[sample knowledge] index failed:', err instanceof Error ? err.message : err)
      }
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/products')
  revalidatePath('/dashboard/orders')
  revalidatePath('/dashboard/inbox')

  return { success: 'สร้างข้อมูลตัวอย่างครบถ้วนเรียบร้อยแล้ว!' }
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

