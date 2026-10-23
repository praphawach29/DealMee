import { getEvaluationMetrics } from './actions'

export const dynamic = 'force-dynamic'

export default async function EvaluationPage() {
  const metrics = await getEvaluationMetrics()

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-slate-900 dark:text-slate-100">
          DealMee AI Evaluation & CSAT Dashboard
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          สรุปอัตราการปิดการขาย (Conversion Rate), ความพึงพอใจลูกค้า (CSAT) และต้นทุน DealMee AI ต่อบทสนทนา
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Conversations ทั้งหมด</p>
          <p className="font-heading text-2xl font-semibold text-slate-900 dark:text-slate-100 mt-2">
            {metrics.totalConversations.toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            มีออเดอร์: {metrics.conversationsWithOrders.toLocaleString()} รายการ
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Sales Conversion Rate</p>
          <p className="font-heading text-2xl font-semibold text-emerald-600 dark:text-emerald-400 mt-2">
            {metrics.conversionRate}%
          </p>
          <p className="text-xs text-slate-400 mt-1">อัตราการปิดการขายต่อบทสนทนา</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">CSAT Score (เฉลี่ย)</p>
          <p className="font-heading text-2xl font-semibold text-amber-500 dark:text-amber-400 mt-2">
            {metrics.avgCsatRating > 0 ? `${metrics.avgCsatRating} / 5.0 ⭐` : 'ไม่มีข้อมูล'}
          </p>
          <p className="text-xs text-slate-400 mt-1">จากข้อความประเมิน {metrics.totalFeedbackCount} รายการ</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">ต้นทุน AI โดยประมาณ</p>
          <p className="font-heading text-2xl font-semibold text-indigo-600 dark:text-indigo-400 mt-2">
            ${metrics.estimatedTotalCostUsd}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            เฉลี่ย {metrics.avgTokensPerConversation.toLocaleString()} tokens/สนทนา
          </p>
        </div>
      </div>

      {/* Sales Stage Funnel */}
      <div className="p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <h2 className="font-heading text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Sales Stage Funnel Breakdown
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900/50">
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase">Greeting</span>
            <p className="font-heading text-xl font-semibold text-blue-900 dark:text-blue-200 mt-1">
              {metrics.stageBreakdown.greeting}
            </p>
          </div>

          <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-100 dark:border-purple-900/50">
            <span className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase">Showcase</span>
            <p className="font-heading text-xl font-semibold text-purple-900 dark:text-purple-200 mt-1">
              {metrics.stageBreakdown.showcase}
            </p>
          </div>

          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-100 dark:border-amber-900/50">
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase">Closing</span>
            <p className="font-heading text-xl font-semibold text-amber-900 dark:text-amber-200 mt-1">
              {metrics.stageBreakdown.closing}
            </p>
          </div>

          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase">Post Sale</span>
            <p className="font-heading text-xl font-semibold text-emerald-900 dark:text-emerald-200 mt-1">
              {metrics.stageBreakdown.post_sale}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
