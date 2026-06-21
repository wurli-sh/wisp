import { motion } from "framer-motion";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { COPY } from "@/content/copy";
import { stellarExplorerTx } from "@/config/env";
import { WispPayLookupField } from "@/components/wisp-pay/WispPayLookupField";
import { WispPayStat, truncate } from "@/components/wisp-pay/WispPayStat";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useReceiptAudit } from "@/hooks/useReceiptAudit";
import { getCountryDisplayName } from "@/lib/countryDisplay";
import type { Invoice } from "@/lib/invoices";
import { formatUsdcDisplay } from "@/lib/transferUtils";
import { buttonHover, buttonTap } from "@/lib/animations";
import { cn } from "@/lib/cn";

interface WispPayReceiptPanelProps {
  invoice: Invoice | null;
  txHash: string | null;
  onLoadInvoice: (id: string) => void;
  onLoadTx: (tx: string) => void;
  onGoToPay: (id: string) => void;
}

function ReceiptStatusBanner({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 border-2 border-brand/25 bg-brand-soft/50 px-4 py-3">
      <Check size={18} className="shrink-0 text-brand" />
      <p className="text-sm font-bold text-primary">{title}</p>
    </div>
  );
}

function ReceiptSummaryCard({
  invoice,
  children,
}: {
  invoice: Invoice;
  children: React.ReactNode;
}) {
  const { pay, receipt } = COPY.wispPay;

  return (
    <div className="border-2 border-border bg-brand-soft/40">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-border bg-background px-6 py-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand">
            {receipt.summaryTitle}
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
            <p className="text-3xl font-bold tracking-tight text-primary">
              {formatUsdcDisplay(invoice.amountMicro)}
            </p>
            <span className="mb-1 bg-brand px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-foreground">
              USDC
            </span>
          </div>
        </div>
        <Badge variant="brand" className="mt-1">
          {COPY.wispPay.create.statusPaid}
        </Badge>
      </div>

      <div className="grid gap-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-border bg-background px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <CountryFlag code={invoice.sourceCountry} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-primary">
                {getCountryDisplayName(invoice.sourceCountry)}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {invoice.sourceCountry}
              </p>
            </div>
          </div>
          <span className="shrink-0 bg-brand px-3 py-1 text-xs font-bold text-brand-foreground">
            →
          </span>
          <div className="flex min-w-0 items-center gap-3 text-right">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-primary">
                {getCountryDisplayName(invoice.destCountry)}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {invoice.destCountry}
              </p>
            </div>
            <CountryFlag code={invoice.destCountry} size="md" />
          </div>
        </div>

        {invoice.label && (
          <WispPayStat label="Memo">
            <span className="block truncate">{invoice.label}</span>
          </WispPayStat>
        )}

        <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
          <WispPayStat label={pay.toLabel}>
            <span className="block truncate font-mono" title={invoice.recipient}>
              {truncate(invoice.recipient, 12, 8)}
            </span>
          </WispPayStat>
          <WispPayStat label="Invoice ID">
            <span className="block truncate font-mono" title={invoice.id}>
              {invoice.id}
            </span>
          </WispPayStat>
        </div>

        {children}
      </div>
    </div>
  );
}

