import { Skeleton } from "@/components/ui/skeleton";

export function AdminDashboardSkeleton() {
  return (
    <div className="flex flex-col h-full overflow-y-auto lg:overflow-hidden">
      <div className="space-y-6 flex-shrink-0 pb-6">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72 mt-2" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-card rounded-lg border border-border shadow-soft p-4 space-y-3"
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0 mt-6 pb-6 lg:pb-0">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="bg-card rounded-lg border border-border shadow-soft flex flex-col h-[300px] lg:h-auto lg:min-h-0"
          >
            <div className="px-6 py-4 border-b border-border">
              <Skeleton className="h-5 w-40" />
            </div>
            <div className="px-6 py-4 space-y-4">
              {Array.from({ length: 4 }).map((__, rowIdx) => (
                <div key={rowIdx} className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
