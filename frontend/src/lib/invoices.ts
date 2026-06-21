export type InvoiceStatus = "pending" | "paid";

export interface Invoice {
  id: string;
  createdAt: number;
  label?: string;
  amountMicro: string;
  sourceCountry: string;
  destCountry: string;
  corridorId: number;
  recipient: string;
  status: InvoiceStatus;
  txHash?: string;
  nullifier?: string;
}

export interface InvoicePayload {
  amountMicro: string;
  sourceCountry: string;
  destCountry: string;
  corridorId: number;
  recipient: string;
  label?: string;
}

const STORAGE_KEY = "wisp_invoices_v1";

function readAll(): Invoice[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Invoice[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(invoices: Invoice[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
}

export function generateInvoiceId(): string {
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `inv_${suffix}`;
}

export function listInvoices(): Invoice[] {
  return readAll().sort((a, b) => b.createdAt - a.createdAt);
}

export function getInvoice(id: string): Invoice | null {
  return readAll().find((invoice) => invoice.id === id) ?? null;
}

export function createInvoice(payload: InvoicePayload): Invoice {
  const invoice: Invoice = {
    id: generateInvoiceId(),
    createdAt: Date.now(),
    label: payload.label?.trim() || undefined,
    amountMicro: payload.amountMicro,
    sourceCountry: payload.sourceCountry,
    destCountry: payload.destCountry,
    corridorId: payload.corridorId,
    recipient: payload.recipient,
    status: "pending",
  };
  writeAll([invoice, ...readAll()]);
  return invoice;
}

export function markInvoicePaid(
  id: string,
  settlement: { txHash: string; nullifier: string },
): Invoice | null {
  const invoices = readAll();
  const index = invoices.findIndex((invoice) => invoice.id === id);
  if (index < 0) return null;
  const updated: Invoice = {
    ...invoices[index]!,
    status: "paid",
    txHash: settlement.txHash,
    nullifier: settlement.nullifier,
  };
  invoices[index] = updated;
  writeAll(invoices);
  return updated;
}

export function upsertInvoice(invoice: Invoice): void {
  const invoices = readAll();
  const index = invoices.findIndex((item) => item.id === invoice.id);
  if (index >= 0) {
    invoices[index] = invoice;
  } else {
    invoices.unshift(invoice);
  }
  writeAll(invoices);
}

export function removeInvoice(id: string): boolean {
  const invoices = readAll();
  const invoice = invoices.find((item) => item.id === id);
  if (!invoice || invoice.status === "paid") return false;
  writeAll(invoices.filter((item) => item.id !== id));
  return true;
}
