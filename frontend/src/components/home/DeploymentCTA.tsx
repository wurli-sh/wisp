import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { PAGE_MAX } from "@/config/layout";
import { COPY } from "@/content/copy";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { CorridorGlobe } from "@/components/home/CorridorGlobe";
import { buttonHover, buttonTap, fadeInUp, scrollViewport, staggerContainer } from "@/lib/animations";

export function DeploymentCTA() {
  const { closer } = COPY.move;

  return (
    <section className="py-16 sm:py-28 md:py-32">
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
            {closer.eyebrow}
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={scrollViewport}
          variants={staggerContainer}
          className="mt-12 grid items-center gap-10 md:grid-cols-2"
        >
          <motion.div variants={fadeInUp}>
            <CorridorGlobe />
          </motion.div>
          <motion.div variants={fadeInUp} className="flex flex-col text-center md:text-left">
            <Logo size="lg" tone="dark" className="mb-6 self-start" />
            <h2 className="text-3xl font-bold text-primary sm:text-4xl lg:text-5xl">
              {closer.headline}
            </h2>
            <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted-foreground md:mx-0">
              {closer.sub}
            </p>
            <motion.div
              className="mt-10 flex w-full max-w-sm flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-4 md:justify-start"
            >
              <Link to={closer.ctas.primary.href} className="w-full sm:w-auto">
                <motion.div whileHover={buttonHover} whileTap={buttonTap} className="w-full sm:w-auto">
                  <Button size="lg" variant="primary" className="w-full sm:w-auto">
                    {closer.ctas.primary.label}
                  </Button>
                </motion.div>
              </Link>
              <a
                href={closer.ctas.secondary.href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto"
              >
                <motion.div whileHover={buttonHover} whileTap={buttonTap} className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    {closer.ctas.secondary.label}
                  </Button>
                </motion.div>
              </a>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
