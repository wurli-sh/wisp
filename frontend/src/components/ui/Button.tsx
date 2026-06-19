import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "outline" | "danger";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "border-2 border-charcoal bg-charcoal text-brand-foreground shadow-none hover:border-primary-dark hover:bg-primary-dark active:scale-[0.97]",
  secondary:
    "pill-gradient bg-brand-soft text-brand shadow-blue-pill hover:bg-brand/10 active:scale-[0.97]",
  outline:
    "border-2 border-border bg-background text-foreground shadow-soft hover:bg-muted active:scale-[0.97]",
  danger:
    "border-2 border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15 active:scale-[0.97]",
};

const sizeStyles = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 font-semibold outline-none transition-all focus-visible:ring-2 focus-visible:ring-charcoal focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
