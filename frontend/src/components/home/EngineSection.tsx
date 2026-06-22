import { motion } from "framer-motion";
import { COPY } from "@/content/copy";
import { cn } from "@/lib/cn";
import { HighlightedText } from "@/components/spell/highlighted-text";
import { sectionReveal, sectionStagger, useSectionReveal } from "@/hooks/useSectionReveal";
import { EnginePipeline } from "./engine/EnginePipeline";

export function EngineSection() {
  const { engine } = COPY;
  const { sectionRef, showContent } = useSectionReveal();

  return (
    <section id="how-it-works" className="overflow-hidden py-16 sm:py-28 md:py-32">
      <div className={cn("mx-auto max-w-6xl px-4 sm:px-6")}>
        <motion.div
          ref={sectionRef}
          initial={false}
          animate={showContent ? "visible" : "hidden"}
          variants={sectionStagger}
        >
          <motion.div variants={sectionReveal} className="mb-12 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {engine.eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-bold text-charcoal sm:text-4xl">
              {engine.headlineLead}{" "}
              <HighlightedText variant="sky" from="bottom" active={showContent} delay={0.18}>
                {engine.headlineAccent}
              </HighlightedText>
            </h2>
          </motion.div>

          <motion.div variants={sectionReveal}>
            <EnginePipeline />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
