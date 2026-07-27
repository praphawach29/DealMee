'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createSampleOrder() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthenticated' }

  // 1. Fetch shop for merchant
  const { data: shop } = await supabase
    .from('shops')
    .select('id')
    .eq('user_id', user.id)
    .single()

  let shopId = shop?.id

  if (!shopId) {
    const { data: anyShop } = await supabase
      .from('shops')
      .select('id')
      .limit(1)
      .single()
    shopId = anyShop?.id
  }

  if (!shopId) return { error: 'กรุณาสร้างและเชื่อมต่อร้านค้าก่อน' }

  const sampleOrderNo = `ORD-${Math.floor(1000 + Math.random() * 9000)}`
  const mockCustomers = [
    { name: 'คุณวิภา (LINE)', phone: '081-234-5678', items: 'เสื้อยืด Oversize (x2), เซรั่มหน้าใส (x1)', price: 890 },
    { name: 'คุณอนันต์ (LINE)', phone: '089-987-6543', items: 'รองเท้า Sneaker หนังแท้ (x1)', price: 1890 },
    { name: 'คุณสมชาย (LINE)', phone: '062-111-2233', items: 'เคสมือถือกันกระแทก (x2)', price: 450 },
    { name: 'คุณกานดา (LINE)', phone: '095-444-5566', items: 'ครีมบำรุงผิวสูตรพรีเมียม (x1)', price: 1250 },
  ]
  const customer = mockCustomers[Math.floor(Math.random() * mockCustomers.length)]

  const { error } = await supabase.from('orders').insert({
    shop_id: shopId,
    order_no: sampleOrderNo,
    customer_name: customer.name,
    phone: customer.phone,
    total_amount: customer.price,
    items_summary: customer.items,
    status: 'paid',
    tracking_no: `TH${Math.floor(100000000 + Math.random() * 900000000)}`,
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/orders')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateOrderStatus(orderId: string, newStatus: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('orders')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', orderId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/orders')
  revalidatePath('/dashboard')
  return { success: true }
}
