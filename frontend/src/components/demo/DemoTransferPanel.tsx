import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownUp, Loader2, Wallet } from "lucide-react";
import { COPY } from "@/content/copy";
import { stellarExplorerTx } from "@/config/env";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

interface DemoTransferPanelProps {
  isConnected: boolean;
  isConnecting: boolean;
  amount: string;
  recipient: string;
  corridorId: string;
  nullifier: string | null;
  txHash: string | null;
  hasPackage: boolean;
  hasProof: boolean;
  auditLedger: number | null;
  busy: string | null;
  onConnect: () => void;
  onFetchPackage: () => void;
  onGenerateProof: () => void;
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

function DetailRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 text-xs", className)}>
      <span className="shrink-0 text-white/35">{label}</span>
      <span className="truncate text-right font-medium text-white/75">{children}</span>
    </div>
  );
}

export function DemoTransferPanel({
  isConnected,
  isConnecting,
  amount,
  recipient,
  corridorId,
  nullifier,
  txHash,
  hasPackage,
  hasProof,
  auditLedger,
  busy,
  onConnect,
  onFetchPackage,
  onGenerateProof,
  onSubmit,
  onViewAudit,
  onTryInvalid,
  onTryReplay,
  canReplay,
}: DemoTransferPanelProps) {
  const { transfer, actions } = COPY.demo;
  const isLoading = Boolean(busy);

  const primaryAction = (): { label: string; onClick: () => void; disabled: boolean } => {
    if (!isConnected) {
      return { label: transfer.connectWallet, onClick: onConnect, disabled: isConnecting };
    }
    if (!hasPackage) {
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
    if (!txHash) {
      return {
        label: busy === "settle" ? "Submitting…" : actions.submit,
        onClick: onSubmit,
        disabled: isLoading,
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

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="relative overflow-hidden border-2 border-white/10 bg-[#0c0c1a] shadow-elev">
        <div className="h-0.5 bg-linear-to-r from-primary via-primary-bright to-primary" />

        <div className="relative flex flex-col gap-5 p-5">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-primary-bright" />
            <span className="text-base font-bold text-white">{transfer.title}</span>
          </div>

          <div className="relative">
            <div className="overflow-hidden border border-white/10 bg-white/4">
              <div className="p-3.5 pb-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                  {transfer.youSend}
                </p>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-2xl font-semibold tabular-nums text-white">
                    {amount || "—"}
                  </span>
                  <span className="shrink-0 bg-primary-bright/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-primary-bright ring-1 ring-primary-bright/30">
                    {transfer.asset}
                  </span>
                </div>
              </div>

              <div className="border-t border-white/10" />

              <div className="p-3.5 pt-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                  {transfer.recipient}
                </p>
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-xl font-semibold text-white/90">
                    {recipient ? truncate(recipient) : "—"}
                  </span>
                  <span className="shrink-0 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white/60 ring-1 ring-white/10">
                    {transfer.corridor}
                  </span>
                </div>
              </div>
            </div>

            <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
              <div className="flex size-9 items-center justify-center bg-primary-bright shadow-blue-pill ring-2 ring-[#0c0c1a]">
                <ArrowDownUp size={15} className="text-white" />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 border border-white/8 bg-black/30 p-3">
            <DetailRow label={transfer.corridorId}>{corridorId || "—"}</DetailRow>
            <DetailRow label={transfer.proofStatus}>
              <span className={hasProof ? "text-emerald-400" : "text-white/45"}>
                {hasProof ? transfer.proofReady : transfer.proofPending}
              </span>
            </DetailRow>
            <AnimatePresence initial={false}>
              {nullifier && (
                <motion.div
                  key="nullifier"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <DetailRow label={transfer.nullifier}>{nullifier}</DetailRow>
                </motion.div>
              )}
              {txHash && (
                <motion.div
                  key="txhash"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <DetailRow label={transfer.transaction}>
                    <a
                      href={stellarExplorerTx(txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-primary-bright hover:underline"
                    >
                      {truncate(txHash, 6, 6)}
                    </a>
                  </DetailRow>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-3">
            <motion.button
              type="button"
              className="pill-gradient flex w-full cursor-pointer items-center justify-center gap-2 bg-primary-bright py-4 text-base font-bold text-white shadow-blue-pill transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={primary.onClick}
              disabled={primary.disabled}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              {(isConnecting || isLoading) && <Loader2 size={16} className="animate-spin" />}
              {primary.label}
            </motion.button>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="danger"
                size="sm"
                className="border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/15"
                disabled={isLoading || !hasProof}
                onClick={onTryInvalid}
              >
                {actions.invalid}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                disabled={isLoading || !canReplay}
                onClick={onTryReplay}
              >
                {actions.replay}
              </Button>
            </div>

            {auditLedger && (
              <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                <Badge variant="success">Audit ledger {auditLedger}</Badge>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
