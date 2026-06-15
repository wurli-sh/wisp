/**
 * Decode Stellar StrKey (G/C/...) to raw payload bytes (32-byte account/contract id).
 */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function decodeStrKey(strkey) {
  const cleaned = strkey.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of cleaned) {
    const idx = ALPHABET.indexOf(char);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 0xff);
    }
  }
  return Buffer.from(bytes.slice(0, -2));
}

/** Account (G) or contract (C) StrKey → 32-byte payload used in circuit limbs. */
export function strKeyToPayload(strkey) {
  const raw = decodeStrKey(strkey);
  return raw.subarray(1, 33);
}

export function payloadToHex(payload) {
  return Buffer.from(payload).toString("hex");
}
