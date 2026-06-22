import { motion } from "framer-motion";
import { PAGE_MAX } from "@/config/layout";
import { COPY } from "@/content/copy";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/ui/Logo";
import { TiltCard } from "@/components/spell/tilt-card";
import { HighlightedText } from "@/components/spell/highlighted-text";
import { fadeInUp, scrollViewport, staggerContainer } from "@/lib/animations";

function WispPayCard() {
  const { card } = COPY.wispPayShowcase;

  return (
    <TiltCard
      tiltLimit={6}
      scale={1.01}
      perspective={1200}
      effect="evade"
      spotlight
      className="mx-auto w-full max-w-[400px]"
    >
      <div className="relative aspect-[1.586/1] w-full overflow-hidden border-2 border-inverse-border bg-linear-to-br from-charcoal-panel via-charcoal to-charcoal-soft shadow-elev">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(135deg, color-mix(in srgb, var(--color-brand-sky) 14%, transparent) 0%, transparent 50%, color-mix(in srgb, var(--color-charcoal-soft) 35%, transparent) 100%)",
          }}
        />
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand-sky/10 blur-2xl" />

        <div className="relative z-10 flex h-full flex-col p-6 text-inverse-foreground sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Logo size="sm" tone="light" />
              <span className="text-sm font-semibold tracking-tight">{card.brand}</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-inverse-muted">
              {card.corridor}
            </span>
          </div>

          <div className="mt-auto pt-6">
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold tabular-nums tracking-tight text-white sm:text-4xl">
                {card.amount}
              </p>
              <span className="text-xs font-bold uppercase tracking-widest text-inverse-muted">
                {card.currency}
              </span>
            </div>

            <div className="mt-5 flex items-end justify-between gap-4">
              <p className="truncate text-sm font-medium uppercase tracking-[0.12em] text-inverse-foreground">
                {card.merchant}
              </p>
            </div>
          </div>
        </div>
      </div>
    </TiltCard>
  );
}

export function WispPayShowcaseSection() {
  const { wispPayShowcase } = COPY;

  return (
    <section className="py-16 sm:py-28 md:py-32">
      <div className={cn("mx-auto px-4 sm:px-6", PAGE_MAX)}>
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
            {wispPayShowcase.eyebrow}
          </motion.p>
          <motion.h2
            variants={fadeInUp}
            className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            <HighlightedText variant="sky" from="bottom" inView delay={0.08}>
              {wispPayShowcase.headlineAccent}
            </HighlightedText>{" "}
            {wispPayShowcase.headlineRest}
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="mx-auto mt-3 max-w-xl text-pretty text-sm text-muted-foreground sm:text-base"
          >
            {wispPayShowcase.sub}
          </motion.p>
        </motion.div>

        <motion.div
          className="mt-12"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={scrollViewport}
        >
          <WispPayCard />
        </motion.div>

        <motion.ul
          initial="hidden"
          whileInView="visible"
          viewport={scrollViewport}
          variants={staggerContainer}
          className="mt-10 grid gap-px border-2 border-border bg-border md:grid-cols-3"
        >
          {wispPayShowcase.perks.map((perk) => (
            <motion.li key={perk.label} variants={fadeInUp} className="bg-card px-5 py-4 text-center md:text-left">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {perk.label}
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">{perk.detail}</p>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
