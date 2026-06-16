import { motion } from "framer-motion";
import { PAGE_MAX } from "@/config/layout";
import { COPY } from "@/content/copy";
import { cn } from "@/lib/cn";
import { HighlightedText } from "@/components/spell/highlighted-text";
import { fadeInUp, scrollViewport, staggerContainer } from "@/lib/animations";

export function EngineSection() {
  const { engine } = COPY;

  return (
    <section id="how-it-works" className="py-20">
      <div className={cn("mx-auto px-4 sm:px-6", PAGE_MAX)}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={scrollViewport}
          variants={staggerContainer}
          className="mb-12 text-center"
        >
          <motion.p
            variants={fadeInUp}
            className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
          >
            {engine.eyebrow}
          </motion.p>
          <motion.h2
            variants={fadeInUp}
            className="mt-3 text-3xl font-bold text-primary sm:text-4xl"
          >
            Verify once. Prove anywhere.{" "}
            <HighlightedText variant="primary" from="bottom" inView delay={0.08}>
              Settle forever.
            </HighlightedText>
          </motion.h2>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3 md:items-stretch">
          {engine.chapters.map((chapter, index) => (
            <motion.article
              key={chapter.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={scrollViewport}
              transition={{ delay: index * 0.08 }}
              className="flex h-full flex-col border-2 border-border bg-background p-5 shadow-soft"
            >
              <p className="min-h-[14px] text-[10px] font-bold uppercase tracking-widest text-primary-bright">
                {chapter.kicker}
              </p>
              <h3 className="mt-2 min-h-[28px] text-lg font-bold text-primary">
                {chapter.title}
              </h3>
              <p className="mt-3 min-h-[80px] flex-1 text-sm leading-relaxed text-muted-foreground">
                {chapter.body}
              </p>
              <dl className="mt-5 grid grid-cols-2 gap-2">
                {chapter.benchmarks.map((b) => (
                  <div
                    key={b.label}
                    className="flex min-h-[56px] flex-col justify-center border-2 border-border bg-muted/50 p-2.5"
                  >
                    <dt className="text-base font-bold leading-none text-primary">{b.value}</dt>
                    <dd className="mt-1 min-h-[24px] text-[10px] uppercase leading-tight tracking-wide text-muted-foreground">
                      {b.label}
                    </dd>
                  </div>
                ))}
              </dl>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
