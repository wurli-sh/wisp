import { motion } from "framer-motion";
import { PAGE_MAX } from "@/config/layout";
import { cn } from "@/lib/cn";
import { fadeInUp, scrollViewport } from "@/lib/animations";

export function FooterImageSection() {
  return (
    <section
      aria-hidden="true"
      className="flex w-full justify-center bg-background px-4 pt-8 md:pt-12"
    >
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={scrollViewport}
        variants={fadeInUp}
        className={cn("w-full overflow-hidden", PAGE_MAX)}
      >
        <img
          src="/footer.png"
          alt=""
          className="block h-auto w-full"
          loading="lazy"
        />
      </motion.div>
    </section>
  );
}
