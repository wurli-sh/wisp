import { motion } from "framer-motion";
import { Globe2, Scale, type LucideIcon } from "lucide-react";
import { BRAND_IMAGES } from "@/config/brand";
import { PAGE_MAX } from "@/config/layout";
import { COPY } from "@/content/copy";
import { cn } from "@/lib/cn";
import { HighlightedText } from "@/components/spell/highlighted-text";
import { ImageWithSkeleton } from "@/components/ui/ImageWithSkeleton";
import { fadeInUp, scrollViewport, staggerContainer } from "@/lib/animations";

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
          className="border-2 border-border bg-muted/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground transition-colors duration-300 group-hover:border-brand-sky/50 group-hover:bg-primary group-hover:text-brand-sky"
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
    <section className="bg-background py-16 sm:py-28 md:py-32">
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
            {builders.eyebrow}
          </motion.p>
          <motion.h2
            variants={fadeInUp}
            className="mt-4 text-3xl font-bold text-foreground sm:text-4xl"
          >
            {builders.headlineRest}{" "}
            <HighlightedText variant="sky" from="bottom" inView delay={0.08}>
              {builders.headlineAccent}
            </HighlightedText>
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base"
          >
            {builders.sub}
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={scrollViewport}
          className="mx-auto mt-12 max-w-2xl overflow-hidden border-2 border-border shadow-card"
        >
          <ImageWithSkeleton
            src={BRAND_IMAGES.stableCoins.src}
            alt={BRAND_IMAGES.stableCoins.alt}
            width={BRAND_IMAGES.stableCoins.width}
            height={BRAND_IMAGES.stableCoins.height}
          />
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={scrollViewport}
          variants={staggerContainer}
          className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-2"
        >
          {builders.benefits.map((market, index) => {
            const { icon: Icon } = BENTO[index];
            const isFeatured = index === 0;

            return (
              <motion.article
                key={market.name}
                variants={fadeInUp}
                transition={{ delay: index * 0.05 }}
                className="group relative flex min-h-[168px] flex-col overflow-hidden border-2 border-border bg-card p-5 shadow-soft transition-[background-color,border-color,box-shadow] duration-300 hover:border-primary-dark hover:bg-primary-dark hover:shadow-card"
              >
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

                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground transition-colors duration-300 group-hover:text-white/75">
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
