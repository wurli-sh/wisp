import { Loader2 } from "lucide-react";
import type { MockKycStatusResponse } from "@wisp_/sdk/browser";
import { COPY } from "@/content/copy";
import { Button } from "@/components/ui/Button";
import { useApproveRecipientDestination } from "@/hooks/useApproveRecipientDestination";

function truncate(str: string, head = 8, tail = 4): string {
  if (str.length <= head + tail + 3) return str;
  return `${str.slice(0, head)}…${str.slice(-tail)}`;
}

interface ApproveRecipientBannerProps {
  recipient: string | null;
  corridorId: number | null;
  kycStatus: MockKycStatusResponse | null;
  onApproved?: () => void | Promise<void>;
}

export function ApproveRecipientBanner({
  recipient,
  corridorId,
  kycStatus,
  onApproved,
}: ApproveRecipientBannerProps) {
  const { needsApproval, approving, approveRecipient } = useApproveRecipientDestination({
    recipient,
    corridorId,
    kycStatus,
    onApproved,
  });

  if (!needsApproval) return null;

  const copy = COPY.approveRecipient;
  const recipientTrimmed = recipient?.trim() ?? "";

  return (
    <div className="border-2 border-brand/40 bg-brand-soft/50 px-4 py-3">
      <p className="text-sm font-semibold text-primary">{copy.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {copy.body.replace("{recipient}", truncate(recipientTrimmed, 12, 8))}
      </p>
      <div className="mt-3">
        <Button
          type="button"
          size="sm"
          disabled={approving}
          onClick={() => void approveRecipient()}
          className="gap-2"
        >
          {approving ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {copy.approving}
            </>
          ) : (
            copy.action
          )}
        </Button>
      </div>
    </div>
  );
}
