import { Scalar, F1Field } from "ffjavascript";

const BN254_R = Scalar.fromString(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617"
);

export const F = new F1Field(BN254_R);

export function mod(n) {
  if (typeof n === "bigint") return F.e(n);
  return F.e(n);
}

export function toString(v) {
  return F.toString(v);
}
