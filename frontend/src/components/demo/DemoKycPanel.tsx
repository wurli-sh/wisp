import { ShieldCheck } from "lucide-react";
import type { MockKycStatusResponse } from "@amoeba/sdk";
import { COPY } from "@/content/copy";
import { useWallet } from "@/hooks/useWallet";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { kycMissingLabel, kycRootsLabel } from "@/lib/kyc";

interface DemoKycPanelProps {
  status: MockKycStatusResponse | null;
  skipped?: boolean;
  onReopen?: () => void;
}

export function DemoKycPanel({ status, skipped, onReopen }: DemoKycPanelProps) {
  const { address } = useWallet();

  const approved = status?.kyc_status === "approved";
  const revoked = status?.kyc_status === "revoked";
  const rejected = status?.kyc_status === "rejected";

  if (!address) return null;

  const hint = revoked
    ? COPY.demo.kyc.revokedHint
    : rejected
      ? [
          COPY.demo.kyc.rejectedHint,
          status.rejection_reason ? `Issue: ${status.rejection_reason}` : null,
          COPY.demo.kyc.wizard.rejectedRequirements,
        ]
          .filter(Boolean)
          .join(" ")
      : approved
        ? status.missing.length > 0
          ? status.missing
              .map((item) => (item === "roots_published" ? kycRootsLabel(status) : kycMissingLabel(item)) ?? item)
              .join(" · ")
          : COPY.demo.kyc.approvedHint
        : COPY.demo.kyc.subtitle;

  const showRetry = (skipped || rejected) && !approved && !revoked && onReopen;

  return (
    <section
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 border-2 px-4 py-2.5 ${
        approved
          ? "border-success/30 bg-success-soft/40"
          : revoked
            ? "border-destructive/30 bg-destructive/5"
            : rejected
              ? "border-warning/40 bg-warning/10"
              : "border-primary/15 bg-primary/3"
      }`}
    >
      <div className="flex shrink-0 items-center gap-2">
        <ShieldCheck
          className={`h-3.5 w-3.5 ${approved ? "text-success" : rejected ? "text-warning" : "text-primary"}`}
        />
        <h2 className="text-xs font-bold uppercase tracking-wide text-primary">{COPY.demo.kyc.title}</h2>
        <Badge
          variant={approved ? "success" : revoked ? "danger" : rejected ? "warning" : "warning"}
          className="py-0.5 text-[10px]"
        >
          {approved
            ? COPY.demo.kyc.approved
            : revoked
              ? COPY.demo.kyc.revoked
              : rejected
                ? COPY.demo.kyc.rejected
                : COPY.demo.kyc.required}
        </Badge>
      </div>

      <p
        className={`min-w-0 flex-1 text-xs leading-snug ${
          revoked
            ? "text-destructive"
            : rejected
              ? "text-warning"
              : approved && !status?.missing.length
                ? "text-success"
                : "text-muted-foreground"
        }`}
      >
        {hint}
      </p>

      {showRetry && (
        <Button size="sm" variant="outline" className="h-8 shrink-0 px-3 text-xs" onClick={onReopen}>
          {rejected ? COPY.demo.kyc.wizard.retry : COPY.demo.kyc.wizard.reopen}
        </Button>
      )}
    </section>
  );
}