export function WispPayReceiptPanel({
  invoice,
  txHash,
  onLoadInvoice,
  onLoadTx,
  onGoToPay,
}: WispPayReceiptPanelProps) {
  const { receipt } = COPY.wispPay;
  const effectiveTx = txHash ?? invoice?.txHash ?? null;
  const audit = useReceiptAudit({ txHash: effectiveTx, invoice });

  if (!effectiveTx && !invoice) {
    return (
      <div>
        <p className="text-sm text-muted-foreground">{receipt.emptyHint}</p>
        <div className="mt-6 space-y-4">
          <WispPayLookupField
            label={receipt.lookupInvoiceLabel}
            placeholder={receipt.lookupInvoicePlaceholder}
            loadLabel={receipt.lookupAction}
            onLoad={onLoadInvoice}
          />
          <WispPayLookupField
            label={receipt.lookupTxLabel}
            placeholder={receipt.lookupTxPlaceholder}
            loadLabel={receipt.lookupAction}
            onLoad={onLoadTx}
          />
        </div>
      </div>
    );
  }

  if (invoice && invoice.status !== "paid" && !effectiveTx) {
    return (
      <div className="flex flex-col gap-6">
        <div className="border-2 border-border bg-brand-soft/40 p-6">
          <p className="text-sm font-semibold text-primary">{receipt.unpaidTitle}</p>
          <p className="mt-2 text-sm text-muted-foreground">{receipt.unpaidBody}</p>
          <motion.div className="mt-4 inline-flex" whileHover={buttonHover} whileTap={buttonTap}>
            <Button
              type="button"
              size="lg"
              className="min-w-44"
              onClick={() => onGoToPay(invoice.id)}
            >
              {receipt.goToPay}
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  if (audit.loading) {
    return (
      <div className="flex flex-col gap-6">
        {invoice ? (
          <ReceiptSummaryCard invoice={invoice}>
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 size={16} className="animate-spin text-brand" />
              {receipt.loadingTitle}
            </div>
          </ReceiptSummaryCard>
        ) : (
          <div className="flex items-center justify-center gap-2 border-2 border-border bg-brand-soft/40 px-6 py-12 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin text-brand" />
            {receipt.loadingTitle}
          </div>
        )}
      </div>
    );
  }

  if (audit.notFound) {
    return (
      <div className="flex flex-col gap-6">
        <div className="border-2 border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm font-semibold text-destructive">{receipt.notFoundTitle}</p>
          <p className="mt-2 text-sm text-muted-foreground">{receipt.notFoundBody}</p>
        </div>
        <Button type="button" variant="outline" onClick={() => void audit.reload()}>
          {receipt.retry}
        </Button>
      </div>
    );
  }

  if (audit.error) {
    return (
      <div className="flex flex-col gap-6">
        <div className="border-2 border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm font-semibold text-destructive">{receipt.errorTitle}</p>
          <p className="mt-2 text-xs text-muted-foreground">{audit.error}</p>
        </div>
        <Button type="button" variant="outline" onClick={() => void audit.reload()}>
          {receipt.retry}
        </Button>
      </div>
    );
  }

  const displayTx = audit.txHash || effectiveTx || "";
  const corridorId = audit.corridorId ?? invoice?.corridorId ?? null;

  const auditGrid = (
    <div className="grid gap-3 sm:grid-cols-2">
      <WispPayStat label={receipt.txLabel}>
        <span className="block truncate font-mono text-xs" title={displayTx}>
          {displayTx ? truncate(displayTx, 12, 8) : "—"}
        </span>
        {displayTx && (
          <a
            href={stellarExplorerTx(displayTx)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand underline-offset-2 hover:underline"
          >
            {receipt.explorerLink}
            <ExternalLink size={12} />
          </a>
        )}
      </WispPayStat>
      <WispPayStat label={receipt.nullifierLabel}>
        <span className="block truncate font-mono text-xs" title={audit.nullifier}>
          {audit.nullifier ? truncate(audit.nullifier, 16, 8) : "—"}
        </span>
      </WispPayStat>
      <WispPayStat label={receipt.corridorLabel}>
        <span className="font-mono">{corridorId ?? "—"}</span>
      </WispPayStat>
      <WispPayStat label={receipt.ledgerLabel}>
        <span className="font-mono">{audit.ledger ?? "—"}</span>
      </WispPayStat>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <ReceiptStatusBanner title={receipt.verifiedTitle} />

      {invoice ? (
        <ReceiptSummaryCard invoice={invoice}>{auditGrid}</ReceiptSummaryCard>
      ) : (
        <div className="border-2 border-border bg-brand-soft/40">
          <div className="border-b-2 border-border bg-background px-6 py-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand">
              {receipt.summaryTitle}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{receipt.txOnlyHint}</p>
          </div>
          <div className="p-6">{auditGrid}</div>
        </div>
      )}

      <p className={cn("text-xs text-muted-foreground")}>{receipt.noPii}</p>
    </div>
  );
}
