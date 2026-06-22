import { useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";

export const sectionStagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
} as const;

export const sectionReveal = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.4, ease: "easeOut" },
  },
} as const;

export const SECTION_VIEWPORT = {
  once: true,
  amount: 0.2,
  margin: "-40px 0px",
} as const;

export function useSectionReveal() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const inView = useInView(sectionRef, SECTION_VIEWPORT);

  return {
    sectionRef,
    showContent: reduceMotion || inView,
  };
}
