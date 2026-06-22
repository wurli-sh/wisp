import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { COPY } from "@/content/copy";
import { HighlightedText } from "@/components/spell/highlighted-text";
import { Button } from "@/components/ui/Button";
import { MD_UP, useMediaQuery } from "@/hooks/useMediaQuery";
import { buttonHover, buttonTap } from "@/lib/animations";

const HeroDitherSide = lazy(() =>
  import("@/components/home/HeroDitherSide").then((module) => ({
    default: module.HeroDitherSide,
  })),
);

const heroStagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
} as const;

const heroReveal = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.45, ease: "easeOut" },
  },
} as const;

export function Hero() {
  const { hero } = COPY;
  const showDither = useMediaQuery(MD_UP);
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative flex min-h-[calc(100svh-4.5rem)] items-center justify-center overflow-hidden bg-background pt-18 pb-12 sm:min-h-svh sm:pb-16 md:pb-20">
      {showDither && (
        <Suspense fallback={null}>
          <HeroDitherSide side="left" />
          <HeroDitherSide side="right" />
        </Suspense>
      )}

      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center px-4 text-center sm:px-6">
        <motion.div
          className="flex w-full flex-col items-center"
          variants={heroStagger}
          initial={reduceMotion ? false : "hidden"}
          animate={reduceMotion ? undefined : "visible"}
        >
          <motion.h1
            className="text-balance text-4xl font-bold leading-[1.1] tracking-tight text-charcoal sm:text-5xl lg:text-6xl"
            variants={heroReveal}
          >
            {hero.headlineLead}{" "}
            <HighlightedText variant="sky" from="bottom" delay={0.22}>
              {hero.headlineAccent}
            </HighlightedText>
          </motion.h1>

          <motion.p
            className="mt-5 max-w-2xl text-balance text-sm leading-relaxed text-muted-foreground sm:text-base"
            variants={heroReveal}
          >
            {hero.sub}
          </motion.p>

          <motion.div
            className="mt-8 flex w-full max-w-sm flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-4"
            variants={heroReveal}
          >
            <Link to={hero.ctas.primary.href} className="w-full sm:w-auto">
              <motion.div whileHover={buttonHover} whileTap={buttonTap} className="w-full sm:w-auto">
                <Button size="lg" variant="primary" className="w-full sm:w-auto">
                  {hero.ctas.primary.label}
                </Button>
              </motion.div>
            </Link>
            <a href={hero.ctas.secondary.href} className="w-full sm:w-auto">
              <motion.div whileHover={buttonHover} whileTap={buttonTap} className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  {hero.ctas.secondary.label}
                </Button>
              </motion.div>
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
