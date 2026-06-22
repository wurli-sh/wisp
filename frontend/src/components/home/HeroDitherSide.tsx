import { motion } from "framer-motion";
import { Dithering } from "@paper-design/shaders-react";

const DITHER_PROPS = {
  colorBack: "#F4FBFF",
  colorFront: "#0A0A0A",
  shape: "simplex" as const,
  type: "4x4" as const,
  scale: 0.4,
  speed: 0.04,
};

export function HeroDitherSide({ side }: { side: "left" | "right" }) {
  const isLeft = side === "left";
  const maskImage = isLeft
    ? "linear-gradient(to right, black 0%, rgba(0,0,0,0.85) 40%, transparent 100%)"
    : "linear-gradient(to left, black 0%, rgba(0,0,0,0.85) 40%, transparent 100%)";

  return (
    <motion.div
      className={`pointer-events-none absolute inset-y-0 z-0 hidden w-[26%] max-w-lg opacity-80 md:block ${
        isLeft ? "left-0" : "right-0"
      }`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.7 }}
      transition={{ duration: 2, delay: 0.1 }}
    >
      <div
        className="h-full w-full overflow-hidden"
        style={{
          maskImage,
          WebkitMaskImage: maskImage,
        }}
      >
        <Dithering
          className="h-full w-full"
          style={{
            height: "100%",
            width: "100%",
            transform: isLeft ? undefined : "scaleX(-1)",
          }}
          {...DITHER_PROPS}
        />
      </div>
    </motion.div>
  );
}
