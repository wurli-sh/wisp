import { AnimatePresence, motion } from "framer-motion";
import { Building2, FileText, Loader2 } from "lucide-react";
import { COPY } from "@/content/copy";
import { issuerStepIndex, type FlowPhase } from "@/hooks/useEngineFlow";
import { PipelineCardBody, PipelineCardFooter, PipelineCardShell } from "./PipelineCardShell";

type IssuerNodeProps = {
  phase: FlowPhase;
  cardRef?: React.RefObject<HTMLDivElement | null>;
  hideCaption?: boolean;
};

export function IssuerNode({ phase, cardRef, hideCaption }: IssuerNodeProps) {
  const { issuer } = COPY.engine.pipeline;
  const activeIndex = issuerStepIndex(phase);
  const step = issuer.steps[activeIndex]!;

  return (
    <div className="flex flex-col items-center" style={{ width: 220 }}>
      <PipelineCardShell cardRef={cardRef}>
        <div className="flex items-center gap-2" style={{ height: 40 }}>
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center border-2 border-primary/20 bg-primary-soft text-primary">
            <Building2 size={14} strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary-bright">
              {issuer.kicker}
            </p>
            <p className="truncate text-sm font-bold text-primary">{issuer.title}</p>
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
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileText size={14} aria-hidden />
                    <span className="text-xs">{step.detail}</span>
                  </div>
                  <div className="h-10 border-2 border-dashed border-border bg-background/80" />
                  <div className="flex items-center gap-2 text-primary">
                    <Loader2 size={14} className="animate-spin" aria-hidden />
                    <span className="text-xs font-semibold">{step.label}</span>
                  </div>
                </>
              )}
              {activeIndex === 2 && (
                <>
                  <p className="text-xs font-semibold text-primary">{step.label}</p>
                  <code className="block truncate border border-border bg-background px-2 py-1.5 text-[10px] tabular-nums text-muted-foreground">
                    {step.detail}
                  </code>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 bg-success" aria-hidden />
                    <span className="text-[10px] font-bold uppercase tracking-wide text-success">
                      Root published
                    </span>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </PipelineCardBody>

        <PipelineCardFooter>
          {activeIndex === 0 ? "Verifying identity" : "Credential on-chain"}
        </PipelineCardFooter>
      </PipelineCardShell>

      {!hideCaption && (
        <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground text-pretty">
          {issuer.caption}
        </p>
      )}
    </div>
  );
}
