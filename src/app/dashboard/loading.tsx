export default function DashboardLoading() {
  return (
    <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 max-w-[1440px] mx-auto w-full space-y-5 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-surface-container-high rounded-lg"></div>
          <div className="h-4 w-72 bg-surface-container rounded-md"></div>
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-32 bg-surface-container-high rounded-xl"></div>
          <div className="h-9 w-32 bg-electric-blue/20 rounded-xl"></div>
        </div>
      </div>

      {/* KPI Bento Grid Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-surface/80 border border-outline-variant/30 rounded-2xl p-4 sm:p-5 h-28 flex flex-col justify-between">
            <div className="flex justify-between items-center">
              <div className="w-8 h-8 rounded-xl bg-surface-container-highest"></div>
              <div className="w-14 h-4 rounded-md bg-surface-container"></div>
            </div>
            <div className="space-y-1.5">
              <div className="h-3 w-20 bg-surface-container"></div>
              <div className="h-6 w-28 bg-surface-container-high rounded-md"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Table / Content Area Skeleton */}
      <div className="bg-surface/80 border border-outline-variant/30 rounded-2xl p-5 space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-9 w-64 bg-surface-container-high rounded-xl"></div>
          <div className="h-9 w-40 bg-surface-container rounded-xl"></div>
        </div>
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 w-full bg-surface-container/50 rounded-xl"></div>
          ))}
        </div>
      </div>
    </div>
  )
}
