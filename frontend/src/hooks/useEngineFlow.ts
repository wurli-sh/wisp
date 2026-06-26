import { useEffect, useState } from "react";

export type FlowPhase = "issuer" | "proving" | "settling" | "complete";

const PHASE_ORDER: FlowPhase[] = ["issuer", "proving", "settling", "complete"];
const PHASE_DURATION_MS = 2800;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useEngineFlow(active = true): FlowPhase {
  const [phase, setPhase] = useState<FlowPhase>("issuer");

  useEffect(() => {
    if (!active || prefersReducedMotion()) {
      setPhase("issuer");
      return;
    }

    let index = 0;
    setPhase(PHASE_ORDER[index]!);

    const tick = () => {
      index = (index + 1) % PHASE_ORDER.length;
      setPhase(PHASE_ORDER[index]!);
    };

    const id = window.setInterval(tick, PHASE_DURATION_MS);
    return () => window.clearInterval(id);
  }, [active]);

  return phase;
}

export function issuerStepIndex(phase: FlowPhase): number {
  if (phase === "issuer") return 0;
  return 2;
}

export function complianceStepIndex(phase: FlowPhase): number {
  if (phase === "issuer") return 0;
  if (phase === "proving") return 1;
  return 2;
}

export function receiverStepIndex(phase: FlowPhase): number {
  if (phase === "issuer" || phase === "proving") return 0;
  if (phase === "settling") return 1;
  return 2;
}
