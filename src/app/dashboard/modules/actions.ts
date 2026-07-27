'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateShopFeatures(features: Record<string, boolean>) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: 'กรุณาเข้าสู่ระบบอีกครั้ง' }
  }

  const { data: profile } = await supabase
    .from('users')
    .select('workspace_id')
    .eq('id', user.id)
    .single()

  if (!profile?.workspace_id) {
    return { error: 'ไม่พบข้อมูลร้านค้า' }
  }

  const { error } = await supabase
    .from('shops')
    .update({
      features,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.workspace_id)

  if (error) {
    return { error: `บันทึกสวิตช์ไม่สำเร็จ: ${error.message}` }
  }

  revalidatePath('/dashboard/modules')
  return { success: 'บันทึกการเปิด-ปิดเครื่องมือเรียบร้อยแล้ว!' }
}
