import { getPaymentsList, getPlatformSettingsAction } from './actions'
import PaymentsManager from './PaymentsManager'

export const dynamic = 'force-dynamic'

export default async function AdminPaymentsPage() {
  const [payments, settings] = await Promise.all([
    getPaymentsList('all'),
    getPlatformSettingsAction(),
  ])

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PaymentsManager
        initialPayments={payments}
        initialSettings={settings}
      />
    </div>
  )
}
