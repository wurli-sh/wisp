import { motion } from "framer-motion";
import { PAGE_MAX } from "@/config/layout";
import { COPY } from "@/content/copy";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/ui/Logo";
import { TiltCard } from "@/components/spell/tilt-card";
import { HighlightedText } from "@/components/spell/highlighted-text";
import { sectionReveal, sectionStagger, useSectionReveal } from "@/hooks/useSectionReveal";

type IssuerTheme = "us" | "eu";

type Issuer = (typeof COPY.wispPayShowcase.issuers)[number];

const THEME: Record<
  IssuerTheme,
  {
    shell: string;
    glow: string;
    region: string;
    tag: string;
    rowBorder: string;
    rowLabel: string;
    rowValue: string;
  }
> = {
  us: {
    shell:
      "border-brand-dark bg-linear-to-br from-brand via-brand-dark to-[#1F4FB0] text-white",
    glow: "bg-white/15",
    region: "text-white/70",
    tag: "bg-white/15 text-white",
    rowBorder: "border-white/15",
    rowLabel: "text-white/60",
    rowValue: "text-white",
  },
  eu: {
    shell:
      "border-inverse-border bg-linear-to-br from-charcoal-panel via-charcoal to-charcoal-soft text-inverse-foreground",
    glow: "bg-brand-sky/15",
    region: "text-inverse-muted",
    tag: "bg-white/10 text-inverse-foreground",
    rowBorder: "border-white/10",
    rowLabel: "text-inverse-muted",
    rowValue: "text-white",
  },
} as const;

function IssuerCard({ issuer }: { issuer: Issuer }) {
  const t = THEME[issuer.theme];

  return (
    <TiltCard
      tiltLimit={6}
      scale={1.01}
      perspective={1200}
      effect="evade"
      spotlight
      className="w-full"
    >
      <div
        className={cn(
          "relative h-full overflow-hidden border-2 p-6 shadow-elev sm:p-7",
          t.shell,
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-2xl",
            t.glow,
          )}
        />

        <div className="relative z-10 flex h-full flex-col">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Logo size="sm" tone="light" />
              <div>
                <p className="text-sm font-semibold tracking-tight">{issuer.name}</p>
                <p className={cn("text-xs", t.region)}>{issuer.region}</p>
              </div>
            </div>
            <span
              className={cn(
                "px-2 py-1 text-[10px] font-bold uppercase tracking-widest",
                t.tag,
              )}
            >
              {issuer.tag}
            </span>
          </div>

          <p className={cn("mt-3 font-mono text-[11px] tracking-tight", t.region)}>
            {issuer.address}
          </p>

          <dl className="mt-6 space-y-0">
            {issuer.rows.map((row) => (
              <div
                key={row.label}
                className={cn(
                  "flex items-center justify-between gap-4 border-t py-2.5",
                  t.rowBorder,
                )}
              >
                <dt
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-widest",
                    t.rowLabel,
                  )}
                >
                  {row.label}
                </dt>
                <dd
                  className={cn(
                    "truncate text-right text-sm font-medium tabular-nums",
                    t.rowValue,
                  )}
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </TiltCard>
  );
}

export function WispPayShowcaseSection() {
  const { wispPayShowcase } = COPY;
  const { sectionRef, showContent } = useSectionReveal();

  return (
    <section className="py-16 sm:py-28 md:py-32">
      <div className={cn("mx-auto px-4 sm:px-6", PAGE_MAX)}>
        <motion.div
          ref={sectionRef}
          initial={false}
          animate={showContent ? "visible" : "hidden"}
          variants={sectionStagger}
        >
          <motion.div variants={sectionReveal} className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {wispPayShowcase.eyebrow}
            </p>
            <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              <HighlightedText variant="sky" from="bottom" active={showContent} delay={0.18}>
                {wispPayShowcase.headlineAccent}
              </HighlightedText>{" "}
              {wispPayShowcase.headlineRest}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-sm text-muted-foreground sm:text-base">
              {wispPayShowcase.sub}
            </p>
          </motion.div>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {wispPayShowcase.issuers.map((issuer) => (
              <motion.div key={issuer.tag} variants={sectionReveal} className="h-full">
                <IssuerCard issuer={issuer} />
              </motion.div>
            ))}
          </div>

          <ul className="mt-6 grid gap-px border-2 border-border bg-border md:grid-cols-3">
            {wispPayShowcase.perks.map((perk) => (
              <motion.li
                key={perk.label}
                variants={sectionReveal}
                className="bg-card px-5 py-4 text-center md:text-left"
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {perk.label}
                </p>
                <p className="mt-1.5 text-sm text-muted-foreground">{perk.detail}</p>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  );
}
