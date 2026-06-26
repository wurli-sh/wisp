/**
 * AsciiSpiral—animated 3D rotating disk rendered as monospace text.
 *
 * The frame data is a 75-frame sequence at 80×80 cells, encoded as
 * gzipped base64 in `asciiSpiralData.ts` (~40KB). Density characters
 * (▪ dense, ▫ mid, · sparse) carry the depth gradient, rendered as 1s
 * and 0s with tier-based opacity in Wisp brand-blue.
 *
 * Runtime: decode payload via DecompressionStream → split frames →
 * convert each frame to an HTML string with span-tagged opacity tiers
 * once → swap innerHTML on a fixed <pre> at 30fps. The conversion is
 * one-time work at decode; the per-frame swap stays O(1).
 *
 * Performance / a11y
 * ─────────────────
 * • Decoding + conversion are async; <pre> shows nothing (or first
 *   frame) until ready.
 * • IntersectionObserver pauses the rAF loop when offscreen.
 * • prefers-reduced-motion → render only frame 0 and stop.
 * • aria-hidden on the <pre>; the surrounding region carries the label.
 *
 * Vendored from entros.io (MIT) and recolored to Wisp brand-blue.
 */

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { SPIRAL_PAYLOAD_B64 } from "./asciiSpiralData";

const FRAME_INTERVAL_MS = 33; // ~30fps
const FALLBACK_FRAME_COUNT = 75;
const FALLBACK_GRID_SIZE = 80;

function buildFallbackFrames(): string[] {
  return Array.from({ length: FALLBACK_FRAME_COUNT }, (_, frame) => {
    const tilt = 0.42;
    const spin = (frame / FALLBACK_FRAME_COUNT) * Math.PI * 2;
    const lines: string[] = [];

    for (let y = 0; y < FALLBACK_GRID_SIZE; y++) {
      let line = "";
      const ny = (y / (FALLBACK_GRID_SIZE - 1) - 0.5) * 2;

      for (let x = 0; x < FALLBACK_GRID_SIZE; x++) {
        const nx = (x / (FALLBACK_GRID_SIZE - 1) - 0.5) * 2;
        const diskX = nx;
        const diskY = ny / tilt;
        const radius = Math.hypot(diskX, diskY);

        if (radius > 0.92 || radius < 0.18) {
          line += " ";
          continue;
        }

        const angle = Math.atan2(diskY, diskX);
        const wave = Math.sin(angle * 5 + spin) * 0.5 + Math.cos(radius * 18 - spin * 1.5) * 0.5;
        const edgeFade = 1 - Math.abs(radius - 0.55) / 0.42;
        const density = wave * 0.45 + edgeFade * 0.85;

        line += density > 0.82 ? "▪" : density > 0.58 ? "▫" : density > 0.36 ? "·" : " ";
      }

      lines.push(line);
    }

    return lines.join("\n");
  });
}

async function decodeFrames(payload: string): Promise<string[]> {
  if (typeof DecompressionStream === "undefined") {
    return buildFallbackFrames();
  }

  const binary = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
  const stream = new Blob([binary as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  const text = await new Response(stream).text();
  return text.split("\x00");
}

/**
 * Convert one density-character frame into an HTML string of 1s and 0s
 * with span-tagged opacity tiers. Peaks (densest cells) render as 0s so
 * they stand out against the baseline of 1s, and the depth gradient
 * becomes opacity-driven.
 *
 * Adjacent cells of the same tier share one <span>, keeping the
 * resulting HTML compact (typically ~3-5x smaller than per-cell spans).
 */
function buildFrameHtml(frame: string): string {
  let html = "";
  let lastTier = 0;

  for (let i = 0; i < frame.length; i++) {
    const ch = frame[i];

    if (ch === "\n") {
      if (lastTier !== 0) html += "</span>";
      html += "\n";
      lastTier = 0;
      continue;
    }

    let tier = 0;
    let glyph = " ";
    if (ch === "▪") {
      tier = 4;
      glyph = "0";
    } else if (ch === "▫") {
      tier = 3;
      glyph = "1";
    } else if (ch === "·") {
      tier = 2;
      glyph = "1";
    }

    if (tier === 0) {
      if (lastTier !== 0) html += "</span>";
      html += " ";
      lastTier = 0;
      continue;
    }

    if (tier !== lastTier) {
      if (lastTier !== 0) html += "</span>";
      const cls =
        tier === 4 ? "text-brand" : tier === 3 ? "text-brand/85" : "text-brand/65";
      // aria-hidden on each generated span: axe-core's color-contrast rule
      // walks innerHTML-injected children and doesn't reliably honor the
      // parent <pre aria-hidden>.
      html += `<span class="${cls}" aria-hidden="true">`;
    }
    html += glyph;
    lastTier = tier;
  }

  if (lastTier !== 0) html += "</span>";
  return html;
}

interface AsciiSpiralProps {
  className?: string;
}

export function AsciiSpiral({ className }: AsciiSpiralProps) {
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const pre = preRef.current;
    if (!pre) return;

    let rafId = 0;
    let lastFrameTime = 0;
    let frameIdx = 0;
    let inView = true;
    let cancelled = false;
    let htmlFrames: string[] = [];

    const render = (now: number) => {
      if (now - lastFrameTime < FRAME_INTERVAL_MS) {
        if (inView) rafId = requestAnimationFrame(render);
        return;
      }
      lastFrameTime = now;
      pre.innerHTML = htmlFrames[frameIdx % htmlFrames.length] ?? "";
      frameIdx++;
      if (inView) rafId = requestAnimationFrame(render);
    };

    decodeFrames(SPIRAL_PAYLOAD_B64).catch(() => buildFallbackFrames()).then((decoded) => {
      if (cancelled) return;
      // Pre-compute per-frame HTML once so the rAF loop is O(1).
      htmlFrames = decoded.map(buildFrameHtml);
      // Paint frame 0 immediately so there's no flash of empty.
      pre.innerHTML = htmlFrames[0] ?? "";

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduceMotion) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry) return;
          const wasInView = inView;
          inView = entry.isIntersecting;
          if (!wasInView && inView) {
            rafId = requestAnimationFrame(render);
          }
        },
        { threshold: 0 },
      );
      observer.observe(pre);

      rafId = requestAnimationFrame(render);

      return () => observer.disconnect();
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <pre
      ref={preRef}
      aria-hidden="true"
      // Inline styles override Wisp's un-layered global `pre` rule
      // (dark charcoal bg + padding + sans font), which Tailwind utility
      // classes can't beat. Monospace keeps the 80-column grid aligned.
      style={{
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        background: "transparent",
        color: "inherit",
        padding: 0,
        margin: 0,
        overflow: "visible",
        // Crisp glyph rendering — avoids the soft/blurry edges that
        // sub-pixel font smoothing produces on tiny monospace glyphs.
        textRendering: "geometricPrecision",
        WebkitFontSmoothing: "none",
        MozOsxFontSmoothing: "grayscale",
      }}
      className={cn(
        // 80-column monospace block. leading-none keeps rows tight so the
        // disk shape stays close to its original terminal aspect.
        // font-bold thickens the digits for sharper, more defined edges.
        "select-none whitespace-pre font-bold leading-none text-brand",
        // Glyph size is tiny on purpose—at 80 cols × 80 rows, even a
        // 6px glyph produces a ~480px-wide spiral.
        "text-[3.5px] sm:text-[4.5px] md:text-[5px] lg:text-[5.5px] xl:text-[6px]",
        className,
      )}
    />
  );
}
