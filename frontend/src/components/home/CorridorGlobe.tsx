import { useEffect, useRef, type CSSProperties } from "react";
import createGlobe from "cobe";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const GLOBE_MAX = 580;
const DESKTOP_DPR = 2;
const MOBILE_DPR = 1;

const GLOBE_BLUE: [number, number, number] = [0.184, 0.435, 0.89];

const CORRIDOR_MARKERS = [
  { id: "sf", label: "SF", location: [37.78, -122.44] as [number, number] },
  { id: "cdmx", label: "CDMX", location: [19.43, -99.13] as [number, number] },
  { id: "london", label: "LONDON", location: [51.51, -0.13] as [number, number] },
  { id: "singapore", label: "SINGAPORE", location: [1.35, 103.82] as [number, number] },
  { id: "saopaulo", label: "SÃO PAULO", location: [-23.55, -46.63] as [number, number] },
  { id: "tokyo", label: "TOKYO", location: [35.68, 139.65] as [number, number] },
  { id: "dubai", label: "DUBAI", location: [25.2, 55.27] as [number, number] },
] as const;

const CORRIDOR_ARCS = [
  {
    id: "sf-cdmx",
    label: "SF → CDMX",
    from: CORRIDOR_MARKERS[0].location,
    to: CORRIDOR_MARKERS[1].location,
  },
  {
    id: "sf-london",
    label: "SF → LONDON",
    from: CORRIDOR_MARKERS[0].location,
    to: CORRIDOR_MARKERS[2].location,
  },
  {
    id: "london-singapore",
    label: "LONDON → SINGAPORE",
    from: CORRIDOR_MARKERS[2].location,
    to: CORRIDOR_MARKERS[3].location,
  },
  {
    id: "sf-saopaulo",
    label: "SF → SÃO PAULO",
    from: CORRIDOR_MARKERS[0].location,
    to: CORRIDOR_MARKERS[4].location,
  },
  {
    id: "tokyo-singapore",
    label: "TOKYO → SINGAPORE",
    from: CORRIDOR_MARKERS[5].location,
    to: CORRIDOR_MARKERS[3].location,
  },
  {
    id: "sf-dubai",
    label: "SF → DUBAI",
    from: CORRIDOR_MARKERS[0].location,
    to: CORRIDOR_MARKERS[6].location,
  },
] as const;

function markerLabelStyle(id: string): CSSProperties {
  return {
    position: "absolute",
    positionAnchor: `--cobe-${id}`,
    bottom: "anchor(top)",
    left: "anchor(center)",
    translate: "-50% 0",
    marginBottom: 10,
    opacity: `var(--cobe-visible-${id}, 0)`,
    filter: `blur(calc((1 - var(--cobe-visible-${id}, 0)) * 6px))`,
    transition: "opacity 0.35s ease, filter 0.35s ease",
  };
}

function arcLabelStyle(id: string): CSSProperties {
  return {
    position: "absolute",
    positionAnchor: `--cobe-arc-${id}`,
    bottom: "anchor(top)",
    left: "anchor(center)",
    translate: "-50% 0",
    marginBottom: 6,
    opacity: `var(--cobe-visible-arc-${id}, 0)`,
    filter: `blur(calc((1 - var(--cobe-visible-arc-${id}, 0)) * 6px))`,
    transition: "opacity 0.35s ease, filter 0.35s ease",
  };
}

function MarkerLabel({ id, label }: { id: string; label: string }) {
  return (
    <div className="pointer-events-none whitespace-nowrap" style={markerLabelStyle(id)}>
      <span
        className="relative inline-block px-2 py-1 text-[9px] font-bold tracking-wide text-white shadow-sm"
        style={{ backgroundColor: "var(--color-brand)" }}
      >
        {label}
        <span
          className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent"
          style={{ borderTopColor: "var(--color-brand)" }}
          aria-hidden
        />
      </span>
    </div>
  );
}

function ArcLabel({ id, label }: { id: string; label: string }) {
  return (
    <div className="pointer-events-none whitespace-nowrap" style={arcLabelStyle(id)}>
      <span
        className="inline-block border px-2 py-0.5 text-[8px] font-bold tracking-wide"
        style={{ borderColor: "var(--color-brand)", color: "var(--color-brand)", backgroundColor: "#FFFFFF" }}
      >
        {label}
      </span>
    </div>
  );
}

export function CorridorGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(false);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const dpr = isMobile ? MOBILE_DPR : DESKTOP_DPR;
  const mapSamples = isMobile ? 8000 : 20000;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry?.isIntersecting ?? false;
      },
      { rootMargin: "120px" },
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let phi = 0;
    let frame = 0;
    let mounted = true;

    const getPixelSize = () => {
      const width = Math.min(container.offsetWidth || GLOBE_MAX, GLOBE_MAX);
      return width * dpr;
    };

    const pixelSize = getPixelSize();

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: pixelSize,
      height: pixelSize,
      phi: 0,
      theta: 0.2,
      dark: 0,
      diffuse: 1.2,
      mapSamples,
      mapBrightness: 6,
      mapBaseBrightness: 0,
      baseColor: [1, 1, 1],
      markerColor: GLOBE_BLUE,
      glowColor: [1, 1, 1],
      arcColor: GLOBE_BLUE,
      arcWidth: 0.4,
      arcHeight: 0.26,
      markerElevation: 0.02,
      markers: CORRIDOR_MARKERS.map((marker) => ({
        location: marker.location,
        size: 0.04,
        id: marker.id,
      })),
      arcs: CORRIDOR_ARCS.map((arc) => ({
        from: arc.from,
        to: arc.to,
        id: arc.id,
      })),
    });

    const onResize = () => {
      const nextSize = getPixelSize();
      globe.update({ width: nextSize, height: nextSize });
    };

    const animate = () => {
      if (mounted && visibleRef.current) {
        phi += 0.003;
        globe.update({ phi });
      }
      frame = requestAnimationFrame(animate);
    };

    window.addEventListener("resize", onResize);
    frame = requestAnimationFrame(animate);

    return () => {
      mounted = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      globe.destroy();
    };
  }, [dpr, mapSamples]);

  return (
    <div
      ref={containerRef}
      className="relative mx-auto aspect-square w-full max-w-[480px]"
    >
      <canvas ref={canvasRef} className="h-full w-full" width={GLOBE_MAX * dpr} height={GLOBE_MAX * dpr} />
      {CORRIDOR_MARKERS.map((marker) => (
        <MarkerLabel key={marker.id} id={marker.id} label={marker.label} />
      ))}
      {CORRIDOR_ARCS.map((arc) => (
        <ArcLabel key={arc.id} id={arc.id} label={arc.label} />
      ))}
    </div>
  );
}
