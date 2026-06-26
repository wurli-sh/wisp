import { useRef } from "react";
import { COPY } from "@/content/copy";
import { useEngineFlow } from "@/hooks/useEngineFlow";
import { ComplianceNode } from "./ComplianceNode";
import { FlowConnectors } from "./FlowConnectors";
import { IssuerNode } from "./IssuerNode";
import { PipelineMetric } from "./PipelineMetric";
import { ReceiverNode } from "./ReceiverNode";
import { CARD_H } from "./constants";

function MobileConnector({ metric }: { metric?: { value: string; label: string } }) {
  return (
    <div className="flex flex-col items-center py-2 lg:hidden" aria-hidden>
      {metric && (
        <PipelineMetric value={metric.value} label={metric.label} className="mb-2" />
      )}
      <div className="h-6 w-px border-l-2 border-dashed border-primary/40" />
      <div className="my-1 h-1.5 w-1.5 bg-primary-dark" />
      <div className="h-6 w-px border-l-2 border-dashed border-primary/40" />
    </div>
  );
}

export function EnginePipeline({ active = true }: { active?: boolean }) {
  const phase = useEngineFlow(active);
  const cardsRowRef = useRef<HTMLDivElement>(null);
  const issuerRef = useRef<HTMLDivElement>(null);
  const complianceRef = useRef<HTMLDivElement>(null);
  const receiverRef = useRef<HTMLDivElement>(null);
  const { metrics, issuer, compliance, receiver } = COPY.engine.pipeline;

  return (
    <div className="relative mx-auto w-full max-w-6xl px-2">
      <div className="hidden lg:block">
        <div
          ref={cardsRowRef}
          className="relative flex items-center justify-between"
          style={{ height: CARD_H }}
        >
          <FlowConnectors
            containerRef={cardsRowRef}
            issuerRef={issuerRef}
            complianceRef={complianceRef}
            receiverRef={receiverRef}
            phase={phase}
            leftMetric={metrics.left}
            rightMetric={metrics.right}
          />

          <IssuerNode phase={phase} cardRef={issuerRef} hideCaption />
          <ComplianceNode phase={phase} cardRef={complianceRef} hideCaption />
          <ReceiverNode phase={phase} cardRef={receiverRef} hideCaption />
        </div>

        <div className="mt-3 flex items-start justify-between">
          <p
            className="text-center text-xs leading-relaxed text-muted-foreground text-pretty"
            style={{ width: 220 }}
          >
            {issuer.caption}
          </p>
          <p
            className="text-center text-xs leading-relaxed text-muted-foreground text-pretty"
            style={{ width: 260 }}
          >
            {compliance.caption}
          </p>
          <p
            className="text-center text-xs leading-relaxed text-muted-foreground text-pretty"
            style={{ width: 220 }}
          >
            {receiver.caption}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center lg:hidden">
        <IssuerNode phase={phase} />
        <MobileConnector metric={metrics.left} />
        <ComplianceNode phase={phase} />
        <MobileConnector metric={metrics.right} />
        <ReceiverNode phase={phase} />
      </div>
    </div>
  );
}
