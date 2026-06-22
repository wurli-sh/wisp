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

type Milestone = { label: string; end: number };

interface DemoProgressSidebarProps {
  activeStep: number;
}

function milestoneState(
  activeStep: number,
  milestone: Milestone,
  prevEnd: number,
): "done" | "current" | "pending" {
  if (activeStep > milestone.end) return "done";
  if (activeStep > prevEnd && activeStep <= milestone.end) return "current";
  return "pending";
}

function segmentClass(state: "done" | "current" | "pending"): string {
  return cn(
    state === "done" && "bg-brand",
    state === "current" && "bg-brand/35 ring-1 ring-inset ring-brand/50",
    state === "pending" && "bg-muted",
  );
}

function labelClass(state: "done" | "current" | "pending"): string {
  return cn(
    state === "done" && "font-medium text-brand",
    state === "current" && "font-semibold text-primary",
    state === "pending" && "text-muted-foreground",
  );
}

export function DemoProgressSidebar({ activeStep }: DemoProgressSidebarProps) {
  const steps = COPY.demo.steps;
  const milestones = MILESTONES as readonly Milestone[];
  const total = steps.length;
  const allDone = activeStep >= total;
  const currentStepLabel = allDone
    ? "All steps complete"
    : steps[Math.min(activeStep, total - 1)];

  return (
    <div className="border-border bg-background/60 px-1 py-2">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <p
            className={cn(
              "min-w-0 truncate text-sm font-medium leading-snug",
              allDone ? "text-success" : "text-primary",
            )}
          >
            {currentStepLabel}
          </p>
          <span
            className={cn(
              "shrink-0 border px-2 py-0.5 text-xs font-semibold tabular-nums",
              "border-border bg-muted/50 text-muted-foreground",
            )}
          >
            {Math.min(activeStep, total)}/{total}
          </span>
        </div>

        <div className="flex w-full gap-1">
          {milestones.map((milestone, index) => {
            const prevEnd = index > 0 ? milestones[index - 1]!.end : -1;
            const state = milestoneState(activeStep, milestone, prevEnd);

            return (
              <div
                key={milestone.label}
                className={cn(
                  "h-1 flex-1 transition-colors duration-300",
                  segmentClass(state),
                )}
                title={milestone.label}
              />
            );
          })}
        </div>

        <div className="hidden w-full gap-1 sm:flex">
          {milestones.map((milestone, index) => {
            const prevEnd = index > 0 ? milestones[index - 1]!.end : -1;
            const state = milestoneState(activeStep, milestone, prevEnd);

            return (
              <span
                key={milestone.label}
                className={cn(
                  "flex-1 truncate text-center text-xs leading-tight",
                  labelClass(state),
                )}
              >
                {milestone.label}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
