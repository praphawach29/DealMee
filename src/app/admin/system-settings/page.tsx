import { canEncrypt, listSecretStatus, readSecretLog } from '@/lib/platformSecrets'
import SystemSettingsClient from './SystemSettingsClient'

export const dynamic = 'force-dynamic'

// The admin layout already limits /admin to the Super Admin
export default async function SystemSettingsPage() {
  const [statuses, log] = await Promise.all([listSecretStatus(), readSecretLog()])
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <SystemSettingsClient statuses={statuses} log={log.slice(0, 20)} canEncrypt={canEncrypt()} />
    </div>
  )
}
