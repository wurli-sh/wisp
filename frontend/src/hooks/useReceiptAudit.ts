import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useWispClient } from "@/hooks/useWispClient";
import { useWallet } from "@/hooks/useWallet";
import type { Invoice } from "@/lib/invoices";
import { demoLog, formatDemoError, friendlyError } from "@/lib/demoLog";

export interface ReceiptAuditData {
  attested: boolean;
  nullifier: string;
  txHash: string;
  ledger: number | null;
  corridorId: number | null;
  loading: boolean;
  error: string | null;
  notFound: boolean;
}

export function useReceiptAudit(opts: {
  txHash: string | null;
  invoice: Invoice | null;
}) {
  const client = useWispClient();
  const { address } = useWallet();
  const [data, setData] = useState<ReceiptAuditData>({
    attested: false,
    nullifier: "",
    txHash: opts.txHash ?? opts.invoice?.txHash ?? "",
    ledger: null,
    corridorId: opts.invoice?.corridorId ?? null,
    loading: false,
    error: null,
    notFound: false,
  });

  const load = useCallback(async () => {
    const txHash = opts.txHash ?? opts.invoice?.txHash ?? null;
    const nullifier = opts.invoice?.nullifier ?? null;

    if (!txHash && !nullifier) {
      setData((prev) => ({
        ...prev,
        loading: false,
        error: null,
        notFound: false,
      }));
      return;
    }

    setData((prev) => ({ ...prev, loading: true, error: null, notFound: false }));

    try {
      const eventByTx = txHash ? await client.getProofSettledByTxHash(txHash) : null;
      const audit = nullifier
        ? await client.audit(nullifier, address ?? "")
        : { attested: false, nullifier: "", event: null };
      const event = eventByTx ?? audit.event;
      const attested = audit.attested || Boolean(event);

      setData({
        attested,
        nullifier: nullifier ?? audit.nullifier ?? "",
        txHash: txHash ?? "",
        ledger: event?.ledger ?? null,
        corridorId: opts.invoice?.corridorId ?? null,
        loading: false,
        error: null,
        notFound: Boolean(txHash) && !attested && !event,
      });
    } catch (e) {
      demoLog("receiptAudit.fail", { error: formatDemoError(e) });
      const friendly = friendlyError(e);
      setData((prev) => ({
        ...prev,
        loading: false,
        error: friendly,
        notFound: false,
      }));
      toast.error(friendly);
    }
  }, [address, client, opts.invoice, opts.txHash]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...data, reload: load };
}
