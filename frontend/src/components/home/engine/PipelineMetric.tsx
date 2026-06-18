import { cn } from "@/lib/cn";

type PipelineMetricProps = {
  value: string;
  label: string;
  className?: string;
  style?: React.CSSProperties;
};

export function PipelineMetric({ value, label, className, style }: PipelineMetricProps) {
  return (
    <div
      className={cn(
        "pointer-events-none z-20 flex flex-col items-center border-2 border-primary/30 bg-background px-3 py-1.5 shadow-soft",
        className,
      )}
      style={style}
    >
      <span className="text-sm font-bold tabular-nums text-primary">{value}</span>
      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
