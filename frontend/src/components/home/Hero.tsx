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
  const { hero } = COPY;

  return (
    <section className="relative flex min-h-[calc(100dvh-5.5rem)] items-center justify-center overflow-hidden bg-background py-28 md:py-32">
      <motion.div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 mx-auto h-[24%] w-full max-w-5xl px-4 opacity-80 sm:h-[28%] sm:px-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.8 }}
        transition={{ duration: 2, delay: 0.1 }}
      >
        <div
          className="h-full w-full overflow-hidden"
          style={{
            maskImage: "linear-gradient(to top, black 18%, rgba(0,0,0,0.82) 45%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to top, black 18%, rgba(0,0,0,0.82) 45%, transparent 100%)",
          }}
        >
          <Dithering
            className="h-full w-full"
            style={{ height: "100%", width: "100%" }}
            colorBack="#F4FBFF"
            colorFront="#0C100B"
            shape="simplex"
            type="4x4"
            scale={0.42}
            speed={0.018}
          />
        </div>
      </motion.div>

      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center px-4 text-center sm:px-6">
        <motion.div
          className="flex w-full flex-col items-center"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.div
            className="mb-6 inline-flex items-center gap-2.5 border-2 border-brand/15 bg-brand-soft px-3.5 py-2 text-sm font-medium text-primary"
            variants={fadeInUp}
          >
            {hero.eyebrow}
          </motion.div>

          <motion.h1
            className="text-balance text-4xl font-bold leading-[1.1] tracking-tight text-charcoal sm:text-5xl lg:text-6xl"
            variants={fadeInUp}
          >
            {hero.headlineLead}{" "}
            <HighlightedText variant="sky" from="bottom" delay={0.12} className="whitespace-nowrap">
              {hero.headlineAccent}
            </HighlightedText>
          </motion.h1>

          <motion.p
            className="mt-5 max-w-2xl text-balance text-sm leading-relaxed text-muted-foreground sm:text-base"
            variants={fadeInUp}
          >
            {hero.sub}
          </motion.p>

          <motion.div
            className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4"
            variants={fadeInUp}
          >
            <Link to={hero.ctas.primary.href}>
              <motion.div whileHover={buttonHover} whileTap={buttonTap}>
                <Button size="lg" variant="primary">
                  {hero.ctas.primary.label}
                </Button>
              </motion.div>
            </Link>
            <a href={hero.ctas.secondary.href}>
              <motion.div whileHover={buttonHover} whileTap={buttonTap}>
                <Button size="lg" variant="outline">
                  {hero.ctas.secondary.label}
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
