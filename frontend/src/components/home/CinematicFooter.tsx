import { motion } from "framer-motion";
import { Dithering } from "@paper-design/shaders-react";
import { COPY } from "@/content/copy";
import { scrollViewport } from "@/lib/animations";

export function CinematicFooter() {
  const { footer } = COPY;

  return (
    <footer className="mt-24 px-4 sm:px-6">
      <div className="relative mx-auto flex min-h-[60vh] w-full max-w-5xl flex-col items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#ececff_32%,#d0d0ff_62%,#b8b8ff_100%)]">
        <div
          className="absolute inset-0 z-0 opacity-80"
          style={{
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

        <motion.div
          className="relative z-10 w-full px-6"
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={scrollViewport}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <p className="mx-auto max-w-2xl text-center text-lg font-medium leading-relaxed text-white text-pretty">
            {footer.blurb} Powered by{" "}
            <span className="bg-primary px-2 py-0.5 font-bold text-primary-foreground">
              {footer.highlight}
            </span>
          </p>
        </motion.div>
      </div>
    </footer>
  );
}
