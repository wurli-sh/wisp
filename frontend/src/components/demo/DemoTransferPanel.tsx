import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeftRight, Loader2, Wallet } from "lucide-react";
import type { CorridorOption } from "@amoeba_/js";
import { COPY } from "@/content/copy";
import { stellarExplorerTx } from "@/config/env";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { buttonHover, buttonTap } from "@/lib/animations";

interface DemoTransferPanelProps {
  isConnected: boolean;
  isConnecting: boolean;
  amount: string;
  recipient: string;
  sourceCountry: string;
  destCountry: string;
  corridorId: string;
  corridors: CorridorOption[];
  nullifier: string | null;
  txHash: string | null;
  hasPackage: boolean;
  hasProof: boolean;
  auditLedger: number | null;
  busy: string | null;
  validationError: string | null;
  walletVerified: boolean;
  proofReady: boolean;
  kycBlockReason?: string | null;
  onAmountChange: (value: string) => void;
  onRecipientChange: (value: string) => void;
  onSourceCountryChange: (value: string) => void;
  onDestCountryChange: (value: string) => void;
  onSwapCountries: () => void;
  onConnect: () => void;
  onFetchPackage: () => void;
  onGenerateProof: () => void;
  onApproveSac: () => void;
  sacApproved: boolean;
  onSubmit: () => void;
  onViewAudit: () => void;
  onTryInvalid: () => void;
  onTryReplay: () => void;
  canReplay: boolean;
}

function truncate(str: string, head = 8, tail = 4): string {
  if (str.length <= head + tail + 3) return str;
  return `${str.slice(0, head)}…${str.slice(-tail)}`;
}

function previewAmount(value: string): string {
  if (!value) return "—";
  if (value.length <= 14) return value;
  return `${value.slice(0, 10)}…`;
}

function SwapButton({
  onClick,
  disabled,
  className,
  spin,
}: {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  spin: number;
}) {
  return (
    <motion.button
      type="button"
      aria-label="Swap source and destination countries"
      title="Swap countries"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative z-10 flex shrink-0 cursor-pointer items-center justify-center border-2 border-brand-dark bg-brand text-brand-foreground shadow-blue-pill outline-none transition-colors hover:border-brand-dark hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-panel disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      animate={{ rotate: spin }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
    >
      <ArrowLeftRight size={16} strokeWidth={2.25} className="text-brand-foreground" />
    </motion.button>
  );
}

function DetailStat({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-[4.5rem] flex-col justify-between gap-2 border-2 border-inverse-border bg-charcoal-panel p-4", className)}>
      <span className="text-[10px] font-bold uppercase tracking-widest text-inverse-muted">{label}</span>
      <span className="truncate font-medium text-inverse-foreground">{children}</span>
    </div>
  );
}

const fieldClass =
  "min-h-12 border-2 border-inverse-border bg-charcoal-panel px-4 text-sm font-medium text-inverse-foreground outline-none transition-colors placeholder:text-inverse-muted focus-visible:border-brand-sky focus-visible:ring-2 focus-visible:ring-brand-sky/20 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-panel";

const labelClass = "text-[10px] font-bold uppercase tracking-widest text-inverse-muted";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-sky">
      {children}
    </p>
  );
}

