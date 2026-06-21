import { useCallback, useEffect, useMemo, useState } from "react";
import { WispPayFormSkeleton } from "@/components/skeletons/WispPaySkeletons";
import { motion } from "framer-motion";
import { ArrowLeftRight, Check, ClipboardCopy, Link2 } from "lucide-react";
import { toast } from "sonner";
import type { CorridorOption } from "@wisp_/js";
import { COPY } from "@/content/copy";
import { CountrySelect } from "@/components/demo/CountrySelect";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useDemoIssuerClient } from "@/hooks/useDemoIssuerClient";
import { loadDemoFixtureStrkeys } from "@/lib/demoLog";
import {
  createInvoice,
  listInvoices,
  removeInvoice,
  type Invoice,
} from "@/lib/invoices";
import { buildPayLink } from "@/lib/invoiceCodec";
import {
  defaultCountries,
  findCorridor,
  formatUsdcDisplay,
  parseUsdcAmount,
  relaxCorridorReconcile,
} from "@/lib/transferUtils";
import { ExplodingInput } from "@/components/spell/exploding-input";
import { buttonHover, buttonTap } from "@/lib/animations";
import { cn } from "@/lib/cn";

const LABEL_PARTICLES = [
  <span key="ball" className="text-2xl">
    ⚽
  </span>,
  <span key="trophy" className="text-2xl">
    🏆
  </span>,
  <span key="ticket" className="text-2xl">
    🎫
  </span>,
  <span key="globe" className="text-2xl">
    🌍
  </span>,
  <span key="star" className="text-2xl">
    ⭐
  </span>,
  <span key="goal" className="text-2xl">
    🥅
  </span>,
];

/** Default payee on Create — demo merchant payout wallet (testnet fixture recipient). */
const DEFAULT_CREATE_RECIPIENT =
  "GAVRIGZPHFMFYNBXZECCZIYHO2AW2CHCOUAUKLDZM2PKK2SIMLPOBPF7";

function truncate(str: string, head = 8, tail = 4): string {
  if (str.length <= head + tail + 3) return str;
  return `${str.slice(0, head)}…${str.slice(-tail)}`;
}

interface WispPayCreatePanelProps {
  onInvoicesChange?: () => void;
}

