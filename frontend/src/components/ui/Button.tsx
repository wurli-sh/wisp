import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "outline" | "danger";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "pill-gradient bg-primary text-primary-foreground shadow-pill hover:bg-primary-dark active:scale-[0.97]",
  secondary:
    "pill-gradient bg-primary-bright text-primary-foreground shadow-blue-pill hover:opacity-90 active:scale-[0.97]",
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
        "inline-flex cursor-pointer items-center justify-center gap-2 font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
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
