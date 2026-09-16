import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import DocumentStudioClient from './DocumentStudioClient'

export const metadata: Metadata = {
  title: 'เอกสารและใบเสนอราคาอัจฉริยะ (Smart Documents) | Botify',
  description: 'ระบบสร้างใบเสนอราคา BOQ และร่างหนังสือราชการอัตโนมัติด้วย AI',
}

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login')
  }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id) {
    redirect('/onboarding')
  }

  // Fetch all documents for this shop
  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('shop_id', shop.id)
    .order('created_at', { ascending: false })

  const companyProfile = {
    name: shop.name || 'ร้านค้า',
    companyName: shop.company_name || shop.name || 'บริษัท/ร้านค้า',
    taxId: shop.company_tax_id || '',
    address: shop.company_address || '',
    phone: shop.company_phone || '',
    email: shop.company_email || '',
    logoUrl: shop.company_logo_url || '',
    vatEnabled: shop.vat_enabled || false,
    bankName: shop.bank_name || '',
    bankAccountNumber: shop.bank_account_number || '',
    bankAccountName: shop.bank_account_name || '',
    promptpayId: shop.promptpay_id || '',
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <DocumentStudioClient
        initialDocuments={documents || []}
        shopName={shop.name || 'ร้านค้า'}
        companyName={shop.company_name || shop.name}
        vatEnabled={shop.vat_enabled || false}
        companyProfile={companyProfile}
      />
    </div>
  )
}
