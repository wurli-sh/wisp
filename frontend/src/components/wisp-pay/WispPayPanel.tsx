import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, Wallet } from "lucide-react";
import { COPY } from "@/content/copy";
import { DemoKycPanel } from "@/components/demo/DemoKycPanel";
import { CircleUsdcTrustlineBanner } from "@/components/demo/CircleUsdcTrustlineBanner";
import { ApproveRecipientBanner } from "@/components/demo/ApproveRecipientBanner";
import { KycOnboardingModal } from "@/components/demo/KycOnboardingModal";
import { WispPayLookupField } from "@/components/wisp-pay/WispPayLookupField";
import { WispPayStat, truncate } from "@/components/wisp-pay/WispPayStat";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FreighterNotice } from "@/components/ui/FreighterNotice";
import { useWispPay } from "@/hooks/useWispPay";
import { getCountryDisplayName } from "@/lib/countryDisplay";
import type { Invoice } from "@/lib/invoices";
import { formatUsdcDisplay } from "@/lib/transferUtils";
import { buttonHover, buttonTap } from "@/lib/animations";
import { cn } from "@/lib/cn";

interface WispPayPanelProps {
  invoice: Invoice | null;
  invalidLink?: boolean;
  onLoadInvoice: (id: string) => void;
  onPaymentSuccess: (result: { txHash: string; nullifier: string; invoiceId: string }) => void;
  showLookup?: boolean;
}

