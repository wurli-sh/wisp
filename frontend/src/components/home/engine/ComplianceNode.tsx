import { AnimatePresence, motion } from "framer-motion";
import { Loader2, ShieldCheck } from "lucide-react";
import { COPY } from "@/content/copy";
import { cn } from "@/lib/cn";
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

  return (
    <div className="flex flex-col items-center" style={{ width: 260 }}>
      <PipelineCardShell
        variant="center"
        active={false}
        cardRef={cardRef}
        className={cn(
          "border-primary-dark bg-primary-dark shadow-none",
          isProving && "border-brand ring-2 ring-brand/35",
        )}
      >
        <div className="flex items-center justify-between" style={{ height: 40 }}>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center border-2 border-white/20 bg-brand text-white">
              <ShieldCheck size={14} strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                {compliance.kicker}
              </p>
              <p className="truncate text-sm font-bold text-white">{compliance.title}</p>
            </div>
          </div>
          <span className="shrink-0 border-2 border-white/20 bg-brand px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-white">
            8 checks
          </span>
        </div>

        <PipelineCardBody className="border-white/15 bg-primary/70 shadow-none">
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="relative z-10 flex h-24 w-24 flex-col items-center justify-center border-2 border-white/20 bg-primary-dark">
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
                    <span className="text-sm text-white">···</span>
                  )}
                  {activeIndex === 1 && (
                    <Loader2 size={24} className="animate-spin text-white" aria-hidden />
                  )}
                  {activeIndex === 2 && (
                    <ShieldCheck size={24} className="text-white" strokeWidth={2} aria-hidden />
                  )}
                  <span className="text-[9px] font-bold uppercase leading-tight tracking-wide text-white">
                    {step.detail}
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </PipelineCardBody>

        <PipelineCardFooter className="font-bold text-white">{step.label}</PipelineCardFooter>
      </PipelineCardShell>

      {!hideCaption && (
        <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground text-pretty">
          {compliance.caption}
        </p>
      )}
    </div>
  );
}
