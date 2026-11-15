'use client'

interface AuditLogItem {
  id: string
  action: string
  details: string
  user: string
  time: string
  type: 'info' | 'success' | 'warning'
}

export default function AuditLogsView() {
  const logs: AuditLogItem[] = []

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-on-surface font-headline-md leading-tight">
          ประวัติการทำงานของระบบ DealMee AI
        </h1>
        <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5 font-body-md">
          บันทึกกิจกรรมสำคัญ การลงทะเบียน และการเปลี่ยนแปลงการตั้งค่าในระดับแพลตฟอร์ม DealMee AI
        </p>
      </div>

      {/* Logs Table Card */}
      <div className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="space-y-3">
          {logs.length === 0 ? (
            <p className="text-sm text-on-surface-variant py-6 text-center">
              ยังไม่มีบันทึกกิจกรรมจากระบบ หน้านี้จะแสดงเฉพาะเหตุการณ์จริงเมื่อมีการเชื่อมต่อประวัติการทำงาน
            </p>
          ) : null}
          {logs.map((log) => (
            <div
              key={log.id}
              className="p-4 rounded-xl border border-outline-variant/30 bg-merchant-bg flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  log.type === 'success'
                    ? 'bg-success-green/10 text-success-green'
                    : 'bg-electric-blue/10 text-electric-blue'
                }`}>
                  <span className="material-symbols-outlined text-[18px]">
                    {log.type === 'success' ? 'check_circle' : 'info'}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-xs sm:text-sm text-on-surface">{log.action}</p>
                    <span className="text-[10px] text-outline font-mono">({log.user})</span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5">{log.details}</p>
                </div>
              </div>
              <span className="text-[11px] text-outline shrink-0 font-medium self-end sm:self-center">
                {log.time}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
