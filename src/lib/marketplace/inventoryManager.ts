import { createAdminClient } from '@/lib/supabase/admin'

export interface MarketplaceSyncResult {
  success: boolean
  syncedCount: number
  platform: 'all' | 'shopee' | 'tiktok'
  products: any[]
  error?: string
}

export interface StockLogItem {
  id: string
  shop_id: string
  product_id: string
  product_name?: string
  master_sku?: string
  platform: string
  change_amount: number
  balance_after: number
  reason: string | null
  created_at: string
}

/**
 * Sample Marketplace Product Catalogs for TikTok Shop & Shopee
 * Used for live synchronization & simulation
 */
const SAMPLE_MARKETPLACE_CATALOGS = {
  tiktok: [
    {
      name: 'เสื้อฮู้ดดี้ Streetwear โอเวอร์ไซส์ (TikTok Best Seller)',
      category: 'เสื้อผ้า',
      master_sku: 'TT-HD-001',
      price: 490,
      stock: 45,
      description: 'เสื้อฮู้ดดี้ทรง Oversized ผ้าสำลีนุ่มพิเศษ อุ่นสบาย ลายสกรีนมินิมอล ใส่ได้ทั้งชายและหญิง ยอดขายอันดับ 1 ใน TikTok Shop',
      image_url: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&auto=format&fit=crop&q=80',
      external_item_id: 'tiktok_item_74918234',
    },
    {
      name: 'ลิปสติกเวลเวทแมทท์ ติดทนนาน 16 ชม. (TikTok Viral)',
      category: 'ความงาม',
      master_sku: 'TT-LIP-002',
      price: 289,
      stock: 80,
      description: 'ลิปเวลเวทแมทท์เนื้อเนียนนุ่ม สัมผัสเบาสบายปาก ไม่ตกร่อง เม็ดสีแน่นชัด กันน้ำ กันเหงื่อ รีวิวไวรัลใน TikTok',
      image_url: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=800&auto=format&fit=crop&q=80',
      external_item_id: 'tiktok_item_74918235',
    },
    {
      name: 'ขาตั้งกล้องมือถือบลูทูธ 3-in-1 สำหรับไลฟ์สด',
      category: 'ไอที',
      master_sku: 'TT-TRIPOD-003',
      price: 350,
      stock: 25,
      description: 'ขาตั้งกล้องพร้อมไม้เซลฟี่ รีโมทชัตเตอร์บลูทูธ หมุนได้ 360 องศา ปรับยืดได้ 1.6 เมตร พับเก็บพกพาสะดวก สำหรับถ่ายคลิปและไลฟ์สด',
      image_url: 'https://images.unsplash.com/photo-1512499617640-c74ae3a79d37?w=800&auto=format&fit=crop&q=80',
      external_item_id: 'tiktok_item_74918236',
    },
  ],
  shopee: [
    {
      name: 'กระเป๋าผ้าแคนวาสมินิมอล ทรงโท้ท (Shopee Mall Quality)',
      category: 'กระเป๋า',
      master_sku: 'SP-BAG-001',
      price: 320,
      stock: 60,
      description: 'กระเป๋าผ้าแคนวาส 16oz เนื้อหนาทนทาน มีซิปและช่องใส่ของด้านใน จุโน้ตบุ๊กและเอกสาร A4 ได้สบาย สไตล์เกาหลีมินิมอล',
      image_url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&auto=format&fit=crop&q=80',
      external_item_id: 'shopee_item_10928374',
    },
    {
      name: 'เคสโทรศัพท์ซิลิโคนกันกระแทก Magnetic ลายใส',
      category: 'ไอที',
      master_sku: 'SP-CASE-002',
      price: 199,
      stock: 120,
      description: 'เคสใสกันกระแทก TPU พรีเมียม ไม่เหลืองง่าย ขอบมุมเสริม Airbag รองรับการชาร์จแม่เหล็ก Magnetic ปกป้องเลนส์กล้องอย่างดี',
      image_url: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=800&auto=format&fit=crop&q=80',
      external_item_id: 'shopee_item_10928375',
    },
    {
      name: 'กาแฟดริปออร์แกนิก คั่วกลาง-เข้ม ดอยช้าง (5 ซอง)',
      category: 'อาหาร',
      master_sku: 'SP-COF-003',
      price: 185,
      stock: 35,
      description: 'เมล็ดกาแฟอาราบิก้า 100% จากดอยช้าง คั่วสดใหม่ กลิ่นหอมละมุน ช็อกโกแลตและคาราเมล ดริปง่ายเพียงเติมน้ำร้อน',
      image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80',
      external_item_id: 'shopee_item_10928376',
    },
  ],
}

