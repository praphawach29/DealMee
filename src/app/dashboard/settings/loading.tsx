export default function SettingsLoading() {
  return (
    <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 pb-28 sm:pb-36 max-w-[1440px] mx-auto w-full space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-48 bg-surface-container-high rounded-lg" />
        <div className="h-4 w-80 bg-surface-container rounded-md" />
      </div>

      {/* Tabs Skeleton */}
      <div className="flex gap-2 border-b border-outline-variant/30 pb-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-9 w-28 bg-surface-container-high rounded-xl" />
        ))}
      </div>

      {/* Form Card Skeleton */}
      <div className="bg-surface/80 border border-outline-variant/30 rounded-2xl p-6 space-y-5">
        <div className="h-6 w-40 bg-surface-container-highest rounded-md" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-11 bg-surface-container/60 rounded-xl" />
          <div className="h-11 bg-surface-container/60 rounded-xl" />
          <div className="h-11 bg-surface-container/60 rounded-xl" />
          <div className="h-11 bg-surface-container/60 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
