import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { COPY } from "@/content/copy";
import { Button } from "@/components/ui/Button";
import { AsciiSpiral } from "@/components/home/AsciiSpiral";
import { buttonHover, buttonTap } from "@/lib/animations";

const heroStagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
} as const;

const heroReveal = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut" },
  },
} as const;

export function Hero() {
  const { hero } = COPY;

  return (
    <section className="relative flex min-h-[calc(100svh-2rem)] flex-col items-center justify-center overflow-hidden bg-background px-4 pt-32 pb-20 text-center sm:min-h-[calc(100svh-3rem)] sm:px-6 sm:pt-40 sm:pb-32 md:pt-44 md:pb-36">
      <motion.div
        className="relative z-10 flex w-full max-w-3xl flex-col items-center"
        variants={heroStagger}
        initial="hidden"
        animate="visible"
      >
        {/* ASCII spiral — rotated 90°, centered at the top. The wrapper is
            shorter than the <pre>'s layout box and clips the empty grid
            rows (overflow-hidden) so the spiral never sits behind the
            headline below it. */}
        <motion.div
          className="flex h-[140px] w-full items-center justify-center overflow-hidden sm:h-[170px] md:h-[200px]"
          variants={heroReveal}
        >
          <AsciiSpiral className="rotate-90 text-[2.6px] sm:text-[3.2px] md:text-[3.8px]" />
        </motion.div>

        <motion.h1
          className="mt-10 text-balance text-3xl font-bold leading-[1.08] tracking-tight text-charcoal sm:text-4xl lg:text-5xl"
          variants={heroReveal}
        >
          {hero.headlineLead}
          <span
            aria-hidden
            className="ml-[0.06em] inline-block h-[0.18em] w-[0.18em] bg-brand align-baseline"
          />
          <span className="sr-only">{hero.headlineAccent}</span>
        </motion.h1>

        <motion.p
          className="mt-5 max-w-2xl text-balance text-sm leading-relaxed text-muted-foreground/90 sm:text-base"
          variants={heroReveal}
        >
          {hero.sub}
        </motion.p>

        <motion.div
          className="mt-8 flex w-full max-w-sm flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-4"
          variants={heroReveal}
        >
          <Link to={hero.ctas.primary.href} className="group w-full sm:w-auto">
            <motion.div whileHover={buttonHover} whileTap={buttonTap} className="w-full sm:w-auto">
              <Button size="lg" variant="primary" className="w-full sm:w-auto">
                {hero.ctas.primary.label}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </motion.div>
          </Link>
          <a href={hero.ctas.secondary.href} className="group w-full sm:w-auto">
            <motion.div whileHover={buttonHover} whileTap={buttonTap} className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                {hero.ctas.secondary.label}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </motion.div>
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
}
