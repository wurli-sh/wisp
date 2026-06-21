import { motion } from "framer-motion";
import { BRAND_IMAGES } from "@/config/brand";
import { PAGE_MAX } from "@/config/layout";
import { cn } from "@/lib/cn";
import { fadeInUp, scrollViewport } from "@/lib/animations";
import { ImageWithSkeleton } from "@/components/ui/ImageWithSkeleton";

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
        <ImageWithSkeleton
          src={BRAND_IMAGES.footer.src}
          alt={BRAND_IMAGES.footer.alt}
          width={BRAND_IMAGES.footer.width}
          height={BRAND_IMAGES.footer.height}
        />
      </motion.div>
    </section>
  );
}
