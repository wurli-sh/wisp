import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { PAGE_MAX } from "@/config/layout";
import { COPY } from "@/content/copy";
import { cn } from "@/lib/cn";
import { TiltCard } from "@/components/spell/tilt-card";
import { HighlightedText } from "@/components/spell/highlighted-text";
import { fadeInUp, scrollViewport, staggerContainer } from "@/lib/animations";

function ComplianceVisaCard() {
  const { card } = COPY.complianceCard;

  return (
    <TiltCard
      tiltLimit={8}
      scale={1.015}
      perspective={1400}
      effect="evade"
      spotlight
      className="mx-auto w-full max-w-[420px]"
    >
      <div className="relative aspect-[1.586/1] w-full overflow-hidden border-2 border-white/8 bg-linear-to-br from-[#161616] via-[#101010] to-[#090909] p-8 text-white shadow-elev">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "linear-gradient(145deg, rgba(255,255,255,0.06) 0%, transparent 38%, rgba(0,0,0,0.24) 100%)",
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-white/[0.03] via-transparent to-black/20" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />

        <div className="relative z-10 flex h-full flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <ShieldCheck size={18} className="text-white/75" strokeWidth={1.5} />
              <p className="text-lg font-bold italic tracking-tight text-primary-bright">
                {card.brand}
              </p>
            </div>
            <span className="text-sm font-bold italic tracking-tight text-white/90">
              {card.network}
            </span>
          </div>

          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="text-[11px] text-white/45">{card.holder}</p>
              <p className="mt-2 text-base font-medium tracking-[0.18em] text-white md:text-lg">
                {card.pan}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] text-white/45">{card.corridor}</p>
              <p className="mt-2 text-lg font-medium tabular-nums text-white">{card.status}</p>
            </div>
          </div>
        </div>
      </div>
    </TiltCard>
  );
}

export function ComplianceCardSection() {
  const { complianceCard } = COPY;

  return (
    <section className="py-24">
      <div className={cn("mx-auto px-4 sm:px-6", PAGE_MAX)}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={scrollViewport}
          variants={staggerContainer}
          className="text-center"
        >
          <motion.h2
            variants={fadeInUp}
            className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            {complianceCard.headline}
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="mx-auto mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base"
          >
            {complianceCard.subLead}{" "}
            <HighlightedText variant="soft" from="bottom" inView>
              {complianceCard.subAccent}
            </HighlightedText>{" "}
            {complianceCard.subTail}
          </motion.p>
        </motion.div>

        <motion.div
          className="mt-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={scrollViewport}
        >
          <ComplianceVisaCard />
        </motion.div>

        <motion.ul
          initial="hidden"
          whileInView="visible"
          viewport={scrollViewport}
          variants={staggerContainer}
          className="mt-12 grid gap-4 border-2 border-border bg-card p-6 md:grid-cols-3"
        >
          {complianceCard.perks.map((perk) => (
            <motion.li key={perk.label} variants={fadeInUp} className="text-center md:text-left">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {perk.label}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
                {perk.detail}
              </p>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
