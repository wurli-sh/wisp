import { Link } from "react-router-dom";
import { useMemo } from "react";
import { COPY } from "@/content/copy";
import { WispPayCreatePanel } from "@/components/wisp-pay/WispPayCreatePanel";
import { WispPayPanel } from "@/components/wisp-pay/WispPayPanel";
import { WispPayReceiptPanel } from "@/components/wisp-pay/WispPayReceiptPanel";
import { Tabs } from "@/components/ui/Tabs";
import { useWispPayUrlState, type WispPayMode } from "@/hooks/useWispPayUrlState";
import { markInvoicePaid, upsertInvoice } from "@/lib/invoices";
import { encodeInvoicePayload, parsePayLinkInput, resolveInvoice } from "@/lib/invoiceCodec";

const TAB_ITEMS = [
  { key: "create", label: "Create" },
  { key: "pay", label: "Pay" },
  { key: "receipt", label: "Receipt" },
] as const;

export function WispPayPage() {
  const {
    mode,
    invoiceId,
    txHash,
    encodedPayload,
    setMode,
    loadPayInvoice,
    openReceipt,
  } = useWispPayUrlState();

  const invoice = useMemo(
    () => resolveInvoice(invoiceId, encodedPayload),
    [encodedPayload, invoiceId],
  );

  const invalidPayLink = useMemo(
    () => mode === "pay" && Boolean(invoiceId || encodedPayload) && !invoice,
    [encodedPayload, invoice, invoiceId, mode],
  );

  const handleLoadPayInvoice = (id: string) => {
    const parsed = parsePayLinkInput(id);
    const resolved = resolveInvoice(parsed.id, parsed.d);
    const d = parsed.d ?? (resolved ? encodeInvoicePayload(resolved) : null);
    loadPayInvoice(parsed.id, d);
  };

  const handleGoToPay = (id: string) => {
    handleLoadPayInvoice(id);
  };

  const handleLoadReceiptTx = (tx: string) => {
    openReceipt({ tx });
  };

  const handleLoadReceiptInvoice = (id: string) => {
    const parsed = parsePayLinkInput(id);
    openReceipt({ id: parsed.id });
  };

  const handleTabChange = (key: string) => {
    setMode(key as WispPayMode);
  };

  const handlePaymentSuccess = (result: {
    txHash: string;
    nullifier: string;
    invoiceId: string;
  }) => {
    markInvoicePaid(result.invoiceId, {
      txHash: result.txHash,
      nullifier: result.nullifier,
    });
    if (invoice && invoice.id === result.invoiceId) {
      upsertInvoice({
        ...invoice,
        status: "paid",
        txHash: result.txHash,
        nullifier: result.nullifier,
      });
    }
    openReceipt({ id: result.invoiceId, tx: result.txHash });
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 py-8 lg:gap-8 lg:py-12">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-brand">
          {COPY.wispPay.eyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-primary sm:text-3xl">
          {COPY.wispPay.title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {COPY.wispPay.subtitle}
        </p>
      </div>

      <div className="border-2 border-border bg-background shadow-soft">
        <Tabs items={[...TAB_ITEMS]} active={mode} onChange={handleTabChange} layoutId="wispPayTab" />
        <div className="p-6">
          {mode === "create" && <WispPayCreatePanel />}
          {mode === "pay" && (
            <WispPayPanel
              invoice={invoice}
              invalidLink={invalidPayLink}
              showLookup={!invoice}
              onLoadInvoice={handleLoadPayInvoice}
              onPaymentSuccess={handlePaymentSuccess}
            />
          )}
          {mode === "receipt" && (
            <WispPayReceiptPanel
              invoice={invoice}
              txHash={txHash}
              onLoadInvoice={handleLoadReceiptInvoice}
              onLoadTx={handleLoadReceiptTx}
              onGoToPay={handleGoToPay}
            />
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {COPY.wispPay.demoLinkPrefix}{" "}
        <Link to="/demo" className="font-semibold text-brand underline-offset-2 hover:underline">
          {COPY.wispPay.demoLinkLabel}
        </Link>
      </p>
    </div>
  );
}
