import { motion } from "framer-motion";
import { COPY } from "@/content/copy";
import { Badge } from "@/components/ui/Badge";
import { HighlightedText } from "@/components/spell/highlighted-text";
import { fadeInUp, scrollViewport, staggerContainer } from "@/lib/animations";

export function ParadoxSection() {
  const { paradoxAct } = COPY;

  return (
    <section className="bg-background py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
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
            {paradoxAct.eyebrow}
          </motion.p>
          <motion.h2
            variants={fadeInUp}
            className="mt-4 text-3xl font-bold text-foreground sm:text-4xl"
          >
            {paradoxAct.headline}
          </motion.h2>
        </motion.div>

        <div className="mt-16 grid gap-6 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={scrollViewport}
            className="border-2 border-destructive/30 bg-destructive/5 p-6 shadow-soft"
          >
            <h3 className="text-sm font-bold uppercase tracking-wider text-destructive">
              {paradoxAct.withoutZk.label}
            </h3>
            <ul className="mt-6 space-y-3">
              {paradoxAct.withoutZk.rows.map((row) => (
                <li
                  key={row}
                  className="flex justify-between border-b-2 border-border pb-2 text-sm"
                >
                  <span className="text-muted-foreground">{row}</span>
                  <span className="text-xs">exposed</span>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Badge variant="danger">{paradoxAct.withoutZk.pill}</Badge>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={scrollViewport}
            transition={{ delay: 0.1 }}
            className="border-2 border-primary/20 bg-primary-soft p-6 shadow-card"
          >
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
              {paradoxAct.withZk.label}
            </h3>
            <div className="mt-6 flex min-h-[140px] flex-col items-center justify-center border-2 border-primary/10 bg-background p-6">
              <Badge variant="success">{paradoxAct.withZk.pill}</Badge>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                {paradoxAct.withZk.caption}
              </p>
            </div>
          </motion.div>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={scrollViewport}
          className="mt-12 text-center text-lg text-primary"
        >
          Compliance and privacy —{" "}
          <HighlightedText variant="soft" from="left" inView>
            one proof.
          </HighlightedText>
        </motion.p>
      </div>
    </section>
  );
}
