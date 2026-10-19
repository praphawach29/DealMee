import { getPaymentsList } from './actions'
import PaymentsManager from './PaymentsManager'

export const dynamic = 'force-dynamic'

export default async function AdminPaymentsPage() {
  const payments = await getPaymentsList('all')

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PaymentsManager initialPayments={payments} />
    </div>
  )
}
