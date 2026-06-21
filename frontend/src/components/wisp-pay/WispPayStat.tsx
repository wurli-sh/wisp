import { cn } from "@/lib/cn";

export function truncate(str: string, head = 8, tail = 4): string {
  if (str.length <= head + tail + 3) return str;
  return `${str.slice(0, head)}…${str.slice(-tail)}`;
}

export function WispPayStat({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-2 border-border bg-background px-4 py-3", className)}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="mt-2 min-w-0 text-sm font-semibold text-primary">{children}</div>
    </div>
  );
}
