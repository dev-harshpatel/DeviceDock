import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function AdminReportsSkeleton() {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="space-y-6 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-4 w-80 mt-2" />
          </div>
          <Skeleton className="h-9 w-36" />
        </div>

        <div className="bg-card rounded-lg border border-border shadow-soft p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-9 w-[240px]" />
            <Skeleton className="h-9 w-[160px]" />
            <Skeleton className="h-9 w-[160px]" />
            <Skeleton className="h-9 w-[160px]" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-card rounded-lg border border-border shadow-soft p-4 space-y-3"
            >
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card rounded-lg border border-border shadow-soft p-6 lg:col-span-2">
            <Skeleton className="h-6 w-56 mb-4" />
            <Skeleton className="h-72 w-full" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "bg-card rounded-lg border border-border shadow-soft p-6",
                i === 4 && "lg:col-span-2"
              )}
            >
              <Skeleton className="h-6 w-44 mb-4" />
              <Skeleton className={i === 4 ? "h-40 w-full" : "h-64 w-full"} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
