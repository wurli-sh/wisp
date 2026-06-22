import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { BRAND_IMAGES, LAUNCH_VIDEO } from "@/config/brand";
import { PAGE_MAX } from "@/config/layout";
import { COPY } from "@/content/copy";
import { cn } from "@/lib/cn";
import { fadeInUp, scrollViewport } from "@/lib/animations";

function LaunchVideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const posterRef = useRef<HTMLImageElement>(null);
  const [active, setActive] = useState(false);
  const [posterLoaded, setPosterLoaded] = useState(false);
  const { footer } = BRAND_IMAGES;

  useEffect(() => {
    setPosterLoaded(false);
  }, [footer.src]);

  useEffect(() => {
    const img = posterRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      setPosterLoaded(true);
    }
  }, [footer.src]);

  const handlePlay = () => {
    setActive(true);
    requestAnimationFrame(() => {
      void videoRef.current?.play();
    });
  };

  return (
    <div
      className="relative w-full overflow-hidden bg-skeleton"
      style={{ aspectRatio: `${footer.width} / ${footer.height}` }}
    >
      {active ? (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full bg-charcoal object-contain"
          src={LAUNCH_VIDEO.src}
          controls
          playsInline
          preload="auto"
          width={LAUNCH_VIDEO.width}
          height={LAUNCH_VIDEO.height}
        />
      ) : (
        <>
          <div
            className={cn(
              "absolute inset-0 transition-opacity duration-300 motion-reduce:transition-none",
              posterLoaded ? "pointer-events-none opacity-0" : "opacity-100",
            )}
            aria-hidden={posterLoaded}
          >
            <div className="absolute inset-0 bg-skeleton" />
            <div className="image-skeleton-shimmer absolute inset-0" />
          </div>

          <button
            type="button"
            onClick={handlePlay}
            aria-label={COPY.launchVideo.playAria}
            className="group absolute inset-0 flex cursor-pointer items-center justify-center outline-none focus-visible:shadow-glow"
          >
            <img
              ref={posterRef}
              src={footer.src}
              alt=""
              width={footer.width}
              height={footer.height}
              loading="lazy"
              decoding="async"
              onLoad={() => setPosterLoaded(true)}
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-300 motion-reduce:transition-none",
                posterLoaded ? "opacity-100" : "opacity-0",
              )}
            />
            <div className="absolute inset-0 bg-charcoal/35 transition-colors group-hover:bg-charcoal/25" />
            <span className="relative z-10 flex h-14 w-14 items-center justify-center border-2 border-inverse-border bg-charcoal/80 text-inverse-foreground shadow-elev transition-transform group-hover:scale-105">
              <Play size={22} fill="currentColor" className="ml-0.5" aria-hidden />
            </span>
          </button>
        </>
      )}
    </div>
  );
}

export function LaunchVideoSection() {
  return (
    <section
      aria-hidden="true"
      className="flex w-full justify-center overflow-hidden bg-background px-4 pt-8 md:pt-12"
    >
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={scrollViewport}
        variants={fadeInUp}
        className={cn("w-full overflow-hidden", PAGE_MAX)}
      >
        <LaunchVideoPlayer />
      </motion.div>
    </section>
  );
}
