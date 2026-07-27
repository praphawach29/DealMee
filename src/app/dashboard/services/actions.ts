'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createService(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthenticated' }

  const { data: profile } = await supabase
    .from('users')
    .select('workspace_id')
    .eq('id', user.id)
    .single()

  if (!profile?.workspace_id) return { error: 'No workspace' }

  const name = formData.get('name') as string
  const duration = parseInt(formData.get('duration') as string || '60', 10)
  const price = parseFloat(formData.get('price') as string || '0')
  const description = formData.get('description') as string

  if (!name) return { error: 'กรุณากรอกชื่อบริการ' }

  const { error } = await supabase
    .from('services')
    .insert({
      shop_id: profile.workspace_id,
      name,
      duration_minutes: duration,
      price,
      description,
    })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/services')
  return { success: true }
}

export async function deleteService(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('services')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/services')
  return { success: true }
}
