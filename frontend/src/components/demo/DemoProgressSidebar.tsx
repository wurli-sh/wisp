import { Check, Circle, Loader2 } from "lucide-react";
import { COPY } from "@/content/copy";
import { cn } from "@/lib/cn";

const MILESTONES = [
  { label: "Wallet", end: 1 },
  { label: "Setup", end: 4 },
  { label: "Package", end: 5 },
  { label: "Proof", end: 7 },
  { label: "Approve", end: 8 },
  { label: "Settle", end: 10 },
  { label: "Audit", end: 11 },
] as const;

interface DemoProgressSidebarProps {
  activeStep: number;
}

export function DemoProgressSidebar({ activeStep }: DemoProgressSidebarProps) {
  const total = COPY.demo.steps.length;
  const percent = Math.round((activeStep / total) * 100);
  const allDone = activeStep >= total;
  const nextLabel = allDone ? null : COPY.demo.steps[activeStep];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Progress
        </span>
        <span className="text-xs font-bold text-primary">
          {activeStep}/{total}
        </span>
      </div>

      <div className="h-1 w-full bg-muted">
        <div
          className="h-full bg-primary-dark transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ol className="flex items-start justify-between gap-1">
        {MILESTONES.map((milestone, index) => {
          const done = activeStep > milestone.end;
          const prevEnd = index > 0 ? MILESTONES[index - 1].end : -1;
          const current = activeStep > prevEnd && activeStep <= milestone.end;

          return (
            <li key={milestone.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center",
                  done && "bg-success-soft",
                  current && !done && "bg-primary-soft",
                  !done && !current && "border-2 border-border bg-background",
                )}
              >
                {done ? (
                  <Check size={12} className="text-success" />
                ) : current ? (
                  <Loader2 size={12} className="animate-spin text-primary" />
                ) : (
                  <Circle size={10} className="text-border-strong" />
                )}
              </div>
              <span
                className={cn(
                  "w-full truncate text-center text-[9px] font-bold uppercase tracking-wide",
                  done && "text-success",
                  current && !done && "text-primary",
                  !done && !current && "text-muted-foreground",
                )}
              >
                {milestone.label}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="border-2 border-border bg-card px-3 py-2 text-center text-xs text-muted-foreground">
        {allDone ? (
          <span className="font-semibold text-success">Demo complete</span>
        ) : (
          <>
            Next: <span className="font-semibold text-foreground">{nextLabel}</span>
          </>
        )}
      </p>
    </div>
  );
}
