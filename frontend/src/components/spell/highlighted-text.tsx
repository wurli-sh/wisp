import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { cn } from "@/lib/cn";

type From = "left" | "right" | "top" | "bottom";

export type HighlightVariant = "bright" | "primary" | "soft" | "sky";

interface HighlightedTextProps {
  children: React.ReactNode;
  className?: string;
  from?: From;
  variant?: HighlightVariant;
  delay?: number;
  inView?: boolean;
  active?: boolean;
  once?: boolean;
}

const FROM_OFFSET: Record<From, { x?: string; y?: string }> = {
  left: { x: "-100%" },
  right: { x: "100%" },
  top: { y: "-100%" },
  bottom: { y: "100%" },
};

const variantStyles: Record<HighlightVariant, { highlight: string; text: string }> = {
  bright: {
    highlight: "bg-primary-dark",
    text: "text-primary-foreground",
  },
  primary: {
    highlight: "bg-primary",
    text: "text-primary-foreground",
  },
  soft: {
    highlight: "bg-primary-soft",
    text: "text-primary",
  },
  sky: {
    highlight: "bg-brand",
    text: "text-brand-foreground",
  },
};

export function HighlightedText({
  children,
  className,
  from = "bottom",
  variant = "bright",
  delay = 0,
  inView = false,
  active,
  once = true,
}: HighlightedTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, {
    once,
    amount: 0.4,
  });
  const shouldAnimate =
    active !== undefined ? active : inView ? isInView : true;
  const styles = variantStyles[variant];
  const offset = FROM_OFFSET[from];

  return (
    <span
      ref={ref}
      className={cn("relative inline-flex overflow-hidden align-baseline", className)}
    >
      <motion.span
        aria-hidden
        className={cn(
          "absolute inset-0 -left-[0.15em] -right-[0.18em] z-0",
          styles.highlight,
        )}
        initial={offset}
        animate={shouldAnimate ? { x: "0%", y: "0%" } : offset}
        transition={{
          type: "spring",
          damping: 30,
          stiffness: 300,
          delay: shouldAnimate ? delay : 0,
        }}
      />
      <span className={cn("relative z-10 pl-[0.15em] pr-[0.18em] font-bold", styles.text)}>
        {children}
      </span>
    </span>
  );
}
