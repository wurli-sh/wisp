import { cn } from "@/lib/cn";
import { CARD_BODY_H, CARD_FOOTER_H, CARD_H, CENTER_CARD_W, SIDE_CARD_W } from "./constants";

type PipelineCardShellProps = {
  variant?: "side" | "center";
  active?: boolean;
  cardRef?: React.RefObject<HTMLDivElement | null>;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
};

export function PipelineCardShell({
  variant = "side",
  active = false,
  cardRef,
  className,
  style,
  children,
}: PipelineCardShellProps) {
  const isCenter = variant === "center";

  return (
    <div
      ref={cardRef}
      style={{
        width: isCenter ? CENTER_CARD_W : SIDE_CARD_W,
        height: CARD_H,
        ...style,
      }}
      className={cn(
        "flex shrink-0 flex-col border-2 bg-background p-4 shadow-soft",
        isCenter ? "border-primary/40 bg-card shadow-card" : "border-border",
        active && isCenter && "border-primary-dark shadow-blue-pill",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PipelineCardBody({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn("relative mt-3 overflow-hidden border-2 border-border bg-muted/40 p-3", className)}
      style={{ height: CARD_BODY_H, ...style }}
    >
      {children}
    </div>
  );
}

export function PipelineCardFooter({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <p
      className={cn(
        "mt-auto flex items-center justify-center text-center text-xs font-semibold text-primary",
        className,
      )}
      style={{ height: CARD_FOOTER_H, ...style }}
    >
      {children}
    </p>
  );
}
