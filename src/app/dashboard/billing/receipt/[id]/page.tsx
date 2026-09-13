import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import ReceiptDocument, { ReceiptData } from '@/components/billing/ReceiptDocument'
import { getPlatformBillingSettings } from '@/lib/billing/manualBilling'

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

  // Fetch payment row
  const { data: payment, error } = await admin
    .from('billing_payments')
    .select(
      `
      *,
      shops:shop_id (
        id,
        name,
        company_name,
        company_tax_id,
        company_address,
        company_phone,
        company_email
      )
    `
    )
    .eq('id', id)
    .single()

  if (error || !payment) {
    notFound()
  }

  // Security check: User must be owner of shop or super admin
  const { data: dbUser } = await admin
    .from('users')
    .select('workspace_id, is_super_admin')
    .eq('id', user.id)
    .single()

  const isOwner = dbUser?.workspace_id === payment.shop_id
  const isSuperAdmin = dbUser?.is_super_admin || user.email === 'admin@botify.ai' || user.email === 'jack291625@gmail.com'

  if (!isOwner && !isSuperAdmin) {
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
      id: payment.shops?.id || '',
      name: payment.shops?.name || 'ร้านค้า',
      company_name: payment.shops?.company_name,
      company_tax_id: payment.shops?.company_tax_id,
      company_address: payment.shops?.company_address,
      company_phone: payment.shops?.company_phone,
      company_email: payment.shops?.company_email,
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
