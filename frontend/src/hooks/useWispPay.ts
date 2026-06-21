import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { DemoTransferRequest } from "@wisp_/js";
import type { MockKycStatusResponse } from "@wisp_/sdk";
import { COPY } from "@/content/copy";
import { useWispClient } from "@/hooks/useWispClient";
import { useDemoIssuerClient } from "@/hooks/useDemoIssuerClient";
import { useWallet } from "@/hooks/useWallet";
import type { Invoice } from "@/lib/invoices";
import { demoLog, formatDemoError } from "@/lib/demoLog";
import { kycMissingLabel, kycRootsLabel } from "@/lib/kyc";
import {
  proveAndPayTransfer,
  proveAndPayWithRetry,
  type TransferStage,
} from "@/hooks/useCompliantTransfer";

export type PayBusyStage = "fetch" | "prove" | "approve" | "settle" | null;

export interface ProveAndPayResult {
  txHash: string;
  nullifier: string;
}

export function useWispPay(invoice: Invoice | null) {
  const client = useWispClient();
  const demoIssuer = useDemoIssuerClient();
  const { isConnected, isConnecting, connect, walletSigner, address, freighterAvailable } =
    useWallet();

  const [kycStatus, setKycStatus] = useState<MockKycStatusResponse | null>(null);
  const [kycStatusLoading, setKycStatusLoading] = useState(false);
  const [kycStatusError, setKycStatusError] = useState<string | null>(null);
  const [kycSkipped, setKycSkipped] = useState(false);
  const [kycActivating, setKycActivating] = useState(false);
  const [busy, setBusy] = useState<PayBusyStage>(null);
  const [error, setError] = useState<string | null>(null);

  const kycApproved = kycStatus?.kyc_status === "approved";
  const proofReady = kycStatus?.eligible_for_proof === true;
  const kycRevoked = kycStatus?.kyc_status === "revoked";
  const kycRejected = kycStatus?.kyc_status === "rejected";

  const kycBlockReason = useMemo(() => {
    if (!isConnected || !address) return null;
    if (kycStatus === null) return "Checking KYC status…";
    if (!proofReady) {
      if (kycRejected) return "Wallet verification was rejected — retry from the banner above.";
      if (kycSkipped) return "Complete wallet verification from the banner above.";
      if (kycApproved && kycStatus?.missing.length) {
        return kycStatus.missing
          .map(
            (item) =>
              (item === "roots_published" ? kycRootsLabel(kycStatus) : kycMissingLabel(item)) ??
              item,
          )
          .join(" ");
      }
      return "Complete SEP-10 wallet verification from the banner above to pay.";
    }
    return null;
  }, [address, isConnected, kycApproved, kycRejected, kycSkipped, kycStatus, proofReady]);

  const showKycModal =
    (isConnected &&
      !kycStatusLoading &&
      kycStatus !== null &&
      !kycApproved &&
      !kycSkipped &&
      !kycRevoked &&
      !kycRejected) ||
    (isConnected &&
      !kycStatusLoading &&
      kycStatus !== null &&
      kycRejected &&
      !kycSkipped) ||
    (kycActivating && !kycSkipped);

  const buildRequest = useCallback((): DemoTransferRequest | null => {
    if (!address || !invoice) return null;
    return {
      sender_strkey: address,
      recipient_strkey: invoice.recipient,
      amount: invoice.amountMicro,
      corridor_id: invoice.corridorId,
      source_country: invoice.sourceCountry,
      dest_country: invoice.destCountry,
    };
  }, [address, invoice]);

  const refreshKycStatus = useCallback(async () => {
    if (!address || !invoice) {
      setKycStatus(null);
      setKycStatusLoading(false);
      return;
    }
    setKycStatusLoading(true);
    setKycStatusError(null);
    try {
      const next = await demoIssuer.getMockKycStatus(address, {
        corridor_id: invoice.corridorId,
        recipient: invoice.recipient,
      });
      setKycStatus(next);
      if (next.publish_warning) {
        toast.warning(next.publish_warning);
      }
    } catch (e) {
      const msg = formatDemoError(e);
      demoLog("wispPay.kyc.fail", { error: msg });
      setKycStatusError(msg);
    } finally {
      setKycStatusLoading(false);
    }
  }, [address, demoIssuer, invoice]);

  useEffect(() => {
    void refreshKycStatus();
  }, [refreshKycStatus]);

  useEffect(() => {
    setKycStatus(null);
    setKycStatusError(null);
    setKycStatusLoading(Boolean(address));
  }, [address]);

  useEffect(() => {
    if (kycApproved) setKycSkipped(false);
  }, [kycApproved]);

  useEffect(() => {
    if (!isConnected || !address || !kycApproved || proofReady || kycStatus?.roots_status !== "publishing") {
      return;
    }
    let cancelled = false;
    let timeoutId: number | null = null;
    let attempt = 0;

    const schedule = () => {
      if (cancelled) return;
      const delay = document.hidden
        ? 15_000
        : Math.min(2500 * 2 ** Math.min(attempt, 2), 10_000);
      timeoutId = window.setTimeout(async () => {
        if (cancelled) return;
        attempt += 1;
        await refreshKycStatus();
        schedule();
      }, delay);
    };

    schedule();
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [address, isConnected, kycApproved, kycStatus?.roots_status, proofReady, refreshKycStatus]);

  const proveAndPay = useCallback(async (): Promise<ProveAndPayResult | null> => {
    if (!walletSigner || !invoice || !address) {
      toast.error("Connect Freighter first");
      return null;
    }
    if (!proofReady) {
      toast.error("Complete wallet verification before paying");
      return null;
    }

    const request = buildRequest();
    if (!request) return null;

    setError(null);

    try {
      let outcome: ProveAndPayResult;
      try {
        outcome = await proveAndPayWithRetry({
          client,
          demoIssuer,
          walletSigner,
          senderAddress: address,
          request,
          corridorId: invoice.corridorId,
          onStage: (stage: TransferStage) => setBusy(stage),
        });
      } catch (e) {
        const msg = formatDemoError(e);
        if (/Error\(Contract,\s*#9\)/.test(msg)) {
          demoLog("wispPay.retry", { reason: "contract_9" });
          outcome = await proveAndPayTransfer({
            client,
            demoIssuer,
            walletSigner,
            senderAddress: address,
            request,
            corridorId: invoice.corridorId,
            onStage: (stage: TransferStage) => setBusy(stage),
            skipDuplicateCheck: true,
          });
        } else {
          throw e;
        }
      }
      toast.success(COPY.wispPay.pay.successToast);
      return outcome;
    } catch (e) {
      const msg = formatDemoError(e);
      demoLog("wispPay.pay.fail", { error: msg });
      setError(msg);
      toast.error(msg.split("\n")[0] ?? msg);
      return null;
    } finally {
      setBusy(null);
    }
  }, [address, buildRequest, client, demoIssuer, invoice, proofReady, walletSigner]);

  const progressLabel = useMemo(() => {
    switch (busy) {
      case "fetch":
        return COPY.wispPay.pay.progressFetch;
      case "prove":
        return COPY.wispPay.pay.progressProve;
      case "approve":
        return COPY.wispPay.pay.progressApprove;
      case "settle":
        return COPY.wispPay.pay.progressSettle;
      default:
        return null;
    }
  }, [busy]);

  return {
    isConnected,
    isConnecting,
    connect,
    freighterAvailable,
    address,
    walletSigner,
    kycStatus,
    kycStatusError,
    kycSkipped,
    setKycSkipped,
    kycActivating,
    setKycActivating,
    showKycModal,
    kycApproved,
    proofReady,
    kycBlockReason,
    refreshKycStatus,
    setKycStatus,
    busy,
    error,
    progressLabel,
    proveAndPay,
  };
}
