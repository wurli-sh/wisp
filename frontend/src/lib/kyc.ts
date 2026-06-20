import type { MockKycStatusResponse, MockKycSubmitResponse } from "@wisp_/sdk";
import { COPY } from "@/content/copy";

export function kycMissingLabel(item: string): string {
  const { missing } = COPY.demo.kyc;
  switch (item) {
    case "kyc":
      return missing.kyc;
    case "destination":
      return missing.destination;
    case "roots_published":
      return missing.roots;
    case "corridor":
      return missing.corridor;
    case "sender_corridor":
      return missing.sender_corridor;
    default:
      return item;
  }
}

export function normalizeKycStatus(
  status: MockKycStatusResponse | MockKycSubmitResponse,
): MockKycStatusResponse {
  return {
    wallet: "wallet" in status ? status.wallet : "",
    kyc_status: status.kyc_status,
    eligible_for_proof: status.eligible_for_proof,
    missing: status.missing,
    roots_status: status.roots_status,
    roots_message: status.roots_message,
    rejection_reason: status.rejection_reason,
    publish_warning: status.publish_warning,
  };
}

export function kycRootsLabel(status: MockKycStatusResponse | null): string | null {
  if (!status) return null;
  if (status.roots_message) return status.roots_message;
  switch (status.roots_status) {
    case "publishing":
      return "Issuer is publishing roots for the selected corridor.";
    case "failed":
      return "Issuer root publication failed. Retry after the operator fixes the corridor.";
    case "missing":
      return COPY.demo.kyc.missing.roots;
    default:
      return null;
  }
}
