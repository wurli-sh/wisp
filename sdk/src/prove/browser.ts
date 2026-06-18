import { proofPackageToWitnessInput } from "@amoeba_/js/witness";
import type { ProofPackage } from "@amoeba_/js";
import { buildProvenTransfer } from "./build.js";
import type { ProvenTransfer } from "./prover.js";
import type { SnarkjsProof } from "./serialize.js";

export interface BrowserProveUrls {
  wasmUrl: string;
  zkeyUrl: string;
}

export async function proveFromPackageBrowser(
  pkg: ProofPackage,
  urls: BrowserProveUrls,
): Promise<ProvenTransfer> {
  const witnessInput = proofPackageToWitnessInput(pkg);
  const snarkjs = await import("snarkjs");
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    witnessInput,
    urls.wasmUrl,
    urls.zkeyUrl,
  );
  return buildProvenTransfer(proof as SnarkjsProof, publicSignals as string[]);
}
