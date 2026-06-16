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
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b px-4 py-3 last:border-b-0",
        isDanger ? "border-destructive/15" : "border-primary/10",
      )}
    >
      <span className="text-xs font-medium text-muted-foreground">{field}</span>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "max-w-[180px] truncate text-right text-xs font-semibold tabular-nums sm:max-w-none",
            isDanger && "text-destructive",
            !isDanger && status === "public" && "text-foreground",
            !isDanger && status === "proven" && "text-primary",
          )}
        >
          {value}
        </span>
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
    </li>
  );
}

export function ParadoxSection() {
  const { paradoxAct } = COPY;

  return (
    <section className="relative overflow-hidden bg-background py-24">
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
            <HighlightedText variant="primary" from="bottom" inView delay={0.06}>
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

          <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
            <motion.article
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={scrollViewport}
              className="flex flex-col border-2 border-destructive/20 bg-linear-to-b from-destructive/[0.07] to-background shadow-soft"
            >
              <div className="h-1 bg-destructive" aria-hidden />
              <div className="flex flex-1 flex-col p-6 sm:p-7">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center border-2 border-destructive/25 bg-destructive/10 text-destructive">
                    <Eye size={16} strokeWidth={2} aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-destructive">
                      {paradoxAct.withoutZk.label}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">{paradoxAct.withoutZk.tagline}</p>
                  </div>
                </div>

                <ul className="mt-6 overflow-hidden border-2 border-destructive/15 bg-background/90 shadow-soft">
                  {paradoxAct.withoutZk.rows.map((row, i) => (
                    <motion.li
                      key={row.field}
                      initial={{ opacity: 0, x: -8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={scrollViewport}
                      transition={{ delay: i * 0.05 }}
                    >
                      <ComparisonRow
                        field={row.field}
                        value={row.value}
                        tone="danger"
                        status="exposed"
                      />
                    </motion.li>
                  ))}
                </ul>

                <div className="mt-6">
                  <Badge variant="danger">{paradoxAct.withoutZk.pill}</Badge>
                </div>
              </div>
            </motion.article>

            <motion.article
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={scrollViewport}
              transition={{ delay: 0.08 }}
              className="flex flex-col border-2 border-primary/20 bg-linear-to-b from-primary-soft/80 to-background shadow-card"
            >
              <div className="h-1 bg-primary" aria-hidden />
              <div className="flex flex-1 flex-col p-6 sm:p-7">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center border-2 border-primary/25 bg-primary-soft text-primary">
                    <ShieldCheck size={16} strokeWidth={2} aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
                      {paradoxAct.withZk.label}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">{paradoxAct.withZk.tagline}</p>
                  </div>
                </div>

                <ul className="mt-6 overflow-hidden border-2 border-primary/15 bg-background shadow-card">
                  {paradoxAct.withZk.rows.map((row, i) => (
                    <motion.li
                      key={row.field}
                      initial={{ opacity: 0, x: 8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={scrollViewport}
                      transition={{ delay: i * 0.05 }}
                    >
                      <ComparisonRow
                        field={row.field}
                        value={row.value}
                        tone="safe"
                        status={row.revealed ? "public" : "proven"}
                      />
                    </motion.li>
                  ))}
                </ul>

                <div className="mt-6 space-y-3">
                  <Badge variant="success">{paradoxAct.withZk.pill}</Badge>
                  <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                    {paradoxAct.withZk.caption}
                  </p>
                </div>
              </div>
            </motion.article>
          </div>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={scrollViewport}
          className="mt-14 text-center text-lg font-medium text-primary"
        >
          Compliance and privacy —{" "}
          <HighlightedText variant="soft" from="left" inView>
            one proof.
          </HighlightedText>
        </motion.p>
      </div>
    </section>
  );
}
