import { motion } from "framer-motion";
import { COPY } from "@/content/copy";
import { cn } from "@/lib/cn";
import { HighlightedText } from "@/components/spell/highlighted-text";
import { fadeInUp, scrollViewport, staggerContainer } from "@/lib/animations";
import { EnginePipeline } from "./engine/EnginePipeline";

export function EngineSection() {
  const { engine } = COPY;

  return (
    <section id="how-it-works" className="overflow-hidden py-20">
      <div className={cn("mx-auto max-w-6xl px-4 sm:px-6")}>
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

        <EnginePipeline />
      </div>
    </section>
  );
}
