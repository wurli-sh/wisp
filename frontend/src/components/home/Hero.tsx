import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Dithering } from "@paper-design/shaders-react";
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
      <motion.div
        className="pointer-events-none absolute bottom-0 left-1/2 z-0 h-[45%] w-full max-w-4xl -translate-x-1/2 px-4 sm:px-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5, delay: 0.2 }}
      >
        <Dithering
          style={{ height: "100%", width: "100%" }}
          colorBack="#2525AA"
          colorFront="#FFFFFF"
          shape="simplex"
          type="4x4"
          scale={0.5}
          speed={0.02}
        />
      </motion.div>

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
            <HighlightedText variant="primary" from="bottom" delay={0.12} className="whitespace-nowrap">
              {COPY.hero.headlineAccent}
            </HighlightedText>
          </motion.h1>

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
