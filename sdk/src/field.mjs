export const BN254_R =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export function normalizeField(decimal) {
  let n = BigInt(decimal);
  n = ((n % BN254_R) + BN254_R) % BN254_R;
  return n;
}

export function fieldDecimalToBytes32(decimal) {
  const n = normalizeField(decimal);
  return Buffer.from(n.toString(16).padStart(64, "0"), "hex");
}

export function fieldDecimalToU256String(decimal) {
  return normalizeField(decimal).toString();
}