export function DemoTransferPanel({
  isConnected,
  isConnecting,
  amount,
  recipient,
  sourceCountry,
  destCountry,
  corridorId,
  corridors,
  nullifier,
  txHash,
  hasPackage,
  hasProof,
  auditLedger,
  busy,
  validationError,
  walletVerified,
  proofReady,
  kycBlockReason,
  onAmountChange,
  onRecipientChange,
  onSourceCountryChange,
  onDestCountryChange,
  onSwapCountries,
  onConnect,
  onFetchPackage,
  onGenerateProof,
  onApproveSac,
  sacApproved,
  onSubmit,
  onViewAudit,
  onTryInvalid,
  onTryReplay,
  canReplay,
}: DemoTransferPanelProps) {
  const { transfer, actions } = COPY.demo;
  const isLoading = Boolean(busy);
  const sourceOptions = useMemo(() => {
    const opts = Array.from(
      new Set(corridors.filter((corridor) => corridor.enabled).map((corridor) => corridor.source_country)),
    );
    if (sourceCountry && !opts.includes(sourceCountry)) {
      return [sourceCountry, ...opts];
    }
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
    if (destCountry && !opts.includes(destCountry)) {
      return [destCountry, ...opts];
    }
    return opts;
  }, [corridors, destCountry, sourceCountry]);

  const primaryAction = (): { label: string; onClick: () => void; disabled: boolean } => {
    if (!isConnected) {
      return { label: transfer.connectWallet, onClick: onConnect, disabled: isConnecting };
    }
    if (!hasPackage) {
      if (!proofReady) {
        return {
          label: walletVerified ? "Publishing issuer roots…" : transfer.fetchPackage,
          onClick: onFetchPackage,
          disabled: true,
        };
      }
      return {
        label: busy === "fetch" ? "Fetching…" : transfer.fetchPackage,
        onClick: onFetchPackage,
        disabled: isLoading,
      };
    }
    if (!hasProof) {
      return {
        label: busy === "prove" ? "Generating…" : actions.generateProof,
        onClick: onGenerateProof,
        disabled: isLoading,
      };
    }
    if (!sacApproved) {
      return {
        label: busy === "approve" ? "Approving…" : actions.approveSac,
        onClick: onApproveSac,
        disabled: isLoading,
      };
    }
    if (!txHash) {
      return {
        label: busy === "settle" ? "Submitting…" : actions.submit,
        onClick: onSubmit,
        disabled: isLoading || !hasProof || !hasPackage || !sacApproved,
      };
    }
    if (!auditLedger) {
      return {
        label: busy === "audit" ? "Looking up…" : actions.audit,
        onClick: onViewAudit,
        disabled: isLoading,
      };
    }
    return { label: "Transfer complete", onClick: () => {}, disabled: true };
  };

  const primary = primaryAction();
  const canSwapCountries =
    Boolean(sourceCountry && destCountry && sourceCountry !== destCountry) && !isLoading;

  const [swapSpin, setSwapSpin] = useState(0);

  const handleSwap = useCallback(() => {
    if (!canSwapCountries) return;
    setSwapSpin((spin) => spin + 180);
    onSwapCountries();
  }, [canSwapCountries, onSwapCountries]);

  const corridorLabel =
    sourceCountry && destCountry ? `${sourceCountry} → ${destCountry}` : transfer.corridor;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="relative overflow-hidden border-2 border-inverse-border bg-linear-to-br from-charcoal via-charcoal-panel-soft to-charcoal-panel text-inverse-foreground shadow-elev">
        <div className="relative flex flex-col">
          <div className="flex items-center gap-2 border-b-2 border-inverse-border bg-charcoal-panel px-6 py-5">
            <Wallet size={18} className="text-brand-sky" />
            <span className="text-lg font-bold text-inverse-foreground">{transfer.title}</span>
          </div>

          <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
            <form
              className="flex flex-col gap-6 bg-charcoal px-6 py-7"
              onSubmit={(event) => {
                event.preventDefault();
                if (!primary.disabled) primary.onClick();
              }}
            >
              <SectionTitle>Transfer details</SectionTitle>

              <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
                <label className="flex flex-col gap-2">
                  <span className={labelClass}>{transfer.sourceCountry}</span>
                  <select
                    value={sourceCountry}
                    onChange={(event) => onSourceCountryChange(event.target.value)}
                    disabled={isLoading}
                    className={cn(fieldClass, "h-12")}
                  >
                    {sourceOptions.map((option) => (
                      <option key={option} value={option} className="bg-charcoal-panel text-inverse-foreground">
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <SwapButton
                  onClick={handleSwap}
                  disabled={!canSwapCountries}
                  className="size-12 self-end"
                  spin={swapSpin}
                />

                <label className="flex flex-col gap-2">
                  <span className={labelClass}>{transfer.destCountry}</span>
                  <select
                    value={destCountry}
                    onChange={(event) => onDestCountryChange(event.target.value)}
                    disabled={isLoading}
                    className={cn(fieldClass, "h-12")}
                  >
                    {destOptions.map((option) => (
                      <option key={option} value={option} className="bg-charcoal-panel text-inverse-foreground">
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-2">
                <span className={labelClass}>{transfer.recipient}</span>
                <input
                  value={recipient}
                  onChange={(event) => onRecipientChange(event.target.value)}
                  placeholder={transfer.recipientPlaceholder}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={isLoading}
                  className={fieldClass}
                />
                <span className="text-[10px] leading-snug text-inverse-muted">{transfer.recipientHint}</span>
              </label>

              <label className="flex max-w-xs flex-col gap-2">
                <span className={labelClass}>{transfer.amountLabel}</span>
                <input
                  value={amount}
                  onChange={(event) => onAmountChange(event.target.value)}
                  placeholder="10.00"
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={isLoading}
                  className={cn(fieldClass, "tabular-nums")}
                />
                <span className="text-[10px] leading-snug text-inverse-muted">{transfer.usdcFundingHint}</span>
              </label>

              <motion.div
                className="max-w-xs"
                whileHover={primary.disabled ? undefined : buttonHover}
                whileTap={primary.disabled ? undefined : buttonTap}
              >
                <Button
                  type="submit"
                  variant="outline"
                  size="lg"
                  className="w-full focus-visible:ring-offset-charcoal"
                  disabled={primary.disabled}
                >
                  {(isConnecting || isLoading) && <Loader2 size={16} className="animate-spin" />}
                  {primary.label}
                </Button>
              </motion.div>

              {!primary.disabled && validationError && (
                <p className="border-2 border-warning/40 bg-warning/15 px-3 py-2 text-xs leading-snug text-warning">{validationError}</p>
              )}
              {primary.disabled && kycBlockReason && (
                <p className="border-2 border-inverse-border bg-charcoal-panel-soft px-3 py-2 text-xs leading-snug text-inverse-muted">{kycBlockReason}</p>
              )}
            </form>

            <div className="flex flex-col gap-6 border-t-2 border-inverse-border bg-charcoal-panel/80 px-6 py-7 lg:border-t-0 lg:border-l-2">
              <SectionTitle>Preview</SectionTitle>

              <div className="flex flex-col gap-4 border-2 border-inverse-border bg-charcoal-panel-soft p-5">
                <div className="flex h-7 justify-center overflow-hidden">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={corridorLabel}
                      className="bg-brand px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-foreground ring-1 ring-brand/20"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      {corridorLabel}
                    </motion.span>
                  </AnimatePresence>
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                  <div className="min-w-0 overflow-hidden">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-inverse-muted">
                      {transfer.youSend}
                    </p>
                    <p
                      className="truncate text-xl font-semibold tabular-nums text-inverse-foreground sm:text-2xl"
                      title={amount || undefined}
                    >
                      {previewAmount(amount)}
                    </p>
                    <span className="mt-2 inline-block bg-brand px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-foreground ring-1 ring-brand/30">
                      {transfer.asset}
                    </span>
                  </div>

                  <div className="flex justify-center">
                    <SwapButton
                      onClick={handleSwap}
                      disabled={!canSwapCountries}
                      className="size-10"
                      spin={swapSpin}
                    />
                  </div>

                  <div className="min-w-0 overflow-hidden text-right">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-inverse-muted">
                      {transfer.recipient}
                    </p>
                    <p
                      className="truncate text-lg font-semibold text-inverse-foreground sm:text-xl"
                      title={recipient || undefined}
                    >
                      {recipient ? truncate(recipient, 8, 6) : "—"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <SectionTitle>{transfer.complianceDetails}</SectionTitle>
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailStat label={transfer.corridorId}>{corridorId || "—"}</DetailStat>
                  <DetailStat label={transfer.proofStatus}>
                    <span className={hasProof ? "text-success" : "text-inverse-muted"}>
                      {hasProof ? transfer.proofReady : transfer.proofPending}
                    </span>
                  </DetailStat>
                  <AnimatePresence initial={false}>
                    {nullifier && (
                      <motion.div
                        key="nullifier"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden sm:col-span-2"
                      >
                        <DetailStat label={transfer.nullifier}>
                          <span className="font-mono text-sm tabular-nums" title={nullifier}>
                            {truncate(nullifier, 12, 8)}
                          </span>
                        </DetailStat>
                      </motion.div>
                    )}
                    {txHash && (
                      <motion.div
                        key="txhash"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden sm:col-span-2"
                      >
                        <DetailStat label={transfer.transaction}>
                          <a
                            href={stellarExplorerTx(txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-brand-sky hover:underline"
                          >
                            {truncate(txHash, 8, 8)}
                          </a>
                        </DetailStat>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t-2 border-inverse-border bg-charcoal-panel px-6 py-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="danger"
                size="sm"
                className="border-destructive/50 bg-destructive/15 shadow-none"
                disabled={isLoading || !hasProof}
                onClick={onTryInvalid}
              >
                {actions.invalid}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-2 border-inverse-border bg-charcoal-panel text-inverse-muted !shadow-none hover:bg-charcoal-panel-soft hover:text-inverse-foreground"
                disabled={isLoading || !canReplay}
                onClick={onTryReplay}
              >
                {actions.replay}
              </Button>
              {auditLedger && <Badge variant="success">Audit ledger {auditLedger}</Badge>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