export function WispPayCreatePanel({ onInvoicesChange }: WispPayCreatePanelProps) {
  const demoIssuer = useDemoIssuerClient();
  const { create, demoTransfer } = COPY.wispPay;

  const [corridors, setCorridors] = useState<CorridorOption[]>([]);
  const [corridorsLoading, setCorridorsLoading] = useState(true);
  const [corridorsError, setCorridorsError] = useState<string | null>(null);
  const [sourceCountry, setSourceCountry] = useState("");
  const [destCountry, setDestCountry] = useState("");
  const [recipient, setRecipient] = useState(DEFAULT_CREATE_RECIPIENT);
  const [amountInput, setAmountInput] = useState("25.00");
  const [label, setLabel] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [createdInvoice, setCreatedInvoice] = useState<Invoice | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>(() => listInvoices());
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [swapSpin, setSwapSpin] = useState(0);

  const refreshList = useCallback(() => {
    setInvoices(listInvoices());
    onInvoicesChange?.();
  }, [onInvoicesChange]);

  useEffect(() => {
    void loadDemoFixtureStrkeys()
      .then((fixture) => {
        const defaultRecipient = fixture.recipient_strkey ?? DEFAULT_CREATE_RECIPIENT;
        setRecipient((current) =>
          !current || current === DEFAULT_CREATE_RECIPIENT ? defaultRecipient : current,
        );
      })
      .catch(() => {
        /* fixture is optional; default recipient still applies */
      });
  }, []);

  const loadCorridors = useCallback(() => {
    setCorridorsLoading(true);
    setCorridorsError(null);
    void demoIssuer
      .listCorridors()
      .then((next) => {
        setCorridors(next);
        const defaults = defaultCountries(next);
        setSourceCountry((current) => current || defaults.sourceCountry);
        setDestCountry((current) => current || defaults.destCountry);
      })
      .catch((error) => {
        setCorridorsError(error instanceof Error ? error.message : "Failed to load corridors");
      })
      .finally(() => {
        setCorridorsLoading(false);
      });
  }, [demoIssuer]);

  useEffect(() => {
    loadCorridors();
  }, [loadCorridors]);

  useEffect(() => {
    if (!corridors.length) return;
    const next = relaxCorridorReconcile(corridors, sourceCountry, destCountry);
    if (next) {
      setDestCountry(next.destCountry);
    }
  }, [corridors, destCountry, sourceCountry]);

  const sourceOptions = useMemo(() => {
    const opts = Array.from(
      new Set(corridors.filter((corridor) => corridor.enabled).map((corridor) => corridor.source_country)),
    );
    if (sourceCountry && !opts.includes(sourceCountry)) return [sourceCountry, ...opts];
    return opts;
  }, [corridors, sourceCountry]);

  const destOptions = useMemo(() => {
    const opts = Array.from(
      new Set(
        corridors
          .filter((corridor) => corridor.enabled && corridor.source_country === sourceCountry)
          .map((corridor) => corridor.dest_country),
      ),
    );
    if (destCountry && !opts.includes(destCountry)) return [destCountry, ...opts];
    return opts;
  }, [corridors, destCountry, sourceCountry]);

  const selectedCorridor = useMemo(
    () => findCorridor(corridors, sourceCountry, destCountry),
    [corridors, destCountry, sourceCountry],
  );

  const canSwapCountries =
    Boolean(sourceCountry && destCountry && sourceCountry !== destCountry);

  const handleSwap = () => {
    if (!canSwapCountries) return;
    setSwapSpin((spin) => spin + 180);
    setSourceCountry(destCountry);
    setDestCountry(sourceCountry);
  };

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    const amountMicro = parseUsdcAmount(amountInput);
    if (!amountMicro || amountMicro === "0") {
      setValidationError(create.errors.amount);
      return;
    }
    if (!selectedCorridor) {
      setValidationError(create.errors.corridor);
      return;
    }
    const recipientTrimmed = recipient.trim();
    if (!recipientTrimmed) {
      setValidationError(create.errors.recipient);
      return;
    }
    setValidationError(null);
    const invoice = createInvoice({
      amountMicro,
      sourceCountry,
      destCountry,
      corridorId: selectedCorridor.id,
      recipient: recipientTrimmed,
      label: label.trim() || undefined,
    });
    setCreatedInvoice(invoice);
    refreshList();
    toast.success(create.createdToast);
  };

  const copyPayLink = async (invoice: Invoice) => {
    const link = buildPayLink(invoice);
    await navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1500);
    toast.success(create.linkCopied);
  };

  const copyId = async (id: string) => {
    await navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  const handleRemove = (id: string) => {
    if (!removeInvoice(id)) return;
    if (createdInvoice?.id === id) setCreatedInvoice(null);
    refreshList();
    toast.success(create.removedToast);
  };

  const fieldClass =
    "min-h-12 border-2 border-border bg-background px-4 text-sm font-medium text-primary outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20";

  if (corridorsLoading) {
    return <WispPayFormSkeleton />;
  }

  if (corridorsError && corridors.length === 0) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-destructive/30 bg-destructive/5 px-4 py-4">
        <p className="min-w-0 flex-1 text-xs text-destructive">{COPY.demo.corridorsError}</p>
        <Button type="button" variant="outline" size="sm" onClick={loadCorridors}>
          {COPY.demo.corridorsRetry}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <form
        className="bg-background"
        onSubmit={handleCreate}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand">
          {create.formTitle}
        </p>

        <div className="mt-6 grid gap-6">
          <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <CountrySelect
              label={demoTransfer.sourceCountry}
              value={sourceCountry}
              options={sourceOptions}
              variant="light"
              onChange={setSourceCountry}
            />
            <motion.button
              type="button"
              aria-label="Swap countries"
              disabled={!canSwapCountries}
              onClick={handleSwap}
              className={cn(
                "relative z-10 flex size-12 shrink-0 cursor-pointer items-center justify-center border-2 border-brand-dark bg-brand text-brand-foreground shadow-blue-pill outline-none transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40",
              )}
              animate={{ rotate: swapSpin }}
              transition={{ type: "spring", stiffness: 320, damping: 24 }}
              whileHover={!canSwapCountries ? undefined : { scale: 1.06 }}
              whileTap={!canSwapCountries ? undefined : { scale: 0.96 }}
            >
              <ArrowLeftRight size={16} strokeWidth={2.25} />
            </motion.button>
            <CountrySelect
              label={demoTransfer.destCountry}
              value={destCountry}
              options={destOptions}
              variant="light"
              onChange={setDestCountry}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {demoTransfer.amountLabel}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={amountInput}
              onChange={(event) => setAmountInput(event.target.value)}
              className={fieldClass}
            />
          </div>

          <label className="relative grid gap-2 overflow-visible">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {create.labelField}
            </span>
            <input
              type="text"
              value={label}
              placeholder={create.labelPlaceholder}
              onChange={(event) => setLabel(event.target.value)}
              className={fieldClass}
            />
            <ExplodingInput
              className="z-50"
              content={LABEL_PARTICLES}
              direction={{ horizontal: "left", vertical: "top" }}
              gravity={0.5}
              duration={3}
              count={3}
            />
          </label>

          <div className="grid gap-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {demoTransfer.recipient}
            </label>
            <input
              type="text"
              value={recipient}
              placeholder={demoTransfer.recipientPlaceholder}
              onChange={(event) => setRecipient(event.target.value)}
              className={fieldClass}
            />
            <p className="text-xs leading-snug text-muted-foreground">{create.recipientHint}</p>
          </div>
        </div>

        {validationError && (
          <p className="mt-4 border-2 border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {validationError}
          </p>
        )}

        <div className="mt-6">
          <motion.div className="inline-flex" whileHover={buttonHover} whileTap={buttonTap}>
            <Button type="submit" size="lg" className="min-w-44">
              {create.submit}
            </Button>
          </motion.div>
        </div>
      </form>

      {createdInvoice && (
        <div className="border-2 border-brand/25 bg-brand-soft/50 p-6 shadow-soft">
          <div className="flex flex-wrap items-center gap-2">
            <Check size={16} className="text-brand" />
            <p className="text-sm font-bold text-primary">{create.successTitle}</p>
          </div>
          <p className="mt-2 font-mono text-lg font-bold text-primary">{createdInvoice.id}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatUsdcDisplay(createdInvoice.amountMicro)} USDC · {createdInvoice.sourceCountry}→
            {createdInvoice.destCountry} · {truncate(createdInvoice.recipient)}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void copyId(createdInvoice.id)}>
              <ClipboardCopy size={14} />
              {copiedId ? create.idCopied : create.copyId}
            </Button>
            <Button type="button" size="sm" onClick={() => void copyPayLink(createdInvoice)}>
              <Link2 size={14} />
              {copiedLink ? create.linkCopied : create.copyLink}
            </Button>
          </div>
        </div>
      )}

      {invoices.length > 0 && (
        <div className="border-2 border-border bg-background shadow-soft">
          <div className="border-b-2 border-border px-6 py-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand">
              {create.listTitle}
            </p>
            <p className="mt-2 text-xs leading-snug text-muted-foreground">{create.removeHint}</p>
          </div>
          <ul className="divide-y-2 divide-border">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="flex flex-wrap items-center gap-3 px-6 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-semibold text-primary">{invoice.id}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatUsdcDisplay(invoice.amountMicro)} USDC · {invoice.sourceCountry}→
                    {invoice.destCountry}
                    {invoice.label ? ` · ${invoice.label}` : ""}
                  </p>
                </div>
                <Badge variant={invoice.status === "paid" ? "brand" : "warning"}>
                  {invoice.status === "paid" ? create.statusPaid : create.statusPending}
                </Badge>
                <Button type="button" variant="outline" size="sm" onClick={() => void copyPayLink(invoice)}>
                  {create.copyLink}
                </Button>
                {invoice.status === "pending" && (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => handleRemove(invoice.id)}
                  >
                    {create.remove}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
