import { normalizeField } from "@amoeba/js";

function decimalToBeHex(decimal: string): string {
  const n = normalizeField(decimal);
  return n.toString(16).padStart(64, "0");
}

export function serializeG1(piA: [string, string, string]): Buffer {
  return Buffer.from(decimalToBeHex(piA[0]) + decimalToBeHex(piA[1]), "hex");
}

export function serializeG2(piB: [[string, string], [string, string], [string, string]]): Buffer {
  const hex =
    decimalToBeHex(piB[0][1]) +
    decimalToBeHex(piB[0][0]) +
    decimalToBeHex(piB[1][1]) +
    decimalToBeHex(piB[1][0]);
  return Buffer.from(hex, "hex");
}

export interface SnarkjsProof {
  pi_a: [string, string, string];
  pi_b: [[string, string], [string, string], [string, string]];
  pi_c: [string, string, string];
}

export interface SerializedProof {
  a: Buffer;
  b: Buffer;
  c: Buffer;
}

export function serializeSnarkjsProof(proof: SnarkjsProof): SerializedProof {
  return {
    a: serializeG1(proof.pi_a),
    b: serializeG2(proof.pi_b),
    c: serializeG1(proof.pi_c),
  };
}
