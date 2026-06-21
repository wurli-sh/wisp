import { cn } from "@/lib/cn";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("relative overflow-hidden bg-skeleton", className)} aria-hidden>
      <div className="skeleton-shimmer absolute inset-0" />
    </div>
  );
}
