import { AnimatePresence, motion } from "framer-motion";
import { Loader2, ShieldCheck } from "lucide-react";
import { COPY } from "@/content/copy";
import { complianceStepIndex, type FlowPhase } from "@/hooks/useEngineFlow";
import { PipelineCardBody, PipelineCardFooter, PipelineCardShell } from "./PipelineCardShell";

type ComplianceNodeProps = {
  phase: FlowPhase;
  cardRef?: React.RefObject<HTMLDivElement | null>;
  hideCaption?: boolean;
};

export function ComplianceNode({ phase, cardRef, hideCaption }: ComplianceNodeProps) {
  const { compliance } = COPY.engine.pipeline;
  const activeIndex = complianceStepIndex(phase);
  const step = compliance.steps[activeIndex]!;
  const isProving = phase === "proving";
  const backColor = "#2525AA";
  const frontColor = "#D8F1FF";

  return (
    <div className="flex flex-col items-center" style={{ width: 260 }}>
      <PipelineCardShell variant="center" active={isProving} cardRef={cardRef}>
        <div className="flex items-center justify-between" style={{ height: 40 }}>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center border-2"
              style={{ borderColor: backColor, backgroundColor: backColor, color: frontColor }}
            >
              <ShieldCheck size={14} strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: backColor }}>
                {compliance.kicker}
              </p>
              <p className="truncate text-sm font-bold text-primary">{compliance.title}</p>
            </div>
          </div>
          <span
            className="shrink-0 border-2 px-1.5 py-0.5 text-[9px] font-bold tabular-nums"
            style={{ borderColor: backColor, backgroundColor: frontColor, color: backColor }}
          >
            8 checks
          </span>
        </div>

        <PipelineCardBody
          className="border-2"
          style={{ borderColor: "rgba(37, 37, 170, 0.28)", backgroundColor: "rgba(216, 241, 255, 0.18)" }}
        >
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div
              className="relative z-10 flex h-24 w-24 flex-col items-center justify-center border-2"
              style={{ borderColor: backColor, backgroundColor: backColor }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-center gap-1 text-center"
                >
                  {activeIndex === 0 && (
                    <span className="text-sm" style={{ color: frontColor }}>···</span>
                  )}
                  {activeIndex === 1 && (
                    <Loader2 size={24} className="animate-spin" style={{ color: frontColor }} aria-hidden />
                  )}
                  {activeIndex === 2 && (
                    <ShieldCheck size={24} style={{ color: frontColor }} strokeWidth={2} aria-hidden />
                  )}
                  <span
                    className="text-[9px] font-bold uppercase leading-tight tracking-wide"
                    style={{ color: frontColor }}
                  >
                    {step.detail}
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </PipelineCardBody>

        <PipelineCardFooter className="font-bold">{step.label}</PipelineCardFooter>
      </PipelineCardShell>

      {!hideCaption && (
        <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground text-pretty">
          {compliance.caption}
        </p>
      )}
    </div>
  );
}
