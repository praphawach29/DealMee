import { getPlatformSettingsAction } from '../payments/actions'
import PaymentSettingsForm from './PaymentSettingsForm'

export const dynamic = 'force-dynamic'

export default async function AdminPaymentSettingsPage() {
  const settings = await getPlatformSettingsAction()

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PaymentSettingsForm initialSettings={settings} />
    </div>
  )
}
