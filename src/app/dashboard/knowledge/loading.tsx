export default function KnowledgeLoading() {
  return (
    <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 max-w-[1440px] mx-auto w-full space-y-5 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-surface-container-high rounded-lg" />
          <div className="h-4 w-72 bg-surface-container rounded-md" />
        </div>
        <div className="h-10 w-36 bg-electric-blue/20 rounded-xl" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-surface/80 border border-outline-variant/30 rounded-2xl p-5 h-40 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="h-5 w-32 bg-surface-container-highest rounded-md" />
              <div className="h-3 w-48 bg-surface-container rounded-md" />
            </div>
            <div className="h-3 w-20 bg-surface-container rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}
