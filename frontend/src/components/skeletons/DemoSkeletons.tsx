import { PAGE_PT } from "@/config/layout";
import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui/Skeleton";

export function DemoProgressSkeleton() {
  return (
    <div className="border-border bg-background/60 px-1 py-2" role="status" aria-busy="true" aria-label="Loading progress">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-6 w-10" />
        </div>
        <div className="flex w-full gap-1">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={index} className="h-1 flex-1" />
          ))}
        </div>
        <div className="flex w-full gap-1">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={index} className="mx-auto h-3 w-10" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function DemoTransferPanelSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-5xl"
      role="status"
      aria-busy="true"
      aria-label="Loading transfer panel"
    >
      <div className="overflow-hidden border-2 border-border bg-background shadow-soft">
        <div className="flex items-center gap-1 border-b-2 border-border px-2 pt-2">
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col gap-6 bg-background px-6 py-7">
            <Skeleton className="h-3 w-32" />
            <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
              <div className="grid gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-12 w-full" />
              </div>
              <Skeleton className="size-12 shrink-0" />
              <div className="grid gap-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
            <div className="grid gap-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-12 w-full" />
            </div>
            <div className="grid gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-3 w-full max-w-sm" />
            </div>
            <Skeleton className="h-12 w-full max-w-xs" />
          </div>
          <div className="flex flex-col gap-6 border-t-2 border-border bg-muted/20 px-6 py-7 lg:border-t-0 lg:border-l-2 lg:border-border">
            <Skeleton className="h-3 w-20" />
            <div className="flex flex-col gap-4 border-2 border-border bg-background p-5">
              <Skeleton className="mx-auto h-7 w-40" />
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-7 w-24" />
                  <Skeleton className="h-5 w-14" />
                </div>
                <Skeleton className="size-10 shrink-0" />
                <div className="ml-auto space-y-2">
                  <Skeleton className="ml-auto h-3 w-20" />
                  <Skeleton className="ml-auto h-6 w-28" />
                </div>
              </div>
            </div>
            <Skeleton className="h-3 w-32" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-18 w-full" />
              <Skeleton className="h-18 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DemoPageSkeleton() {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-8 sm:px-6 lg:gap-8 lg:pb-12",
        PAGE_PT,
      )}
      role="status"
      aria-busy="true"
      aria-label="Loading demo"
    >
      <Skeleton className="h-20 w-full border-2 border-border" />
      <div className="border-2 border-border bg-background px-4 py-4 shadow-soft sm:px-5">
        <DemoProgressSkeleton />
      </div>
      <DemoTransferPanelSkeleton />
    </div>
  );
}
