import { motion } from "framer-motion";
import {
  Fingerprint,
  Globe2,
  Landmark,
  Scale,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { PAGE_MAX } from "@/config/layout";
import { COPY } from "@/content/copy";
import { cn } from "@/lib/cn";
import { HighlightedText } from "@/components/spell/highlighted-text";
import { fadeInUp, scrollViewport, staggerContainer } from "@/lib/animations";

const dotGrid = {
  backgroundImage: "radial-gradient(circle, color-mix(in srgb, var(--color-brand-sky) 70%, transparent) 1px, transparent 1px)",
  backgroundSize: "16px 16px",
};

const BENTO: ReadonlyArray<{
  icon: LucideIcon;
  className: string;
}> = [
  { icon: Globe2, className: "md:col-span-3" },
  { icon: Scale, className: "md:col-span-3" },
  { icon: TrendingUp, className: "md:col-span-2" },
  { icon: Fingerprint, className: "md:col-span-2" },
  { icon: Landmark, className: "md:col-span-2" },
];

function MarketTags({ tags }: { tags: readonly string[] }) {
  return (
    <ul className="mt-4 flex flex-wrap gap-2">
      {tags.map((tag) => (
        <li
          key={tag}
          className="border-2 border-border bg-muted/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground transition-colors duration-300 group-hover:border-brand-sky/30 group-hover:bg-primary-dark group-hover:text-brand-sky"
        >
          {tag}
        </li>
      ))}
    </ul>
  );
}

export function UseCasesSection() {
  const { builders } = COPY;

  return (
    <section className="bg-background py-28 md:py-32">
      <div className={cn("mx-auto px-4 sm:px-6", PAGE_MAX)}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={scrollViewport}
          variants={staggerContainer}
          className="mb-10 text-center"
        >
          <motion.p
            variants={fadeInUp}
            className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
          >
            {builders.eyebrow}
          </motion.p>
          <motion.h2
            variants={fadeInUp}
            className="mt-3 text-3xl font-bold text-foreground sm:text-4xl"
          >
            {builders.headlineRest}{" "}
            <HighlightedText variant="sky" from="bottom" inView delay={0.08}>
              {builders.headlineAccent}
            </HighlightedText>
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground"
          >
            {builders.sub}
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={scrollViewport}
          variants={staggerContainer}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-6"
        >
          {builders.benefits.map((market, index) => {
            const layout = BENTO[index];
            const Icon = layout.icon;
            const isFeatured = index === 0;

            return (
              <motion.article
                key={market.name}
                variants={fadeInUp}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "group relative flex min-h-[168px] flex-col overflow-hidden border-2 border-border bg-card p-5 shadow-soft transition-shadow duration-300 hover:shadow-card",
                  layout.className,
                )}
              >
                <div
                  className="absolute inset-0 translate-y-full bg-primary opacity-0 transition-[transform,opacity] duration-500 ease-out group-hover:translate-y-0 group-hover:opacity-100"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-25"
                  style={dotGrid}
                  aria-hidden
                />

                <div className="relative z-10 flex flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <Icon
                      size={26}
                      strokeWidth={1.5}
                      className="shrink-0 text-primary transition-colors duration-300 group-hover:text-brand-sky"
                    />
                    <div className="text-right">
                      <p className="text-xl font-bold leading-none text-primary transition-colors duration-300 group-hover:text-white">
                        {market.stat}
                      </p>
                      <p className="mt-1 max-w-[120px] text-[10px] font-bold uppercase tracking-wide text-muted-foreground transition-colors duration-300 group-hover:text-brand-sky">
                        {market.statLabel}
                      </p>
                    </div>
                  </div>

                  <h3 className="mt-4 text-base font-bold text-primary transition-colors duration-300 group-hover:text-white">
                    {market.name}
                  </h3>

                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground transition-colors duration-300 group-hover:text-brand-sky">
                    {market.body}
                  </p>

                  <MarketTags tags={market.tags} />

                  {isFeatured && (
                    <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-colors duration-300 group-hover:text-brand-sky">
                      {builders.featuredNote}
                    </p>
                  )}
                </div>
              </motion.article>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
