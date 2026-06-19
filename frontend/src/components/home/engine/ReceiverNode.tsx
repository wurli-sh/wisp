import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Wallet } from "lucide-react";
import { COPY } from "@/content/copy";
import { receiverStepIndex, type FlowPhase } from "@/hooks/useEngineFlow";
import { PipelineCardBody, PipelineCardFooter, PipelineCardShell } from "./PipelineCardShell";

type ReceiverNodeProps = {
  phase: FlowPhase;
  cardRef?: React.RefObject<HTMLDivElement | null>;
  hideCaption?: boolean;
};

export function ReceiverNode({ phase, cardRef, hideCaption }: ReceiverNodeProps) {
  const { receiver } = COPY.engine.pipeline;
  const activeIndex = receiverStepIndex(phase);
  const step = receiver.steps[activeIndex]!;

  return (
    <div className="flex flex-col items-center" style={{ width: 220 }}>
      <PipelineCardShell cardRef={cardRef}>
        <div className="flex items-center gap-2" style={{ height: 40 }}>
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center border-2 border-primary/20 bg-primary-soft text-primary">
            <Wallet size={14} strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary-dark">
              {receiver.kicker}
            </p>
            <p className="truncate text-sm font-bold text-primary">{receiver.title}</p>
          </div>
        </div>

        <PipelineCardBody>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-3 flex flex-col justify-center gap-2"
            >
              {activeIndex === 0 && (
                <>
                  <p className="text-xs text-muted-foreground">{step.detail}</p>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-2 w-2 animate-pulse bg-border-strong" aria-hidden />
                    <span className="text-xs font-medium">{step.label}</span>
                  </div>
                  <div className="h-8 border-2 border-dashed border-border bg-background/60" />
                </>
              )}
              {activeIndex === 1 && (
                <>
                  <div className="flex items-center gap-2 text-primary">
                    <Loader2 size={14} className="animate-spin" aria-hidden />
                    <span className="text-xs font-semibold">{step.label}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{step.detail}</p>
                  <div className="border border-border bg-background px-2 py-1.5">
                    <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
                      Soroban verify
                    </p>
                    <p className="text-xs font-bold text-primary">&lt;$0.001</p>
                  </div>
                </>
              )}
              {activeIndex === 2 && (
                <>
                  <div className="flex items-center gap-2 text-success">
                    <Check size={16} strokeWidth={2.5} aria-hidden />
                    <span className="text-sm font-bold">{step.label}</span>
                  </div>
                  <p className="text-xs font-semibold tabular-nums text-foreground">{step.detail}</p>
                  <div className="flex items-center justify-between border border-success/30 bg-success-soft/50 px-2 py-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-wide text-success">
                      Settled
                    </span>
                    <span className="text-[10px] font-bold text-primary">8/8 checks</span>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </PipelineCardBody>

        <PipelineCardFooter>
          {activeIndex === 0 ? "Awaiting proof" : activeIndex === 1 ? "Verifying" : "Transfer settled"}
        </PipelineCardFooter>
      </PipelineCardShell>

      {!hideCaption && (
        <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground text-pretty">
          {receiver.caption}
        </p>
      )}
    </div>
  );
}
