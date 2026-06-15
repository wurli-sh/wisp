import { normalizeField } from "./field.mjs";

function decimalToBeHex(decimal) {
  const n = normalizeField(decimal);
  return n.toString(16).padStart(64, "0");
}

export function serializeG1(piA) {
  return Buffer.from(decimalToBeHex(piA[0]) + decimalToBeHex(piA[1]), "hex");
}

export function serializeG2(piB) {
  const hex =
    decimalToBeHex(piB[0][1]) +
    decimalToBeHex(piB[0][0]) +
    decimalToBeHex(piB[1][1]) +
    decimalToBeHex(piB[1][0]);
  return Buffer.from(hex, "hex");
}

export function serializeSnarkjsProof(proof) {
  return {
    a: serializeG1(proof.pi_a),
    b: serializeG2(proof.pi_b),
    c: serializeG1(proof.pi_c),
  };
}
