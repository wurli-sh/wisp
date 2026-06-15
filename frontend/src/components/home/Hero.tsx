import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Dithering } from "@paper-design/shaders-react";
import { COPY } from "@/content/copy";
import { Button } from "@/components/ui/Button";
import { HighlightedText } from "@/components/spell/highlighted-text";
import {
  buttonHover,
  buttonTap,
  fadeInUp,
  staggerContainer,
} from "@/lib/animations";

const TRUST_CHIPS = ["Stellar testnet", "Groth16 BN254", "8 checks · 1 proof"] as const;

export function Hero() {
  return (
    <section className="relative flex min-h-[calc(100dvh-5.5rem)] items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#fffffe_0%,#f8f8ff_24%,#f0f0ff_52%,#fafaff_78%,#ffffff_100%)] py-16">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 flex justify-center px-4 sm:px-6">
        <div className="relative h-[min(52vh,420px)] w-full max-w-5xl" aria-hidden>
          <div
            className="absolute inset-0 opacity-80"
            style={{
              maskImage: "linear-gradient(to top, black 40%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to top, black 40%, transparent 100%)",
            }}
          >
            <Dithering
              style={{ width: "100%", height: "100%" }}
              colorFront="#4D4DFF"
              shape="simplex"
              type="8x8"
              scale={0.75}
              speed={0.01}
            />
          </div>
          <div
            className="absolute inset-0 bg-primary/8"
            style={{
              maskImage: "linear-gradient(to top, black 25%, transparent 85%)",
              WebkitMaskImage: "linear-gradient(to top, black 25%, transparent 85%)",
            }}
          />
        </div>
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
            Prove without{" "}
            <HighlightedText variant="bright" from="bottom" delay={0.15}>
              showing.
            </HighlightedText>
          </motion.h1>

          <motion.p
            className="mt-6 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg"
            variants={fadeInUp}
          >
            {COPY.hero.sub}
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
            className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2"
            variants={fadeInUp}
          >
            {TRUST_CHIPS.map((chip) => (
              <li
                key={chip}
                className="text-[10px] font-bold uppercase tracking-widest text-white"
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
