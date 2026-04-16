import { Skeleton } from "@/components/ui/skeleton";

export function AdminDashboardSkeleton() {
  return (
    <div className="flex w-full min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto xl:overflow-y-hidden">
      <div className="flex w-full flex-col gap-4 pb-6 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col xl:gap-5 xl:pb-0">
        <div className="shrink-0">
          <Skeleton className="h-7 w-40 sm:h-8" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>

        <div className="flex shrink-0 flex-col gap-2 xl:min-h-0 xl:flex-1 xl:overflow-hidden">
          <Skeleton className="h-3 w-24 shrink-0" />
          <div className="grid min-h-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:min-h-0 xl:flex-1 xl:grid-cols-12 xl:grid-rows-1 xl:items-stretch xl:gap-4">
            <div className="flex min-h-0 flex-col sm:col-span-2 xl:col-span-4 xl:h-full">
              <div className="flex min-h-[16rem] flex-col gap-3 overflow-hidden rounded-lg border border-border bg-card p-4 shadow-soft sm:p-5">
                <div className="flex justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-9 w-48" />
                    <Skeleton className="h-3 w-full max-w-[200px]" />
                  </div>
                  <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
                </div>
                <Skeleton className="h-[9.5rem] w-full shrink-0 rounded-md sm:h-[10rem]" />
                <Skeleton className="h-3 w-44" />
              </div>
            </div>
            <div className="flex min-h-0 flex-col sm:col-span-2 xl:col-span-4 xl:h-full">
              <div className="flex min-h-[16rem] flex-col gap-3 overflow-hidden rounded-lg border border-border bg-card p-4 shadow-soft sm:p-5">
                <div className="flex justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-9 w-48" />
                    <Skeleton className="h-3 w-full max-w-[200px]" />
                  </div>
                  <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
                </div>
                <Skeleton className="h-[9.5rem] w-full shrink-0 rounded-md sm:h-[10rem]" />
                <Skeleton className="h-3 w-44" />
              </div>
            </div>
            <div className="flex min-h-0 flex-col gap-3 sm:grid sm:grid-cols-2 sm:gap-4 xl:col-span-4 xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:gap-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="min-h-0 sm:col-span-1 xl:flex xl:min-h-0 xl:flex-[1_1_0%]">
                  <div className="space-y-3 rounded-lg border border-border bg-card p-6 shadow-soft xl:min-h-[7.5rem]">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                </div>
              ))}
              <div className="min-h-0 sm:col-span-2 xl:flex xl:min-h-0 xl:flex-[1_1_0%]">
                <div className="space-y-3 rounded-lg border border-border bg-card p-6 shadow-soft xl:min-h-[7.5rem]">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0">
          <Skeleton className="mb-2 h-3 w-16 lg:mb-3" />
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 lg:items-stretch [&>*]:min-w-0">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="space-y-3 rounded-lg border border-border bg-card p-6 shadow-soft"
              >
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-28" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
