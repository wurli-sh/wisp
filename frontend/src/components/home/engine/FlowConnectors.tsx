import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { FlowPhase } from "@/hooks/useEngineFlow";
import { PipelineMetric } from "./PipelineMetric";

const CURVE_OFFSET = 22;

type FlowConnectorsProps = {
  containerRef: React.RefObject<HTMLElement | null>;
  issuerRef: React.RefObject<HTMLElement | null>;
  complianceRef: React.RefObject<HTMLElement | null>;
  receiverRef: React.RefObject<HTMLElement | null>;
  phase: FlowPhase;
  leftMetric: { value: string; label: string };
  rightMetric: { value: string; label: string };
};

type Anchor = { x: number; y: number };

type Layout = {
  width: number;
  height: number;
  leftTop: { start: Anchor; end: Anchor };
  leftBottom: { start: Anchor; end: Anchor };
  rightTop: { start: Anchor; end: Anchor };
  rightBottom: { start: Anchor; end: Anchor };
  leftMetricPos: Anchor;
  rightMetricPos: Anchor;
};

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = () => setReduced(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}

function anchorFromRect(
  container: DOMRect,
  rect: DOMRect,
  edge: "right" | "left",
  offsetY: number,
): Anchor {
  const x = edge === "right" ? rect.right - container.left : rect.left - container.left;
  const y = rect.top - container.top + rect.height / 2 + offsetY;
  return { x, y };
}

function cubicPath(start: Anchor, end: Anchor): string {
  const midX = (start.x + end.x) / 2;
  return `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`;
}

function laneCenter(top: { start: Anchor; end: Anchor }, bottom: { start: Anchor; end: Anchor }): Anchor {
  return {
    x: (top.start.x + top.end.x) / 2,
    y: (top.start.y + bottom.start.y) / 2,
  };
}

function measureLayout(
  container: HTMLElement,
  issuerEl: HTMLElement,
  complianceEl: HTMLElement,
  receiverEl: HTMLElement,
): Layout {
  const containerRect = container.getBoundingClientRect();
  const issuerRect = issuerEl.getBoundingClientRect();
  const complianceRect = complianceEl.getBoundingClientRect();
  const receiverRect = receiverEl.getBoundingClientRect();

  const leftTop = {
    start: anchorFromRect(containerRect, issuerRect, "right", -CURVE_OFFSET),
    end: anchorFromRect(containerRect, complianceRect, "left", -CURVE_OFFSET),
  };
  const leftBottom = {
    start: anchorFromRect(containerRect, issuerRect, "right", CURVE_OFFSET),
    end: anchorFromRect(containerRect, complianceRect, "left", CURVE_OFFSET),
  };
  const rightTop = {
    start: anchorFromRect(containerRect, complianceRect, "right", -CURVE_OFFSET),
    end: anchorFromRect(containerRect, receiverRect, "left", -CURVE_OFFSET),
  };
  const rightBottom = {
    start: anchorFromRect(containerRect, complianceRect, "right", CURVE_OFFSET),
    end: anchorFromRect(containerRect, receiverRect, "left", CURVE_OFFSET),
  };

  return {
    width: containerRect.width,
    height: containerRect.height,
    leftTop,
    leftBottom,
    rightTop,
    rightBottom,
    leftMetricPos: laneCenter(leftTop, leftBottom),
    rightMetricPos: laneCenter(rightTop, rightBottom),
  };
}

function isLeftPathActive(phase: FlowPhase): boolean {
  return phase === "issuer" || phase === "proving";
}

function isRightPathActive(phase: FlowPhase): boolean {
  return phase === "proving" || phase === "settling" || phase === "complete";
}

type GlowPathProps = {
  d: string;
  active: boolean;
  reducedMotion: boolean;
};

function GlowPath({ d, active, reducedMotion }: GlowPathProps) {
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke="color-mix(in srgb, var(--color-border) 88%, white)"
        strokeWidth="1.25"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {active && (
        <>
          <motion.path
            d={d}
            fill="none"
            stroke="color-mix(in srgb, var(--color-brand-sky) 68%, white)"
            strokeWidth="2.75"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={
              reducedMotion
                ? { pathLength: 1, opacity: 0.7 }
                : { pathLength: 1, opacity: 0.62 }
            }
            transition={{
              pathLength: { duration: 0.72, ease: [0.22, 1, 0.36, 1] },
              opacity: { duration: reducedMotion ? 0.3 : 0.45 },
            }}
            style={{
              filter:
                "drop-shadow(0 0 7px color-mix(in srgb, var(--color-brand-sky) 38%, transparent))",
            }}
          />
          {!reducedMotion && (
            <motion.path
              d={d}
              fill="none"
              stroke="var(--color-primary-dark)"
              strokeWidth="1.85"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              pathLength={1}
              strokeDasharray="0.22 0.78"
              initial={{ strokeDashoffset: 1, opacity: 0 }}
              animate={{ strokeDashoffset: [1, 0], opacity: [0, 0.9, 0] }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: "linear",
              }}
              style={{
                filter:
                  "drop-shadow(0 0 5px color-mix(in srgb, var(--color-brand-sky) 26%, transparent))",
              }}
            />
          )}
        </>
      )}
    </g>
  );
}

export function FlowConnectors({
  containerRef,
  issuerRef,
  complianceRef,
  receiverRef,
  phase,
  leftMetric,
  rightMetric,
}: FlowConnectorsProps) {
  const [layout, setLayout] = useState<Layout | null>(null);
  const reducedMotion = useReducedMotion();
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      const issuer = issuerRef.current;
      const compliance = complianceRef.current;
      const receiver = receiverRef.current;
      if (!container || !issuer || !compliance || !receiver) return;
      setLayout(measureLayout(container, issuer, compliance, receiver));
    };

    const schedule = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    };

    schedule();
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(schedule);
    observer.observe(container);

    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(rafRef.current);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [containerRef, issuerRef, complianceRef, receiverRef]);

  if (!layout) return null;

  const paths = [
    { d: cubicPath(layout.leftTop.start, layout.leftTop.end), active: isLeftPathActive(phase) },
    { d: cubicPath(layout.leftBottom.start, layout.leftBottom.end), active: isLeftPathActive(phase) },
    { d: cubicPath(layout.rightTop.start, layout.rightTop.end), active: isRightPathActive(phase) },
    { d: cubicPath(layout.rightBottom.start, layout.rightBottom.end), active: isRightPathActive(phase) },
  ];

  return (
    <>
      <svg
        className="pointer-events-none absolute inset-0 overflow-visible"
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        fill="none"
        aria-hidden
      >
        {paths.map((path, i) => (
          <GlowPath key={i} d={path.d} active={path.active} reducedMotion={reducedMotion} />
        ))}
      </svg>

      <PipelineMetric
        value={leftMetric.value}
        label={leftMetric.label}
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: layout.leftMetricPos.x, top: layout.leftMetricPos.y }}
      />
      <PipelineMetric
        value={rightMetric.value}
        label={rightMetric.label}
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: layout.rightMetricPos.x, top: layout.rightMetricPos.y }}
      />
    </>
  );
}