export function WispPayPanel({
  invoice,
  invalidLink = false,
  onLoadInvoice,
  onPaymentSuccess,
  showLookup = true,
}: WispPayPanelProps) {
  const { pay } = COPY.wispPay;
  const flow = useWispPay(invoice);

  if (invalidLink) {
    return (
      <div>
        <p className="text-sm font-semibold text-destructive">{pay.invalidLinkTitle}</p>
        <p className="mt-2 text-sm text-muted-foreground">{pay.invalidLinkBody}</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div>
        <p className="text-sm text-muted-foreground">{pay.emptyHint}</p>
        {showLookup && (
          <div className="mt-6">
            <WispPayLookupField
              label={pay.lookupLabel}
              placeholder={pay.lookupPlaceholder}
              loadLabel={pay.lookupAction}
              onLoad={onLoadInvoice}
            />
          </div>
        )}
      </div>
    );
  }

  const canPay = flow.isConnected && flow.proofReady && !flow.busy;
  const alreadyPaid = invoice.status === "paid" && Boolean(invoice.txHash);

  return (
    <div className="flex flex-col gap-6">
      {!alreadyPaid && (
        <>
          <DemoKycPanel
            status={flow.kycStatus}
            skipped={flow.kycSkipped && !flow.kycApproved}
            onReopen={() => {
              flow.setKycSkipped(false);
              // Force the onboarding/activation modal open even when the wallet
              // is already KYC-approved but still needs credential activation.
              flow.setKycActivating(true);
            }}
          />

          {flow.isConnected && (
            <CircleUsdcTrustlineBanner address={flow.address} walletSigner={flow.walletSigner} />
          )}

          {flow.isConnected && (
            <ApproveRecipientBanner
              recipient={invoice.recipient}
              corridorId={invoice.corridorId}
              kycStatus={flow.kycStatus}
              onApproved={flow.refreshKycStatus}
            />
          )}

          <KycOnboardingModal
            open={flow.showKycModal}
            kycStatus={flow.kycStatus}
            corridorId={invoice.corridorId}
            recipient={invoice.recipient}
            onStatusChange={flow.setKycStatus}
            onComplete={() => {
              flow.setKycSkipped(false);
              flow.setKycActivating(false);
              void flow.refreshKycStatus();
            }}
            onSkip={() => {
              flow.setKycSkipped(true);
              flow.setKycActivating(false);
            }}
            onActivating={() => flow.setKycActivating(true)}
          />
        </>
      )}

      <div className="border-2 border-border bg-brand-soft/40">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-border bg-background px-4 py-4 sm:px-6 sm:py-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand">
              {pay.summaryTitle}
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
          <Badge variant={invoice.status === "paid" ? "brand" : "warning"} className="mt-1">
            {invoice.status === "paid" ? COPY.wispPay.create.statusPaid : COPY.wispPay.create.statusPending}
          </Badge>
        </div>

        <div className="grid gap-4 p-4 sm:p-6">
          <div className="flex flex-col items-stretch gap-3 border-2 border-border bg-background px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
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
            <span className="shrink-0 self-center bg-brand px-3 py-1 text-xs font-bold text-brand-foreground">
              →
            </span>
            <div className="flex min-w-0 items-center gap-3 sm:ml-auto sm:text-right">
              <div className="min-w-0 sm:order-first sm:ml-auto">
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
        </div>
      </div>

      {flow.error && (
        <p className="border-2 border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {flow.error}
        </p>
      )}

      {flow.progressLabel && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin text-brand" />
            {flow.progressLabel}
          </div>
          {flow.busy === "prove" && (
            <p className="pl-6 text-xs text-muted-foreground">{pay.progressProveHint}</p>
          )}
        </div>
      )}

      {flow.kycStatusError && flow.isConnected && !alreadyPaid && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-destructive/30 bg-destructive/5 px-3 py-2">
          <p className="min-w-0 flex-1 text-xs text-destructive">{pay.kycStatusError}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void flow.refreshKycStatus()}
          >
            {pay.kycStatusRetry}
          </Button>
        </div>
      )}

      {flow.kycBlockReason &&
        flow.isConnected &&
        !flow.proofReady &&
        !flow.kycStatusError &&
        !alreadyPaid && (
          <p className="text-xs text-muted-foreground">{flow.kycBlockReason}</p>
        )}

      {alreadyPaid ? (
        <div className="border-2 border-brand/25 bg-brand-soft/40 px-4 py-4">
          <p className="text-sm font-bold text-primary">{pay.alreadyPaidTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">{pay.alreadyPaidBody}</p>
          <div className="mt-4">
            <Button
              type="button"
              size="lg"
              className="min-w-44"
              onClick={() =>
                onPaymentSuccess({
                  txHash: invoice.txHash!,
                  nullifier: invoice.nullifier ?? "",
                  invoiceId: invoice.id,
                })
              }
            >
              {pay.viewReceipt}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap">
            {!flow.isConnected ? (
              <motion.div
                className="w-full sm:inline-flex sm:w-auto"
                whileHover={flow.isConnecting ? undefined : buttonHover}
                whileTap={flow.isConnecting ? undefined : buttonTap}
              >
                <Button
                  type="button"
                  size="lg"
                  disabled={flow.isConnecting}
                  onClick={() => void flow.connect()}
                  className="w-full gap-2 sm:min-w-44 sm:w-auto"
                >
                  <Wallet size={16} />
                  {pay.connectWallet}
                </Button>
              </motion.div>
            ) : (
              <motion.div
                className="w-full sm:inline-flex sm:w-auto"
                whileHover={!canPay ? undefined : buttonHover}
                whileTap={!canPay ? undefined : buttonTap}
              >
                <Button
                  type="button"
                  size="lg"
                  disabled={!canPay}
                  onClick={() => {
                    void flow.proveAndPay().then((result) => {
                      if (result) {
                        onPaymentSuccess({
                          ...result,
                          invoiceId: invoice.id,
                        });
                      }
                    });
                  }}
                  className="w-full sm:min-w-44 sm:w-auto"
                >
                  {flow.busy ? pay.proveAndPayBusy : pay.proveAndPay}
                </Button>
              </motion.div>
            )}
          </div>
          {!flow.isConnected && !flow.freighterAvailable && <FreighterNotice />}
        </div>
      )}

      <p className={cn("text-xs text-muted-foreground")}>
        {pay.demoHint}{" "}
        <Link to="/demo" className="font-semibold text-brand underline-offset-2 hover:underline">
          {pay.openDemo}
        </Link>
      </p>
    </div>
  );
}
