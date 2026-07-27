'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { getOrCreateShopForUser } from '@/lib/shopHelper'

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
