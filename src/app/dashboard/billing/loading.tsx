export default function BillingLoading() {
  return (
    <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 max-w-[1440px] mx-auto w-full space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-7 w-48 bg-surface-container-high rounded-lg" />
        <div className="h-4 w-72 bg-surface-container rounded-md" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-surface/80 border border-outline-variant/30 rounded-2xl p-6 h-64 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="h-6 w-32 bg-surface-container-high rounded-md" />
              <div className="h-8 w-24 bg-surface-container-highest rounded-md" />
            </div>
            <div className="h-10 w-full bg-electric-blue/20 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  )
}
