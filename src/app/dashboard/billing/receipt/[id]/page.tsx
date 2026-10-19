import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import ReceiptDocument, { ReceiptData } from '@/components/billing/ReceiptDocument'
import { getPlatformBillingSettings } from '@/lib/billing/manualBilling'
import { isSuperAdminEmail } from '@/lib/auth/superAdmin'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ReceiptPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const admin = createAdminClient()

  // Fetch payment row. The shop is read separately with select('*'): naming its columns
  // (one of them, shops.email, doesn't exist in production) made the query fail and every
  // receipt link show "not found".
  const { data: payment, error } = await admin.from('billing_payments').select('*').eq('id', id).maybeSingle()

  if (error) {
    console.error('[Receipt] Failed to load payment:', error)
  }
  if (error || !payment) {
    notFound()
  }

  // Security check: User must be owner of shop or super admin
  const { data: dbUser } = await admin
    .from('users')
    .select('workspace_id')
    .eq('id', user.id)
    .single()

  const isOwner = dbUser?.workspace_id === payment.shop_id

  if (!isOwner && !isSuperAdminEmail(user.email)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <h1 className="text-lg font-bold text-red-600">ปฏิเสธการเข้าถึง</h1>
          <p className="text-xs text-slate-500">คุณไม่มีสิทธิ์เข้าถึงใบเสร็จรับเงินรายการนี้</p>
        </div>
      </div>
    )
  }

  const platformSettings = await getPlatformBillingSettings()
  const { data: shopData } = await admin.from('shops').select('*').eq('id', payment.shop_id).maybeSingle()

  const receiptData: ReceiptData = {
    id: payment.id,
    receipt_number: payment.receipt_number || `REC-${payment.id.slice(0, 8).toUpperCase()}`,
    created_at: payment.created_at,
    verified_at: payment.verified_at,
    plan_key: payment.plan_key || 'pro',
    plan_name: (payment.plan_key || 'Pro').toUpperCase(),
    billed_amount: Number(payment.billed_amount || payment.amount || 0),
    withheld_amount: Number(payment.withheld_amount || 0),
    transferred_amount: Number(payment.transferred_amount || payment.amount || 0),
    currency: payment.currency || 'THB',
    status: payment.status,
    customer_notes: payment.customer_notes,
    shop: {
      id: shopData?.id || '',
      name: shopData?.name || 'ร้านค้า',
      company_name: shopData?.company_name,
      company_tax_id: shopData?.company_tax_id,
      company_address: shopData?.company_address,
      company_phone: shopData?.company_phone,
      company_email: shopData?.company_email,
    },
    platform: {
      account_name: platformSettings.account_name,
      payee_tax_id: platformSettings.payee_tax_id,
      is_vat_registered: platformSettings.is_vat_registered,
      company_address: platformSettings.company_address,
      company_phone: platformSettings.company_phone,
      company_email: platformSettings.company_email,
    },
  }

  return (
    <div className="min-h-screen bg-slate-100/60 dark:bg-slate-950/60 py-8">
      <ReceiptDocument data={receiptData} showBackButton={true} />
    </div>
  )
}