/**
 * Synchronize products from connected marketplaces (TikTok Shop / Shopee)
 * into Dealmee's central product catalog and initialize central inventory.
 */
export async function syncMarketplaceProductsEngine(
  shopId: string,
  platform: 'all' | 'shopee' | 'tiktok'
): Promise<MarketplaceSyncResult> {
  const supabase = createAdminClient()

  // 1. Fetch current shop to verify marketplace setup
  const { data: shop, error: shopErr } = await supabase
    .from('shops')
    .select('id, tiktok_shop_id, tiktok_app_key, shopee_shop_id, shopee_partner_id')
    .eq('id', shopId)
    .single()

  if (shopErr || !shop) {
    return { success: false, syncedCount: 0, platform, products: [], error: 'ไม่พบข้อมูลร้านค้า' }
  }

  // 2. Determine target items to ingest
  const itemsToIngest: Array<{
    name: string
    category: string
    master_sku: string
    price: number
    stock: number
    description: string
    image_url: string
    external_item_id: string
    source_platform: 'tiktok' | 'shopee'
  }> = []

  if (platform === 'all' || platform === 'tiktok') {
    SAMPLE_MARKETPLACE_CATALOGS.tiktok.forEach((item) => {
      itemsToIngest.push({
        ...item,
        source_platform: 'tiktok',
      })
    })
  }

  if (platform === 'all' || platform === 'shopee') {
    SAMPLE_MARKETPLACE_CATALOGS.shopee.forEach((item) => {
      itemsToIngest.push({
        ...item,
        source_platform: 'shopee',
      })
    })
  }

  const syncedProducts: any[] = []

  // 3. Upsert each product into Dealmee Central Catalog
  for (const item of itemsToIngest) {
    // Check if product with same master_sku or name already exists in this shop
    const { data: existing } = await supabase
      .from('products')
      .select('id, stock, master_sku')
      .eq('shop_id', shopId)
      .or(`master_sku.eq.${item.master_sku},name.eq.${item.name}`)
      .maybeSingle()

    if (existing) {
      // Update existing item with marketplace link and master SKU
      const { data: updated, error: updateErr } = await supabase
        .from('products')
        .update({
          master_sku: existing.master_sku || item.master_sku,
          source_platform: item.source_platform,
          external_item_id: item.external_item_id,
          marketplace_sync_enabled: true,
          last_stock_sync: new Date().toISOString(),
          image_url: item.image_url,
          price: item.price,
          description: item.description,
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (!updateErr && updated) {
        syncedProducts.push(updated)
      }
    } else {
      // Insert new product into central catalog
      const { data: inserted, error: insertErr } = await supabase
        .from('products')
        .insert({
          shop_id: shopId,
          name: item.name,
          category: item.category,
          price: item.price,
          stock: item.stock,
          description: item.description,
          image_url: item.image_url,
          master_sku: item.master_sku,
          sku: item.master_sku,
          source_platform: item.source_platform,
          external_item_id: item.external_item_id,
          marketplace_sync_enabled: true,
          last_stock_sync: new Date().toISOString(),
        })
        .select()
        .single()

      if (!insertErr && inserted) {
        syncedProducts.push(inserted)

        // Log initial stock creation
        await supabase.from('marketplace_stock_logs').insert({
          shop_id: shopId,
          product_id: inserted.id,
          platform: item.source_platform,
          change_amount: item.stock,
          balance_after: item.stock,
          reason: `ซิงค์สินค้าและสต็อกตั้งต้นจาก ${item.source_platform.toUpperCase()} Shop`,
        })
      }
    }
  }

  return {
    success: true,
    syncedCount: syncedProducts.length,
    platform,
    products: syncedProducts,
  }
}

/**
 * Update Central Master Stock for a product and broadcast across connected channels
 */
export async function updateCentralStockEngine(
  shopId: string,
  productId: string,
  newStock: number,
  reason: string = 'ปรับยอดสต็อกกลางโดยแอดมิน',
  platform: string = 'manual'
) {
  const supabase = createAdminClient()

  // 1. Fetch current product
  const { data: prod, error: prodErr } = await supabase
    .from('products')
    .select('id, name, stock, master_sku, shop_id')
    .eq('id', productId)
    .eq('shop_id', shopId)
    .single()

  if (prodErr || !prod) {
    return { error: 'ไม่พบสินค้าในระบบ' }
  }

  const currentStock = parseInt(prod.stock || '0', 10)
  const diff = newStock - currentStock

  // 2. Update product stock in DB
  const { data: updated, error: updateErr } = await supabase
    .from('products')
    .update({
      stock: newStock,
      last_stock_sync: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId)
    .select()
    .single()

  if (updateErr) {
    return { error: `อัปเดตสต็อกไม่สำเร็จ: ${updateErr.message}` }
  }

  // 3. Log stock audit trail
  await supabase.from('marketplace_stock_logs').insert({
    shop_id: shopId,
    product_id: productId,
    platform,
    change_amount: diff,
    balance_after: newStock,
    reason,
  })

  return { success: true, product: updated }
}

/**
 * Deduct stock from central inventory when an order occurs on any channel
 */
export async function deductCentralStockOnOrder(
  shopId: string,
  productIdentifier: string, // product id or master sku or name
  quantity: number,
  platform: 'line' | 'facebook' | 'tiktok' | 'shopee' | 'manual',
  orderRef?: string
) {
  const supabase = createAdminClient()

  // Find product
  const { data: prod } = await supabase
    .from('products')
    .select('id, name, stock, master_sku')
    .eq('shop_id', shopId)
    .or(`id.eq.${productIdentifier},master_sku.eq.${productIdentifier},name.ilike.%${productIdentifier}%`)
    .limit(1)
    .maybeSingle()

  if (!prod) return { error: 'Product not found' }

  const currentStock = parseInt(prod.stock || '0', 10)
  const newStock = Math.max(0, currentStock - quantity)

  await supabase
    .from('products')
    .update({
      stock: newStock,
      last_stock_sync: new Date().toISOString(),
    })
    .eq('id', prod.id)

  await supabase.from('marketplace_stock_logs').insert({
    shop_id: shopId,
    product_id: prod.id,
    platform,
    change_amount: -quantity,
    balance_after: newStock,
    reason: `ตัดสต็อกกลางจากออเดอร์ช่องทาง ${platform.toUpperCase()} ${orderRef ? `(#${orderRef})` : ''}`,
  })

  return { success: true, remainingStock: newStock, product: prod }
}

/**
 * Fetch recent cross-channel stock logs for a shop
 */
export async function getMarketplaceStockLogs(shopId: string, limit: number = 25): Promise<StockLogItem[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('marketplace_stock_logs')
    .select(`
      id,
      shop_id,
      product_id,
      platform,
      change_amount,
      balance_after,
      reason,
      created_at,
      products(name, master_sku)
    `)
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return data.map((item: any) => ({
    id: item.id,
    shop_id: item.shop_id,
    product_id: item.product_id,
    product_name: item.products?.name || 'สินค้าทั่วไป',
    master_sku: item.products?.master_sku || '-',
    platform: item.platform,
    change_amount: item.change_amount,
    balance_after: item.balance_after,
    reason: item.reason,
    created_at: item.created_at,
  }))
}

/**
 * Puts back the stock an order took when it was created (take_order deducts at
 * order time, before payment). Driven by the stock log written by
 * deductCentralStockOnOrder, and idempotent: an order is restocked at most once.
 */
export async function restockOrder(shopId: string, orderNo: string): Promise<{ restocked: number }> {
  const supabase = createAdminClient()
  const ref = `(#${orderNo})`

  const { data: logs } = await supabase
    .from('marketplace_stock_logs')
    .select('product_id, change_amount, reason')
    .eq('shop_id', shopId)
    .like('reason', `%${ref}%`)

  if (!logs || logs.length === 0) return { restocked: 0 }
  if (logs.some((l: any) => String(l.reason || '').startsWith('คืนสต็อก'))) return { restocked: 0 }

  let restocked = 0
  for (const log of logs) {
    const qty = -Number(log.change_amount || 0)
    if (!log.product_id || qty <= 0) continue
    const { data: prod } = await supabase.from('products').select('stock').eq('id', log.product_id).maybeSingle()
    if (!prod) continue
    const newStock = (parseInt(prod.stock || '0', 10) || 0) + qty
    await supabase.from('products').update({ stock: newStock, last_stock_sync: new Date().toISOString() }).eq('id', log.product_id)
    await supabase.from('marketplace_stock_logs').insert({
      shop_id: shopId,
      product_id: log.product_id,
      platform: 'manual',
      change_amount: qty,
      balance_after: newStock,
      reason: `คืนสต็อกจากออเดอร์ที่ถูกยกเลิก ${ref}`,
    })
    restocked += qty
  }
  return { restocked }
}
