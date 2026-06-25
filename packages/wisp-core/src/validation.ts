import {
  PUBLIC_INPUT_FIELDS,
  normalizeField,
  publicSignalsMatch,
  rebuildExpectedPublicInputsFromRoots,
  type ProofPackage,
} from "@wisp_/js";
import { validatePackageStructure } from "./structure.js";

export interface PureValidatePackageOptions {
  corridorId: number;
}

export interface PureValidatePackageResult {
  ok: true;
  publicInputs: Record<string, string>;
}

export interface ValidationPolicy {
  strict: boolean;
  skipChain: boolean;
  checkVkHash: boolean;
}

export const validationPolicies = {
  strictProduction(): ValidationPolicy {
    return { strict: true, skipChain: false, checkVkHash: true };
  },
  fastTrustedIssuer(): ValidationPolicy {
    return { strict: false, skipChain: false, checkVkHash: false };
  },
  offlineOnly(): ValidationPolicy {
    return { strict: false, skipChain: true, checkVkHash: false };
  },
  testMode(): ValidationPolicy {
    return { strict: false, skipChain: true, checkVkHash: false };
  },
};

export function rebuildProofPackagePublicInputs(
  pkg: ProofPackage,
  corridorId: number,
): Record<string, string> {
  validatePackageStructure(pkg);

  if (!pkg.roots || !pkg.transfer || !pkg.public_inputs) {
    throw new Error("ProofPackage incomplete after structure check");
  }

  const nullifier = String(pkg.public_inputs.nullifier ?? "");
  if (!nullifier) {
    throw new Error("ProofPackage public_inputs.nullifier required for validation");
  }

  const rebuilt = rebuildExpectedPublicInputsFromRoots(
    pkg.roots as {
      merkle_root: string;
      sanctions_root: string;
      jurisdiction_root: string;
      corridor_config_hash: string;
      source_jurisdiction_root: string;
      dest_address_root: string;
    },
    {
      asset: String(pkg.transfer.asset ?? ""),
      sender: String(pkg.transfer.sender ?? ""),
      recipient: String(pkg.transfer.recipient ?? ""),
      amount: String(pkg.transfer.amount ?? ""),
      corridor_id: Number(pkg.transfer.corridor_id ?? corridorId),
      epoch: pkg.transfer.epoch ?? 0,
    },
    nullifier,
  );

  const out: Record<string, string> = {};
  PUBLIC_INPUT_FIELDS.forEach((name: string, index: number) => {
    out[name] = rebuilt[index].toString();
  });
  return out;
}

export function assertProofPackagePublicInputsMatch(
  pkg: ProofPackage,
  opts: PureValidatePackageOptions,
): Record<string, string> {
  const expected = rebuildProofPackagePublicInputs(pkg, opts.corridorId);
  const fromPackage = PUBLIC_INPUT_FIELDS.map((name: string) =>
    normalizeField(String(pkg.public_inputs?.[name] ?? "0")).toString(),
  ).map((d: string) => BigInt(d));
  const rebuilt = PUBLIC_INPUT_FIELDS.map((name: string) => BigInt(expected[name]));

  if (!publicSignalsMatch(fromPackage, rebuilt)) {
    throw new Error(
      "ProofPackage public_inputs do not match roots + transfer (PublicInputMismatch)",
    );
  }

  return expected;
}

export function validateProofPackage(
  pkg: ProofPackage,
  opts: PureValidatePackageOptions,
): PureValidatePackageResult {
  const publicInputs = assertProofPackagePublicInputsMatch(pkg, opts);
  return { ok: true, publicInputs };
}
