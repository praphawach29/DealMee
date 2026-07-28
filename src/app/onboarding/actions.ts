'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { randomUUID } from 'crypto'
import { getBusinessTypeForTemplate } from '@/lib/businessGreeting'

export async function submitOnboarding(formData: FormData) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (!user || userError) {
    redirect('/login')
  }

  const shopName = formData.get('shopName') as string
  const businessType = formData.get('businessType') as string
  const aiTemplate = formData.get('aiTemplate') as string

  // Check if user already has a shop linked
  const { data: profile } = await supabase
    .from('users')
    .select('workspace_id')
    .eq('id', user.id)
    .single()

  let shopId = profile?.workspace_id

  if (!shopId) {
    // Create new shop
    shopId = randomUUID()
    const { error: insertError } = await supabase
      .from('shops')
      .insert({
        id: shopId,
        name: shopName,
        business_type: businessType,
        ai_template: aiTemplate
      })

    if (!insertError) {
      // Link to user
      await supabase
        .from('users')
        .update({ workspace_id: shopId })
        .eq('id', user.id)
    }
  } else {
    // Update existing shop
    await supabase
      .from('shops')
      .update({
        name: shopName,
        business_type: businessType,
        ai_template: aiTemplate
      })
      .eq('id', shopId)
  }

  revalidatePath('/dashboard', 'layout')
  redirect('/dashboard')
}
