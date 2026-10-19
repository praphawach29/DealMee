import { headers } from 'next/headers'
import { getPlatformSettingsAction, getPlatformLineStatusAction } from '../payments/actions'
import PaymentSettingsForm from './PaymentSettingsForm'
import PlatformLineAlertsCard from './PlatformLineAlertsCard'

export const dynamic = 'force-dynamic'

export default async function AdminPaymentSettingsPage() {
  const [settings, lineStatus, h] = await Promise.all([getPlatformSettingsAction(), getPlatformLineStatusAction(), headers()])
  const host = h.get('x-forwarded-host') || h.get('host') || 'www.dealmee.app'
  const proto = h.get('x-forwarded-proto') || 'https'

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <PaymentSettingsForm initialSettings={settings} />
      <PlatformLineAlertsCard status={lineStatus} webhookUrl={`${proto}://${host}/api/webhook/platform-alerts`} />
    </div>
  )
}
