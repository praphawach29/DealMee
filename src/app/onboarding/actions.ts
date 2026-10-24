'use server'

import { revalidatePath } from 'next/cache'
import { TRIAL_DAYS } from '@/lib/billing/trial'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { businessTypeForTemplate } from './templates'
import { loginUrl, onboardingResumePath, safeNextPath } from '@/lib/auth/safeNext'

export async function submitOnboarding(formData: FormData) {
  const supabase = await createClient()
  const requested = safeNextPath(String(formData.get('next') || ''), '')

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (!user || userError) {
    redirect(loginUrl({ next: requested || '/onboarding' }))
  }

  const shopName = formData.get('shopName') as string
  const aiTemplate = formData.get('aiTemplate') as string
  // Derived from the chosen template on the server; the form's per-template hidden
  // inputs were disabled and never submitted, leaving business_type empty
  const businessType = businessTypeForTemplate(aiTemplate)

  // Check if user already has a shop linked
  const { data: profile } = await supabase
    .from('users')
    .select('workspace_id')
    .eq('id', user.id)
    .single()

  let shopId = profile?.workspace_id

  if (!shopId) {
    // Create the shop and link it with the service client: shops has no INSERT
    // policy for merchants, and the dashboard now sends unlinked accounts here,
    // so a silently failed insert would loop them back to this page.
    const admin = createAdminClient()
    shopId = randomUUID()
    const { error: insertError } = await admin
      .from('shops')
      .insert({
        id: shopId,
        name: shopName,
        business_type: businessType,
        ai_template: aiTemplate,
        plan: 'trial',
        plan_key: 'trial',
        trial_expires_at: new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString(),
      })

    if (insertError) {
      console.error('[Onboarding] Could not create shop:', insertError)
      const params = new URLSearchParams({ error: 'create_failed' })
      if (requested) params.set('next', requested)
      redirect(`/onboarding?${params.toString()}`)
    }

    // Link only if still unlinked, so a double submit can't orphan a second shop
    const { data: linked } = await admin
      .from('users')
      .update({ workspace_id: shopId })
      .eq('id', user.id)
      .is('workspace_id', null)
      .select('id')

    if (!linked || linked.length === 0) {
      const { data: existing } = await admin.from('users').select('id, workspace_id').eq('id', user.id).maybeSingle()
      if (!existing) {
        await admin.from('users').insert({ id: user.id, email: user.email, workspace_id: shopId })
      } else {
        // Linked by a concurrent submit: drop the shop just created
        await admin.from('shops').delete().eq('id', shopId)
      }
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
  redirect(onboardingResumePath(requested))
}
