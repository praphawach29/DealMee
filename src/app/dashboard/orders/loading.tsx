export default function OrdersLoading() {
  return (
    <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 max-w-[1440px] mx-auto w-full space-y-5 animate-pulse">
      <div className="space-y-2">
        <div className="h-7 w-48 bg-surface-container-high rounded-lg" />
        <div className="h-4 w-72 bg-surface-container rounded-md" />
      </div>

      <div className="bg-surface/80 border border-outline-variant/30 rounded-2xl p-5 space-y-4">
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-24 bg-surface-container-high rounded-lg" />
          ))}
        </div>
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 w-full bg-surface-container/50 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
