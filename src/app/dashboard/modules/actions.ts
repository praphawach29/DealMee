'use server'

import { createClient } from '@/utils/supabase/server'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { revalidatePath } from 'next/cache'

export async function updateShopFeatures(features: Record<string, boolean>) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: 'กรุณาเข้าสู่ระบบอีกครั้ง' }
  }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id) {
    return { error: 'ไม่พบข้อมูลร้านค้า' }
  }

  const mergedFeatures = {
    ...((shop.features as Record<string, any>) || {}),
    ...features,
  }

  const { error } = await supabase
    .from('shops')
    .update({
      features: mergedFeatures,
      updated_at: new Date().toISOString(),
    })
    .eq('id', shop.id)

  if (error) {
    return { error: `บันทึกสวิตช์ไม่สำเร็จ: ${error.message}` }
  }

  revalidatePath('/dashboard', 'layout')
  revalidatePath('/dashboard/modules')
  return { success: 'บันทึกการเปิด-ปิดเครื่องมือเรียบร้อยแล้ว!' }
}
