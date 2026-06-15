import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { COPY } from "@/content/copy";
import { Button } from "@/components/ui/Button";
import { HighlightedText } from "@/components/spell/highlighted-text";
import { fadeInUp, scrollViewport } from "@/lib/animations";

export function DeploymentCTA() {
  const { closer } = COPY.move;

  return (
    <section className="py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={scrollViewport}
          variants={fadeInUp}
          className="border-2 border-primary/20 bg-primary-soft p-10 text-center shadow-card"
        >
          <h2 className="text-3xl font-bold text-primary sm:text-4xl">
            Compliance is no longer a{" "}
            <HighlightedText variant="bright" from="bottom" inView>
              six-month moat.
            </HighlightedText>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{closer.sub}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to={closer.ctas.primary.href}>
              <Button variant="secondary" size="lg">
                {closer.ctas.primary.label}
              </Button>
            </Link>
            <a href={closer.ctas.secondary.href} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="lg">
                {closer.ctas.secondary.label}
              </Button>
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
