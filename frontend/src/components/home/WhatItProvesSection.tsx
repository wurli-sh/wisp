import { motion } from "framer-motion";
import { PAGE_MAX } from "@/config/layout";
import { COPY } from "@/content/copy";
import { cn } from "@/lib/cn";
import { HighlightedText } from "@/components/spell/highlighted-text";
import { fadeInUp, scrollViewport, staggerContainer } from "@/lib/animations";

export function WhatItProvesSection() {
  const { whatItProves } = COPY;

  return (
    <section id="what-it-proves" className="py-20">
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
            {whatItProves.eyebrow}
          </motion.p>
          <motion.h2
            variants={fadeInUp}
            className="mt-3 text-3xl font-bold text-primary sm:text-4xl"
          >
            {whatItProves.headline}{" "}
            <HighlightedText variant="primary" from="bottom" inView delay={0.08}>
              One proof.
            </HighlightedText>
          </motion.h2>
          <motion.p variants={fadeInUp} className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground">
            {whatItProves.sub}
          </motion.p>
        </motion.div>

        <motion.ul
          initial="hidden"
          whileInView="visible"
          viewport={scrollViewport}
          variants={staggerContainer}
          className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          {whatItProves.checks.map((check) => (
            <motion.li
              key={check.name}
              variants={fadeInUp}
              className="border border-border bg-card p-4 shadow-soft"
            >
              <p className="text-sm font-bold text-foreground">{check.name}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{check.detail}</p>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
