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
    default:
      return item;
  }
}

export interface KycFormValues {
  name: string;
  dob: string;
  sanctionsClear: boolean;
}

export function validateKycForm(values: KycFormValues): string | null {
  if (!values.name.trim()) return COPY.demo.kyc.nameRequired;
  if (!values.dob) return COPY.demo.kyc.dobRequired;
  if (!values.sanctionsClear) return COPY.demo.kyc.sanctionsRequired;
  return null;
}
