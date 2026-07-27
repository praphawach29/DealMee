'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { getOrCreateShopForUser } from '@/lib/shopHelper'

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

  const name = formData.get('name') as string
  const category = formData.get('category') as string || 'ทั่วไป'
  const price = parseFloat(formData.get('price') as string || '0')
  const stock = parseInt(formData.get('stock') as string || '0', 10)
  const description = formData.get('description') as string
  const image_url = formData.get('image_url') as string

  const { error } = await supabase
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

export async function generateAiProductDescription(name: string, category?: string) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: 'กรุณาเข้าสู่ระบบอีกครั้ง' }
  }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop) {
    return { error: 'ไม่พบข้อมูลร้านค้า' }
  }

  const userPlan = (shop.plan || 'free').toLowerCase()
  const allowedPlans = ['pro', 'agency', 'byok']

  if (!allowedPlans.includes(userPlan)) {
    return {
      error: 'ฟีเจอร์ AI Copywriter รองรับเฉพาะแพ็กเกจ Pro (฿990), Agency (฿2,490) และ BYOK เท่านั้น กรุณาอัปเกรดแพ็กเกจก่อนใช้งาน',
    }
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

  if (!apiKey) {
    return { error: 'ระบบไม่ได้ตั้งค่า GEMINI_API_KEY กรุณาติดต่อแอดมิน' }
  }

  try {
    const prompt = `คุณคือสถาปนิกนักเขียนคอนเทนต์และนักการตลาดมืออาชีพประจำร้านค้า E-commerce
ช่วยเขียนคำอธิบายสินค้าที่สั้น กระชับ น่าซื้อ ดึงดูดลูกค้า สำหรับนำไปใส่ในแคตตาล็อกสินค้าของร้านค้า

ข้อมูลสินค้า:
ชื่อสินค้า: "${name}"
หมวดหมู่: "${category || 'ทั่วไป'}"

คำแนะนำ:
1. เขียนให้น่าซื้อ สุภาพ เป็นกันเอง ภาษาทันสมัย
2. สรุปจุดเด่น สเปก หรือวิธีใช้เป็นหัวข้อสั้นๆ
3. ความยาวประมาณ 3-5 บรรทัด พอดีสายตา`

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      }),
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
  } catch (err: any) {
    return { error: `เกิดข้อผิดพลาด: ${err.message}` }
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
