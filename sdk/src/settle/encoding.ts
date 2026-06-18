import { normalizeField } from "@amoeba_/js";

export function fieldDecimalToBytes32(decimal: string): Buffer {
  const n = normalizeField(decimal);
  return Buffer.from(n.toString(16).padStart(64, "0"), "hex");
}

export function fieldDecimalToU256String(decimal: string): string {
  return normalizeField(decimal).toString();
}

export { normalizeField } from "@amoeba_/js";
