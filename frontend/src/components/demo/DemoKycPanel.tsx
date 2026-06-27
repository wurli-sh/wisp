import { ShieldCheck } from "lucide-react";
import type { MockKycStatusResponse } from "@wisp_/sdk/browser";
import { COPY } from "@/content/copy";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { kycMissingLabel, kycRootsLabel } from "@/lib/kyc";

interface DemoKycPanelProps {
  status: MockKycStatusResponse | null;
  skipped?: boolean;
  onReopen?: () => void;
}

export function DemoKycPanel({ status, skipped, onReopen }: DemoKycPanelProps) {
  const approved = status?.kyc_status === "approved";
  const revoked = status?.kyc_status === "revoked";
  const rejected = status?.kyc_status === "rejected";

  // Keep the hint to a single, friendly line. When verified-but-incomplete we
  // surface only the first outstanding item rather than a long concatenation.
  const firstMissing = approved
    ? status.missing
        .map((item) => (item === "roots_published" ? kycRootsLabel(status) : kycMissingLabel(item)) ?? item)
        .find(Boolean) ?? null
    : null;

  const hint = revoked
    ? COPY.demo.kyc.revokedHint
    : rejected
      ? COPY.demo.kyc.rejectedHint
      : approved
        ? firstMissing ?? COPY.demo.kyc.approvedHint
        : COPY.demo.kyc.subtitle;

  // Offer the re-verify affordance whenever the wallet still needs action:
  // not yet verified (skipped/rejected) OR verified but not yet eligible
  // (e.g. credential activation still pending so issuer roots can't publish).
  const approvedIncomplete = approved && (status?.missing.length ?? 0) > 0;
  const showRetry = (skipped || rejected || approvedIncomplete) && !revoked && Boolean(onReopen);

  return (
    <section
      className={cn(
        "flex flex-col gap-2 border-2 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-2 sm:py-2.5",
        approved
          ? "border-brand/25 bg-brand-soft/70"
          : revoked
            ? "border-destructive/30 bg-destructive/5"
            : rejected
              ? "border-warning/40 bg-warning/10"
              : "border-border bg-card",
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <ShieldCheck
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            approved ? "text-brand" : revoked ? "text-destructive" : rejected ? "text-warning" : "text-primary",
          )}
        />
        <h2 className="text-xs font-bold uppercase tracking-wide text-primary">{COPY.demo.kyc.title}</h2>
        <Badge
          variant={approved ? "brand" : revoked ? "danger" : rejected ? "warning" : "warning"}
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
        className={cn(
          "w-full text-xs leading-relaxed sm:min-w-0 sm:flex-1 sm:leading-snug",
          revoked
            ? "text-destructive"
            : rejected
              ? "text-warning"
              : approved && !status?.missing.length
                ? "text-primary"
                : "text-muted-foreground",
        )}
      >
        {hint}
      </p>

      {showRetry && (
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-full shrink-0 px-3 text-xs sm:w-auto"
          onClick={onReopen}
        >
          {rejected ? COPY.demo.kyc.wizard.retry : COPY.demo.kyc.wizard.reopen}
        </Button>
      )}
    </section>
  );
}
