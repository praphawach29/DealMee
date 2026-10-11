export default function ProductsLoading() {
  return (
    <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 max-w-[1440px] mx-auto w-full space-y-5 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-surface-container-high rounded-lg" />
          <div className="h-4 w-72 bg-surface-container rounded-md" />
        </div>
        <div className="h-10 w-36 bg-electric-blue/20 rounded-xl" />
      </div>

      <div className="bg-surface/80 border border-outline-variant/30 rounded-2xl p-5 space-y-4">
        <div className="h-10 w-full sm:w-72 bg-surface-container-high rounded-xl" />
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 w-full bg-surface-container/50 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
