import { getMarginReport } from './actions'
import MarginManagement from './MarginManagement'

export default async function AdminMarginPage() {
  const report = await getMarginReport()

  if ('error' in report) {
    return (
      <div className="p-6 text-sm text-error-red">{report.error}</div>
    )
  }

  return <MarginManagement report={report} />
}
