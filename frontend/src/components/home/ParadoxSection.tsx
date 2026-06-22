import { motion } from "framer-motion";
import { Check, Eye, Lock, ShieldCheck } from "lucide-react";
import { PAGE_MAX } from "@/config/layout";
import { COPY } from "@/content/copy";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { HighlightedText } from "@/components/spell/highlighted-text";
import { fadeInUp, scrollViewport, staggerContainer } from "@/lib/animations";

function ComparisonRow({
  field,
  value,
  tone,
  status,
}: {
  field: string;
  value: string;
  tone: "danger" | "safe";
  status: "exposed" | "public" | "proven";
}) {
  const isDanger = tone === "danger";

  return (
    <li
      className={cn(
        "flex flex-col gap-2 border-b px-4 py-3 last:border-b-0 sm:grid sm:h-11 sm:grid-cols-[4.75rem_minmax(0,1fr)_5.5rem] sm:items-center sm:gap-x-2 sm:py-0",
        isDanger ? "border-destructive/15" : "border-primary/10",
      )}
    >
      <div className="flex items-center justify-between gap-2 sm:contents">
        <span className="text-xs font-medium text-muted-foreground">{field}</span>
        <div className="flex shrink-0 items-center justify-end sm:order-3 sm:w-20">
          {status === "exposed" && (
            <span className="inline-flex shrink-0 items-center gap-1 border border-destructive/25 bg-destructive/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-destructive">
              <Eye size={10} strokeWidth={2.5} aria-hidden />
              exposed
            </span>
          )}
          {status === "public" && (
            <Check size={14} className="shrink-0 text-success" strokeWidth={2.5} aria-hidden />
          )}
          {status === "proven" && (
            <Lock size={13} className="shrink-0 text-primary" strokeWidth={2.5} aria-hidden />
          )}
        </div>
      </div>
      <span
        className={cn(
          "text-left text-xs font-semibold tabular-nums sm:text-right",
          isDanger && "text-destructive",
          !isDanger && status === "public" && "text-foreground",
          !isDanger && status === "proven" && "text-primary",
        )}
      >
        {value}
      </span>
    </li>
  );
}

const COMPARISON_LIST_CLASS =
  "mt-3 overflow-hidden border-2 bg-background shadow-soft";

type ComparisonRowData = {
  readonly field: string;
  readonly value: string;
  readonly revealed?: boolean;
};

function ComparisonCard({
  tone,
  icon,
  label,
  tagline,
  pill,
  badgeVariant,
  rows,
  motionX,
  delay = 0,
}: {
  tone: "danger" | "safe";
  icon: React.ReactNode;
  label: string;
  tagline: string;
  pill: string;
  badgeVariant: "danger" | "success";
  rows: readonly ComparisonRowData[];
  motionX: number;
  delay?: number;
}) {
  const isDanger = tone === "danger";

  return (
    <motion.article
      initial={{ opacity: 0, x: motionX }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={scrollViewport}
      transition={{ delay }}
      className={cn(
        "flex h-full flex-col border-2 bg-linear-to-b to-background",
        isDanger
          ? "border-destructive/20 from-destructive/[0.07] shadow-soft"
          : "border-primary/20 from-primary-soft/80 shadow-card",
      )}
    >
      <div className="flex flex-1 flex-col p-6 sm:p-4">
        <div className="flex min-h-17 items-start gap-3">
          <span
            className={cn(
              "inline-flex h-9 w-9 shrink-0 items-center justify-center border-2",
              isDanger
                ? "border-destructive/25 bg-destructive/10 text-destructive"
                : "border-primary/25 bg-primary-soft text-primary",
            )}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <h3
              className={cn(
                "text-sm font-bold uppercase tracking-wider",
                isDanger ? "text-destructive" : "text-primary",
              )}
            >
              {label}
            </h3>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {tagline}
            </p>
          </div>
        </div>

        <ul
          className={cn(
            COMPARISON_LIST_CLASS,
            isDanger ? "border-destructive/15" : "border-primary/15",
          )}
        >
          {rows.map((row) => (
            <ComparisonRow
              key={row.field}
              field={row.field}
              value={row.value}
              tone={tone}
              status={
                isDanger ? "exposed" : row.revealed ? "public" : "proven"
              }
            />
          ))}
        </ul>

        <div className="mt-auto pt-6">
          <Badge variant={badgeVariant}>{pill}</Badge>
        </div>
      </div>
    </motion.article>
  );
}

export function ParadoxSection() {
  const { paradoxAct } = COPY;

  return (
    <section className="relative overflow-hidden bg-background py-16 sm:py-28 md:py-32">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        aria-hidden
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--color-border) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "linear-gradient(to bottom, black 0%, transparent 85%)",
        }}
      />

      <div className={cn("relative mx-auto px-4 sm:px-6", PAGE_MAX)}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={scrollViewport}
          variants={staggerContainer}
          className="text-center"
        >
          <motion.p
            variants={fadeInUp}
            className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
          >
            {paradoxAct.eyebrow}
          </motion.p>
          <motion.h2
            variants={fadeInUp}
            className="mt-4 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            {paradoxAct.headline}{" "}
            <HighlightedText variant="sky" from="bottom" inView delay={0.06}>
              {paradoxAct.headlineAccent}
            </HighlightedText>
          </motion.h2>
        </motion.div>

        <div className="relative mt-16">
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 lg:block"
            aria-hidden
          >
            <span className="inline-flex h-10 w-10 items-center justify-center border-2 border-border-strong bg-background text-[10px] font-bold uppercase tracking-wider text-muted-foreground shadow-soft">
              vs
            </span>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-8">
            <ComparisonCard
              tone="danger"
              icon={<Eye size={16} strokeWidth={2} aria-hidden />}
              label={paradoxAct.withoutZk.label}
              tagline={paradoxAct.withoutZk.tagline}
              pill={paradoxAct.withoutZk.pill}
              badgeVariant="danger"
              rows={paradoxAct.withoutZk.rows}
              motionX={-16}
            />

            <ComparisonCard
              tone="safe"
              icon={<ShieldCheck size={16} strokeWidth={2} aria-hidden />}
              label={paradoxAct.withZk.label}
              tagline={paradoxAct.withZk.tagline}
              pill={paradoxAct.withZk.pill}
              badgeVariant="success"
              rows={paradoxAct.withZk.rows}
              motionX={16}
              delay={0.08}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
