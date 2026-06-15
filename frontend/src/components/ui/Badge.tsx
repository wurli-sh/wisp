import { cn } from "@/lib/cn";

type BadgeVariant = "default" | "success" | "warning" | "danger";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "border-2 border-border bg-muted text-foreground",
  success: "border-2 border-success/30 bg-success-soft text-success",
  warning: "border-2 border-warning/30 bg-warning/10 text-warning",
  danger: "border-2 border-destructive/30 bg-destructive/10 text-destructive",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
