import type { Invoice, InvoicePayload } from "@/lib/invoices";
import { getInvoice } from "@/lib/invoices";

interface EncodedInvoicePayload {
  v: 1;
  amountMicro: string;
  sourceCountry: string;
  destCountry: string;
  corridorId: number;
  recipient: string;
  label?: string;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (padded.length % 4)) % 4;
    const binary = atob(padded + "=".repeat(padLen));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function payloadFromInvoice(
  invoice: Pick<
    Invoice,
    "amountMicro" | "sourceCountry" | "destCountry" | "corridorId" | "recipient" | "label"
  >,
): EncodedInvoicePayload {
  return {
    v: 1,
    amountMicro: invoice.amountMicro,
    sourceCountry: invoice.sourceCountry,
    destCountry: invoice.destCountry,
    corridorId: invoice.corridorId,
    recipient: invoice.recipient,
    label: invoice.label,
  };
}

export function encodeInvoicePayload(
  invoice: Pick<
    Invoice,
    "amountMicro" | "sourceCountry" | "destCountry" | "corridorId" | "recipient" | "label"
  >,
): string {
  const json = JSON.stringify(payloadFromInvoice(invoice));
  return toBase64Url(new TextEncoder().encode(json));
}

export function decodeInvoicePayload(encoded: string): InvoicePayload | null {
  if (!encoded.trim()) return null;
  const bytes = fromBase64Url(encoded.trim());
  if (!bytes) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as EncodedInvoicePayload;
    if (parsed.v !== 1) return null;
    if (
      typeof parsed.amountMicro !== "string" ||
      typeof parsed.sourceCountry !== "string" ||
      typeof parsed.destCountry !== "string" ||
      typeof parsed.corridorId !== "number" ||
      typeof parsed.recipient !== "string"
    ) {
      return null;
    }
    return {
      amountMicro: parsed.amountMicro,
      sourceCountry: parsed.sourceCountry,
      destCountry: parsed.destCountry,
      corridorId: parsed.corridorId,
      recipient: parsed.recipient,
      label: typeof parsed.label === "string" ? parsed.label : undefined,
    };
  } catch {
    return null;
  }
}

export function invoiceFromPayload(id: string, payload: InvoicePayload): Invoice {
  return {
    id,
    createdAt: Date.now(),
    label: payload.label,
    amountMicro: payload.amountMicro,
    sourceCountry: payload.sourceCountry,
    destCountry: payload.destCountry,
    corridorId: payload.corridorId,
    recipient: payload.recipient,
    status: "pending",
  };
}

export function resolveInvoice(
  id: string | null,
  encoded: string | null,
): Invoice | null {
  if (id && encoded) {
    const payload = decodeInvoicePayload(encoded);
    if (payload) return invoiceFromPayload(id, payload);
  }
  if (id) {
    return getInvoice(id);
  }
  return null;
}

/** @alias encodeInvoicePayload */
export const encodeInvoice = encodeInvoicePayload;

/** @alias decodeInvoicePayload */
export const decodeInvoice = decodeInvoicePayload;

export function buildPayLink(invoice: Invoice, origin = window.location.origin): string {
  const d = encodeInvoicePayload(invoice);
  return `${origin}/pay/${invoice.id}?d=${encodeURIComponent(d)}`;
}

export function parsePayLinkInput(input: string): { id: string; d: string | null } {
  const value = input.trim();
  try {
    const url = new URL(value, window.location.origin);
    const segments = url.pathname.split("/").filter(Boolean);
    const payIndex = segments.indexOf("pay");
    if (payIndex >= 0 && segments[payIndex + 1]) {
      return {
        id: decodeURIComponent(segments[payIndex + 1]!),
        d: url.searchParams.get("d"),
      };
    }
    if (url.pathname === "/wisp-pay") {
      return {
        id: url.searchParams.get("id")?.trim() || value,
        d: url.searchParams.get("d"),
      };
    }
  } catch {
    // Fall through and treat the input as a raw invoice id.
  }
  return { id: value, d: null };
}
