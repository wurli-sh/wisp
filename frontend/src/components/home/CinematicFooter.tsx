import { motion } from "framer-motion";
import { COPY } from "@/content/copy";
import { scrollViewport } from "@/lib/animations";

export function CinematicFooter() {
  const { footer } = COPY;

  return (
    <footer className="px-4 py-24 sm:px-6">
      <motion.div
        className="relative z-10 mx-auto w-full max-w-2xl"
        initial={{ opacity: 0, y: 25 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={scrollViewport}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <p className="text-center text-lg font-medium leading-relaxed text-muted-foreground text-pretty">
          {footer.blurb} Powered by{" "}
          <span className="bg-primary px-2 py-0.5 font-bold text-primary-foreground">
            {footer.highlight}
          </span>
        </p>
      </motion.div>
    </footer>
  );
}
