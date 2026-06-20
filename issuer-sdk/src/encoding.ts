import { normalizeField } from "@wisp_/js";
import type { RootHashInput } from "./types.js";

function bytesToCanonicalHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

function isHexInput(value: string): boolean {
  return /^(0x)?[0-9a-fA-F]+$/.test(value);
}

function isDecimalInput(value: string): boolean {
  return /^[0-9]+$/.test(value);
}

export function normalizeRootHashToBytes(input: RootHashInput): Buffer {
  if (Buffer.isBuffer(input)) {
    if (input.length !== 32) {
      throw new Error(`expected 32-byte Buffer, received ${input.length} bytes`);
    }
    return Buffer.from(input);
  }

  if (input instanceof Uint8Array) {
    if (input.length !== 32) {
      throw new Error(`expected 32-byte Uint8Array, received ${input.length} bytes`);
    }
    return Buffer.from(input);
  }

  const value = input.trim();
  if (!value) {
    throw new Error("root/hash input must not be empty");
  }

  if (/^(0x)?[0-9a-fA-F]{64}$/.test(value)) {
    const hex = value.startsWith("0x") ? value.slice(2) : value;
    return Buffer.from(hex.toLowerCase(), "hex");
  }

  if (isDecimalInput(value)) {
    const field = normalizeField(value);
    return Buffer.from(field.toString(16).padStart(64, "0"), "hex");
  }

  throw new Error("root/hash input must be 32-byte hex, canonical field decimal, or bytes");
}

export function normalizeRootHashToHex(input: RootHashInput): string {
  return bytesToCanonicalHex(normalizeRootHashToBytes(input));
}
