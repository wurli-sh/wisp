import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import type { CorridorOption } from "@wisp_/js";
import { COPY } from "@/content/copy";
import { stellarExplorerTx } from "@/config/env";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { CountrySelect } from "@/components/demo/CountrySelect";
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
      whileHover={disabled ? undefined : { scale: 1.06 }}
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
  variant = "dark",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  variant?: "light" | "dark";
}) {
  const isLight = variant === "light";
  return (
    <div
      className={cn(
        "flex min-h-[4.5rem] flex-col justify-between gap-2 border-2 p-4",
        isLight ? "border-border bg-background" : "border-inverse-border bg-charcoal-panel",
        className,
      )}
    >
      <span
        className={cn(
          "text-[10px] font-bold uppercase tracking-widest",
          isLight ? "text-muted-foreground" : "text-inverse-muted",
        )}
      >
        {label}
      </span>
      <span className={cn("truncate font-medium", isLight ? "text-primary" : "text-inverse-foreground")}>
        {children}
      </span>
    </div>
  );
}

function SectionTitle({
  children,
  variant = "dark",
}: {
  children: React.ReactNode;
  variant?: "light" | "dark";
}) {
  return (
    <p
      className={cn(
        "text-[11px] font-bold uppercase tracking-[0.2em]",
        variant === "light" ? "text-brand" : "text-brand-sky",
      )}
    >
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
  const panelVariant = "light";

  const fieldClass =
    "min-h-12 border-2 border-border bg-background px-4 text-sm font-medium text-primary outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  const labelClass = "text-[10px] font-bold uppercase tracking-widest text-muted-foreground";

  const hintClass = "text-muted-foreground";
  const previewLabelClass = "text-[10px] font-bold uppercase tracking-widest text-muted-foreground";
  const previewValueClass =
    "min-w-0 truncate text-2xl font-semibold leading-none tracking-tight text-primary sm:text-[1.65rem]";
  const previewMetaClass =
    "inline-flex h-7 items-center border-2 border-brand-dark bg-brand px-2.5 text-[10px] font-bold uppercase tracking-wide text-brand-foreground shadow-blue-pill";

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
      <div className="relative overflow-hidden border-2 border-border bg-background text-primary shadow-soft">
        <div className="relative flex flex-col">
          <div className="flex items-center gap-1 border-b-2 border-border bg-background px-2 pt-2">
            <div className="relative flex items-center gap-2 border-2 border-brand-dark bg-brand px-4 py-2.5 text-brand-foreground shadow-blue-pill">
              <span className="text-xs font-bold uppercase tracking-wider">{transfer.title}</span>
              <span className="absolute inset-x-2 bottom-0 h-0.5 bg-brand-foreground/80" />
            </div>
          </div>

          <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
            <form
              className="flex flex-col gap-6 bg-background px-6 py-7"
              onSubmit={(event) => {
                event.preventDefault();
                if (!primary.disabled) primary.onClick();
              }}
            >
              <SectionTitle variant={panelVariant}>Transfer details</SectionTitle>

              <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
                <CountrySelect
                  label={transfer.sourceCountry}
                  value={sourceCountry}
                  options={sourceOptions}
                  disabled={isLoading}
                  variant={panelVariant}
                  onChange={onSourceCountryChange}
                />

                <SwapButton
                  onClick={handleSwap}
                  disabled={!canSwapCountries}
                  className="size-12 self-end"
                  spin={swapSpin}
                />

                <CountrySelect
                  label={transfer.destCountry}
                  value={destCountry}
                  options={destOptions}
                  disabled={isLoading}
                  variant={panelVariant}
                  onChange={onDestCountryChange}
                />
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
                <span className={cn("text-[10px] leading-snug", hintClass)}>{transfer.recipientHint}</span>
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
                <span className={cn("text-[10px] leading-snug", hintClass)}>{transfer.usdcFundingHint}</span>
              </label>

              <motion.div
                className="max-w-xs"
                whileHover={primary.disabled ? undefined : buttonHover}
                whileTap={primary.disabled ? undefined : buttonTap}
              >
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  disabled={primary.disabled}
                >
                  {(isConnecting || isLoading) && <Loader2 size={16} className="animate-spin" />}
                  {primary.label}
                </Button>
              </motion.div>

              {!primary.disabled && validationError && (
                <p className="border-2 border-warning/40 bg-warning/15 px-3 py-2 text-xs leading-snug text-warning">
                  {validationError}
                </p>
              )}
              {primary.disabled && kycBlockReason && (
                <p className="border-2 border-border bg-muted/40 px-3 py-2 text-xs leading-snug text-muted-foreground">
                  {kycBlockReason}
                </p>
              )}
            </form>

            <div className="flex flex-col gap-6 border-t-2 border-border bg-muted/20 px-6 py-7 lg:border-t-0 lg:border-l-2 lg:border-border">
              <SectionTitle variant={panelVariant}>Preview</SectionTitle>

              <div className="border-2 border-border bg-background p-5">
                <div className="mb-5 flex h-8 justify-center overflow-hidden">
                  <AnimatePresence mode="wait" initial={false}>
                    {sourceCountry && destCountry ? (
                      <motion.div
                        key={corridorLabel}
                        className="flex items-center gap-2 border-2 border-brand-dark bg-brand px-3 text-xs font-bold uppercase tracking-wide text-brand-foreground shadow-blue-pill"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <CountryFlag code={sourceCountry} size="sm" />
                        <span>{sourceCountry}</span>
                        <span aria-hidden>→</span>
                        <CountryFlag code={destCountry} size="sm" />
                        <span>{destCountry}</span>
                      </motion.div>
                    ) : (
                      <motion.span
                        key="corridor-empty"
                        className="flex items-center border-2 border-brand-dark bg-brand px-3 text-xs font-bold uppercase tracking-wide text-brand-foreground shadow-blue-pill"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        {transfer.corridor}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)]">
                  <div className="grid min-w-0 gap-3">
                    <p className={previewLabelClass}>{transfer.youSend}</p>
                    <p className={cn(previewValueClass, "tabular-nums")} title={amount || undefined}>
                      {previewAmount(amount)}
                    </p>
                    <div>
                      <span className={previewMetaClass}>{transfer.asset}</span>
                    </div>
                  </div>

                  <div className="flex justify-start sm:justify-center">
                    <SwapButton
                      onClick={handleSwap}
                      disabled={!canSwapCountries}
                      className="size-12"
                      spin={swapSpin}
                    />
                  </div>

                  <div className="grid min-w-0 gap-3 text-left sm:text-right">
                    <p className={previewLabelClass}>{transfer.recipient}</p>
                    <p className={previewValueClass} title={recipient || undefined}>
                      {recipient ? truncate(recipient, 8, 6) : "—"}
                    </p>
                    <div>
                      <span className={previewMetaClass}>Wallet</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <SectionTitle variant={panelVariant}>{transfer.complianceDetails}</SectionTitle>
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailStat label={transfer.corridorId} variant={panelVariant}>
                    {corridorId || "—"}
                  </DetailStat>
                  <DetailStat label={transfer.proofStatus} variant={panelVariant}>
                    <span
                      className={
                        hasProof
                          ? "text-success"
                          : "text-muted-foreground"
                      }
                    >
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
                        <DetailStat label={transfer.nullifier} variant={panelVariant}>
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
                        <DetailStat label={transfer.transaction} variant={panelVariant}>
                          <a
                            href={stellarExplorerTx(txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "font-semibold hover:underline",
                              "text-brand",
                            )}
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

          <div className="flex flex-col gap-4 border-t-2 border-border bg-muted/30 px-6 py-6">
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
                className="border-2 border-border bg-background text-muted-foreground shadow-none hover:bg-muted/60 hover:text-primary"
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
