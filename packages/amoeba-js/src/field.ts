import { Scalar, F1Field } from "ffjavascript";
import type { FieldElement } from "./types.js";

const BN254_SCALAR = Scalar.fromString(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617",
);

export const F = new F1Field(BN254_SCALAR);

export const BN254_R =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export function normalizeField(decimal: string): bigint {
  let n = BigInt(decimal);
  n = ((n % BN254_R) + BN254_R) % BN254_R;
  return n;
}

export function mod(n: bigint | string | number | FieldElement): FieldElement {
  if (typeof n === "bigint" || typeof n === "string" || typeof n === "number") {
    return F.e(n);
  }
  return n;
}

export function toString(v: FieldElement): string {
  return F.toString(v);
}
