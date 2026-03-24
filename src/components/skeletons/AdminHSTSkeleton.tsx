import { Skeleton } from "@/components/ui/skeleton";

export function AdminHSTSkeleton() {
  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-[28rem] mt-2" />
        </div>
        <Skeleton className="h-9 w-[240px]" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-card rounded-lg border border-border shadow-soft p-4 space-y-3"
          >
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="bg-card rounded-lg border border-border shadow-soft p-6"
          >
            <Skeleton className="h-6 w-44 mb-4" />
            <Skeleton className="h-48 w-full" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-card rounded-lg border border-border shadow-soft p-6"
          >
            <Skeleton className="h-6 w-60 mb-4" />
            <Skeleton className="h-56 w-full" />
          </div>
        ))}
      </div>
    </>
  );
}
