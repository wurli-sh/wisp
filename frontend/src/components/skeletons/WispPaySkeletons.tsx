import { PAGE_PT } from "@/config/layout";
import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui/Skeleton";

export function WispPayFormSkeleton() {
  return (
    <div className="flex flex-col gap-8" role="status" aria-busy="true" aria-label="Loading form">
      <div>
        <Skeleton className="h-3 w-28" />
        <div className="mt-6 grid gap-6">
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
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-12 w-full" />
          </div>
          <div className="grid gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-12 w-full" />
          </div>
          <div className="grid gap-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-3 w-full max-w-md" />
          </div>
        </div>
        <Skeleton className="mt-6 h-12 w-44" />
      </div>
    </div>
  );
}

export function WispPayPayPanelSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-busy="true" aria-label="Loading payment">
      <Skeleton className="h-16 w-full border-2 border-border" />
      <div className="border-2 border-border bg-brand-soft/40">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-border bg-background px-6 py-5">
          <div className="space-y-3">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-9 w-36" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
        <div className="grid gap-4 p-6">
          <Skeleton className="h-16 w-full" />
          <div className="grid gap-3 md:grid-cols-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
          <Skeleton className="h-12 w-44" />
        </div>
      </div>
    </div>
  );
}

export function WispPayReceiptSkeleton({ withSummary = true }: { withSummary?: boolean }) {
  return (
    <div className="flex flex-col gap-6" role="status" aria-busy="true" aria-label="Loading receipt">
      <Skeleton className="h-14 w-full border-2 border-border" />
      {withSummary ? (
        <div className="border-2 border-border bg-brand-soft/40">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-border bg-background px-6 py-5">
            <div className="space-y-3">
              <Skeleton className="h-3 w-32" />
              <div className="flex items-end gap-3">
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-6 w-14" />
              </div>
            </div>
            <Skeleton className="h-6 w-14" />
          </div>
          <div className="grid gap-4 p-6">
            <Skeleton className="h-16 w-full" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-[4.5rem] w-full" />
              <Skeleton className="h-[4.5rem] w-full" />
              <Skeleton className="h-[4.5rem] w-full" />
              <Skeleton className="h-[4.5rem] w-full" />
            </div>
          </div>
        </div>
      ) : (
        <div className="border-2 border-border bg-brand-soft/40 px-6 py-12">
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-[4.5rem] w-full" />
            <Skeleton className="h-[4.5rem] w-full" />
            <Skeleton className="h-[4.5rem] w-full" />
            <Skeleton className="h-[4.5rem] w-full" />
          </div>
        </div>
      )}
    </div>
  );
}

export function WispPayPageSkeleton({ mode = "create" }: { mode?: "create" | "pay" | "receipt" }) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-8 sm:px-6 lg:gap-8 lg:pb-12",
        PAGE_PT,
      )}
      role="status"
      aria-busy="true"
      aria-label="Loading Wisp Pay"
    >
      <div className="space-y-3">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-8 w-56 sm:w-72" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 w-4/5 max-w-xl" />
      </div>

      <div className="border-2 border-border bg-background shadow-soft">
        <div className="flex gap-1 border-b-2 border-border px-2 pt-2">
          <Skeleton className="h-10 w-[4.75rem]" />
          <Skeleton className="h-10 w-12" />
          <Skeleton className="h-10 w-[4.5rem]" />
        </div>
        <div className="p-6">
          {mode === "pay" && <WispPayPayPanelSkeleton />}
          {mode === "receipt" && <WispPayReceiptSkeleton withSummary={false} />}
          {mode === "create" && <WispPayFormSkeleton />}
        </div>
      </div>

      <Skeleton className="h-3 w-52" />
    </div>
  );
}
