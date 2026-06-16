import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { COPY } from "@/content/copy";
import { HighlightedText } from "@/components/spell/highlighted-text";
import { Button } from "@/components/ui/Button";
import {
  buttonHover,
  buttonTap,
  fadeInUp,
  staggerContainer,
} from "@/lib/animations";

const TRUST_CHIPS = ["Stellar testnet", "Groth16 BN254", "8 checks · 1 proof"] as const;

export function Hero() {
  return (
    <section className="relative flex min-h-[calc(100dvh-5.5rem)] items-center justify-center overflow-hidden bg-background py-16">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 flex justify-center px-4 sm:px-6">
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center px-4 text-center sm:px-6">
        <motion.div
          className="flex w-full flex-col items-center"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.div
            className="mb-6 inline-flex items-center gap-2.5 border-2 border-primary/20 bg-primary-soft px-3.5 py-2 text-sm font-medium text-primary"
            variants={fadeInUp}
          >
            <div className="size-3.5 shrink-0 bg-primary-bright shadow-blue-pill" />
            {COPY.hero.eyebrow}
          </motion.div>

          <motion.h1
            className="text-balance text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl"
            variants={fadeInUp}
          >
            {COPY.hero.headlineLead}{" "}
            <HighlightedText variant="primary" from="bottom" delay={0.12}>
              {COPY.hero.headlineAccent}
            </HighlightedText>
          </motion.h1>

          <motion.p
            className="mt-6 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg"
            variants={fadeInUp}
          >
            {COPY.hero.sub}
          </motion.p>

          <motion.p
            className="mt-4 text-sm font-medium text-primary"
            variants={fadeInUp}
          >
            {COPY.paradoxAct.closer}
          </motion.p>

          <motion.div
            className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4"
            variants={fadeInUp}
          >
            <Link to={COPY.hero.ctas.primary.href}>
              <motion.div whileHover={buttonHover} whileTap={buttonTap}>
                <Button size="lg" variant="secondary">
                  {COPY.hero.ctas.primary.label}
                </Button>
              </motion.div>
            </Link>
            <a href={COPY.hero.ctas.secondary.href}>
              <motion.div whileHover={buttonHover} whileTap={buttonTap}>
                <Button size="lg" variant="outline">
                  {COPY.hero.ctas.secondary.label}
                </Button>
              </motion.div>
            </a>
          </motion.div>

          <motion.ul
            className="mt-8 flex flex-wrap items-center justify-center gap-2"
            variants={fadeInUp}
          >
            {TRUST_CHIPS.map((chip) => (
              <li
                key={chip}
                className="border border-border bg-card/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground shadow-soft backdrop-blur-sm"
              >
                {chip}
              </li>
            ))}
          </motion.ul>
        </motion.div>
      </div>
    </section>
  );
}
