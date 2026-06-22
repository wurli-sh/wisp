import { motion } from "framer-motion";
import { Globe2, Scale, type LucideIcon } from "lucide-react";
import { BRAND_IMAGES } from "@/config/brand";
import { PAGE_MAX } from "@/config/layout";
import { COPY } from "@/content/copy";
import { cn } from "@/lib/cn";
import { HighlightedText } from "@/components/spell/highlighted-text";
import { ImageWithSkeleton } from "@/components/ui/ImageWithSkeleton";
import { sectionReveal, sectionStagger, useSectionReveal } from "@/hooks/useSectionReveal";

const BENTO: ReadonlyArray<{ icon: LucideIcon }> = [
  { icon: Globe2 },
  { icon: Scale },
];

function MarketTags({ tags }: { tags: readonly string[] }) {
  return (
    <ul className="mt-4 flex flex-wrap gap-2">
      {tags.map((tag) => (
        <li
          key={tag}
          className="border-2 border-border bg-muted/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground transition-[border-color,background-color,color] duration-300 group-hover:border-brand/35 group-hover:bg-white group-hover:text-brand"
        >
          {tag}
        </li>
      ))}
    </ul>
  );
}

export function UseCasesSection() {
  const { builders } = COPY;
  const { sectionRef, showContent } = useSectionReveal();

  return (
    <section className="bg-background py-16 sm:py-28 md:py-32">
      <div className={cn("mx-auto px-4 sm:px-6", PAGE_MAX)}>
        <motion.div
          ref={sectionRef}
          initial={false}
          animate={showContent ? "visible" : "hidden"}
          variants={sectionStagger}
        >
          <motion.div variants={sectionReveal} className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {builders.eyebrow}
            </p>
            <h2 className="mt-4 text-3xl font-bold text-foreground sm:text-4xl">
              {builders.headlineRest}{" "}
              <HighlightedText variant="sky" from="bottom" active={showContent} delay={0.18}>
                {builders.headlineAccent}
              </HighlightedText>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {builders.sub}
            </p>
          </motion.div>

          <motion.div
            variants={sectionReveal}
            className="mx-auto mt-12 max-w-2xl overflow-hidden border-2 border-border shadow-card"
          >
            <ImageWithSkeleton
              src={BRAND_IMAGES.stableCoins.src}
              alt={BRAND_IMAGES.stableCoins.alt}
              width={BRAND_IMAGES.stableCoins.width}
              height={BRAND_IMAGES.stableCoins.height}
            />
          </motion.div>

          <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-2">
            {builders.benefits.map((market, index) => {
              const { icon: Icon } = BENTO[index];
              const isFeatured = index === 0;

              return (
                <motion.article
                  key={market.name}
                  variants={sectionReveal}
                  className="group relative flex min-h-[168px] flex-col overflow-hidden border-2 border-border bg-card p-5 shadow-soft transition-[border-color,box-shadow,background-color] duration-300 hover:border-brand/50 hover:bg-brand-soft/35 hover:shadow-card"
                >
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-brand transition-transform duration-300 group-hover:scale-x-100 motion-reduce:transition-none"
                    aria-hidden
                  />

                  <div className="relative z-10 flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <Icon
                        size={26}
                        strokeWidth={1.5}
                        className="shrink-0 text-primary transition-colors duration-300 group-hover:text-brand"
                      />
                      <div className="text-right">
                        <p className="text-xl font-bold leading-none text-primary transition-colors duration-300 group-hover:text-brand-dark">
                          {market.stat}
                        </p>
                        <p className="mt-1 max-w-[120px] text-[10px] font-bold uppercase tracking-wide text-muted-foreground transition-colors duration-300 group-hover:text-brand">
                          {market.statLabel}
                        </p>
                      </div>
                    </div>

                    <h3 className="mt-4 text-base font-bold text-primary transition-colors duration-300 group-hover:text-brand-dark">
                      {market.name}
                    </h3>

                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground transition-colors duration-300 group-hover:text-foreground/80">
                      {market.body}
                    </p>

                    <MarketTags tags={market.tags} />

                    {isFeatured && (
                      <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-colors duration-300 group-hover:text-brand">
                        {builders.featuredNote}
                      </p>
                    )}
                  </div>
                </motion.article>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
