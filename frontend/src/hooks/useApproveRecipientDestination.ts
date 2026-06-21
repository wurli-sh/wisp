import { useCallback, useState } from "react";
import type { MockKycStatusResponse } from "@wisp_/sdk";
import { toast } from "sonner";
import { COPY } from "@/content/copy";
import { env } from "@/config/env";
import { useDemoIssuerClient } from "@/hooks/useDemoIssuerClient";
import { formatDemoError } from "@/lib/demoLog";

function truncate(str: string, head = 8, tail = 4): string {
  if (str.length <= head + tail + 3) return str;
  return `${str.slice(0, head)}…${str.slice(-tail)}`;
}

export function useApproveRecipientDestination(opts: {
  recipient: string | null;
  corridorId: number | null;
  kycStatus: MockKycStatusResponse | null;
  onApproved?: () => void | Promise<void>;
}) {
  const { recipient, corridorId, kycStatus, onApproved } = opts;
  const demoIssuer = useDemoIssuerClient();
  const [approving, setApproving] = useState(false);

  const recipientTrimmed = recipient?.trim() ?? "";
  const adminToken = env.issuerAdminToken;
  const needsApproval = Boolean(
    adminToken &&
      recipientTrimmed.length > 0 &&
      corridorId != null &&
      kycStatus != null &&
      kycStatus.missing.includes("destination"),
  );

  const approveRecipient = useCallback(async (): Promise<boolean> => {
    if (!adminToken) {
      toast.error(COPY.approveRecipient.noAdminToken);
      return false;
    }
    if (!recipientTrimmed || corridorId == null) {
      return false;
    }
    setApproving(true);
    try {
      await demoIssuer.addCorridorDestination(corridorId, recipientTrimmed, adminToken);
      const publish = await demoIssuer.publishIssuerRoots(adminToken, corridorId);
      const failed = publish.results.find((item) => item.status === "failed");
      if (failed) {
        throw new Error(failed.message ?? "Root publish failed");
      }
      toast.success(COPY.approveRecipient.approvedToast.replace("{recipient}", truncate(recipientTrimmed)));
      await onApproved?.();
      return true;
    } catch (e) {
      toast.error(formatDemoError(e).split("\n")[0] ?? String(e));
      return false;
    } finally {
      setApproving(false);
    }
  }, [adminToken, corridorId, demoIssuer, onApproved, recipientTrimmed]);

  return {
    needsApproval,
    approving,
    approveRecipient,
    canApprove: Boolean(adminToken),
  };
}
