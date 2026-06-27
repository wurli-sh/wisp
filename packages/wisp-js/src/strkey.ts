/**
 * Decode Stellar StrKey (G/C/...) to raw payload bytes (32-byte account/contract id).
 */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function crc16Xmodem(bytes: Uint8Array): number {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

export function decodeStrKey(strkey: string): Buffer {
  const cleaned = strkey.trim().toUpperCase();
  if (!cleaned || /[^A-Z2-7]/.test(cleaned)) {
    throw new Error("invalid Stellar StrKey: expected canonical base32");
  }

  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of cleaned) {
    const idx = ALPHABET.indexOf(char);
    value = (value << 5) | idx;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 0xff);
    }
  }

  const decoded = Buffer.from(bytes);
  if (decoded.length < 3) {
    throw new Error("invalid Stellar StrKey: value is too short");
  }
  const payload = decoded.subarray(0, -2);
  const expected = decoded.at(-2)! | (decoded.at(-1)! << 8);
  if (crc16Xmodem(payload) !== expected) {
    throw new Error("invalid Stellar StrKey: checksum mismatch");
  }
  return payload;
}

/** Account (G) or contract (C) StrKey → 32-byte payload used in circuit limbs. */
export function strKeyToPayload(strkey: string): Buffer {
  const raw = decodeStrKey(strkey);
  if (raw.length !== 33 || (raw[0] !== 6 << 3 && raw[0] !== 2 << 3)) {
    throw new Error("invalid Stellar address: expected a G... account or C... contract StrKey");
  }
  return raw.subarray(1, 33);
}

export function payloadToHex(payload: Buffer): string {
  return Buffer.from(payload).toString("hex");
}
