import { PUBLIC_INPUT_FIELDS } from "@amoeba/bindings/publicInputs";
import { serializeSnarkjsProof, type SnarkjsProof } from "./serialize.js";
import type { ProvenTransfer } from "./prover.js";

export function buildProvenTransfer(
  proof: SnarkjsProof,
  publicSignals: string[],
): ProvenTransfer {
  const publicInputs = Object.fromEntries(
    PUBLIC_INPUT_FIELDS.map((name, i) => [name, publicSignals[i]]),
  );

  return {
    proof: serializeSnarkjsProof(proof),
    snarkjsProof: proof,
    publicSignals,
    publicInputs,
    nullifier: publicInputs.nullifier,
  };
}
