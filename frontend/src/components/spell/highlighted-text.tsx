import { motion } from "framer-motion";
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
  once?: boolean;
}

const fromVariants = {
  left: { hidden: { x: "-100%" }, visible: { x: "0%" } },
  right: { hidden: { x: "100%" }, visible: { x: "0%" } },
  top: { hidden: { y: "-100%" }, visible: { y: "0%" } },
  bottom: { hidden: { y: "100%" }, visible: { y: "0%" } },
};

const variantStyles: Record<HighlightVariant, { highlight: string; text: string }> = {
  bright: {
    highlight: "bg-primary-bright",
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
    highlight: "bg-[#D8F1FF]",
    text: "text-primary",
  },
};

export function HighlightedText({
  children,
  className,
  from = "bottom",
  variant = "bright",
  delay = 0,
  inView = false,
  once = true,
}: HighlightedTextProps) {
  const variants = fromVariants[from];
  const styles = variantStyles[variant];

  return (
    <motion.span
      className={cn("relative inline-flex overflow-hidden align-baseline", className)}
      initial="hidden"
      whileInView={inView ? "visible" : undefined}
      animate={inView ? undefined : "visible"}
      viewport={{ once, amount: 0.4 }}
    >
      <motion.span
        className={cn(
          "absolute inset-0 -left-[0.15em] -right-[0.18em] z-0",
          styles.highlight,
        )}
        variants={variants}
        transition={{
          type: "spring",
          damping: 30,
          stiffness: 300,
          delay,
        }}
      />
      <span className={cn("relative z-10 pl-[0.15em] pr-[0.18em] font-bold", styles.text)}>
        {children}
      </span>
    </motion.span>
  );
}
