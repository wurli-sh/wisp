/** E2E fixtures for Wisp Pay Links (mirrors lib/invoiceCodec v1 payload). */

export const E2E_RECIPIENT = "GAYDCK6WLSO3CEOINAUXLPIK75V4Z65THQ77TBRQWSLIWEOMA4JMUEZJ";

export const E2E_CORRIDORS = [
  {
    id: 1,
    name: "US → MX",
    source_country: "US",
    dest_country: "MX",
    enabled: true,
  },
] as const;

export interface E2eInvoicePayload {
  amountMicro: string;
  sourceCountry: string;
  destCountry: string;
  corridorId: number;
  recipient: string;
  label?: string;
}

export interface E2eStoredInvoice extends E2eInvoicePayload {
  id: string;
  createdAt: number;
  status: "pending" | "paid";
  txHash?: string;
  nullifier?: string;
}

export function encodeInvoicePayloadForTest(payload: E2eInvoicePayload): string {
  const json = JSON.stringify({
    v: 1,
    amountMicro: payload.amountMicro,
    sourceCountry: payload.sourceCountry,
    destCountry: payload.destCountry,
    corridorId: payload.corridorId,
    recipient: payload.recipient,
    label: payload.label,
  });
  return Buffer.from(json).toString("base64url");
}

export function sampleInvoicePayload(overrides: Partial<E2eInvoicePayload> = {}): E2eInvoicePayload {
  return {
    amountMicro: "250000000",
    sourceCountry: "US",
    destCountry: "MX",
    corridorId: 1,
    recipient: E2E_RECIPIENT,
    label: "E2E vendor payout",
    ...overrides,
  };
}

export function sampleStoredInvoice(
  id: string,
  overrides: Partial<E2eStoredInvoice> = {},
): E2eStoredInvoice {
  return {
    id,
    createdAt: Date.now(),
    status: "pending",
    ...sampleInvoicePayload(),
    ...overrides,
  };
}

export function payLinkPath(id: string, payload: E2eInvoicePayload): string {
  const d = encodeInvoicePayloadForTest(payload);
  return `/pay/${id}?d=${encodeURIComponent(d)}`;
}

export const INVOICE_STORAGE_KEY = "wisp_invoices_v1";
