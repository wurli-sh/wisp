import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import type { ProofPackage } from "@amoeba/js";
import type { ProvenTransfer, AmoebaClient } from "@amoeba/sdk";
import { COPY } from "@/content/copy";
import { useAmoebaClient } from "@/hooks/useAmoebaClient";
import { useWallet } from "@/hooks/useWallet";
import { DemoTransferPanel } from "@/components/demo/DemoTransferPanel";
import { DemoProgressSidebar } from "@/components/demo/DemoProgressSidebar";
import { Badge } from "@/components/ui/Badge";

function stepIndex(flags: boolean[]): number {
  const last = flags.lastIndexOf(true);
  return last >= 0 ? last + 1 : 0;
}

function tamperProof(proven: ProvenTransfer): ProvenTransfer {
  const a = Buffer.from(proven.proof.a);
  if (a.length > 0) a[0] ^= 0x01;
  return {
    ...proven,
    proof: {
      ...proven.proof,
      a,
    },
  };
}

function extractTxHash(result: Awaited<ReturnType<AmoebaClient["settleWithWallet"]>>): string {
  return (
    result.getTransactionResponse?.txHash ??
    result.sendTransactionResponse?.hash ??
    ""
  );
}

export function DemoPage() {
  const client = useAmoebaClient();
  const { isConnected, isConnecting, connect, walletSigner, address } = useWallet();

  const [pkg, setPkg] = useState<ProofPackage | null>(null);
  const [proven, setProven] = useState<ProvenTransfer | null>(null);
  const [lastProven, setLastProven] = useState<ProvenTransfer | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [nullifier, setNullifier] = useState<string | null>(null);
  const [auditLedger, setAuditLedger] = useState<number | null>(null);
  const [simulated, setSimulated] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stepsDone = useMemo(
    () => [
      isConnected,
      Boolean(isConnected && address),
      Boolean(pkg?.transfer?.corridor_id),
      Boolean(pkg?.transfer?.recipient),
      Boolean(pkg?.transfer?.amount),
      Boolean(pkg),
      Boolean(proven),
      simulated,
      Boolean(txHash),
      Boolean(txHash),
      Boolean(auditLedger),
    ],
    [address, auditLedger, isConnected, pkg, proven, simulated, txHash],
  );

  const activeStep = stepIndex(stepsDone);

  const fetchPackage = useCallback(async () => {
    setBusy("fetch");
    setError(null);
    try {
      const next = await client.issuer.getDemoTransfer();
      setPkg(next);
      toast.success("Proof package fetched");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to fetch package";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }, [client]);

  const generateProof = useCallback(async () => {
    if (!isConnected) {
      toast.error("Connect Freighter first");
      return;
    }
    setBusy("prove");
    setError(null);
    try {
      const packageToProve = pkg ?? (await client.issuer.getDemoTransfer());
      if (!pkg) setPkg(packageToProve);

      const result = await client.prove({
        package: packageToProve,
        browser: true,
        wasmUrl: client.cfg.wasmUrl,
        zkeyUrl: client.cfg.zkeyUrl,
      });

      setProven(result);
      setLastProven(result);
      setNullifier(result.nullifier);
      toast.success("Proof generated in browser");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Prove failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }, [client, isConnected, pkg]);

  const submitTransfer = useCallback(
    async (overrideProven?: ProvenTransfer) => {
      if (!walletSigner || !proven) {
        toast.error("Connect wallet and generate proof first");
        return;
      }
      const activePkg = pkg ?? (await client.issuer.getDemoTransfer());
      if (!pkg) setPkg(activePkg);

      const toSettle = overrideProven ?? proven;
      setBusy("settle");
      setError(null);
      setSimulated(false);
      try {
        await client.simulateSettle(toSettle, activePkg, walletSigner.publicKey);
        setSimulated(true);
        const result = await client.settleWithWallet(
          toSettle,
          activePkg,
          walletSigner,
        );
        const hash = extractTxHash(result);
        if (!hash) throw new Error("Transaction submitted but hash missing");
        setTxHash(hash);
        setNullifier(toSettle.nullifier);
        toast.success("Transfer submitted");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Settle failed";
        setError(msg);
        toast.error(msg);
      } finally {
        setBusy(null);
      }
    },
    [client, pkg, proven, walletSigner],
  );

  const viewAudit = useCallback(async () => {
    if (!nullifier) {
      toast.error("No nullifier yet");
      return;
    }
    setBusy("audit");
    setError(null);
    try {
      const audit = await client.audit(nullifier, address ?? "");
      if (audit.event) {
        setAuditLedger(audit.event.ledger);
        toast.success(`Audit event at ledger ${audit.event.ledger}`);
      } else {
        toast.message("No on-chain event yet — try again after confirmation");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Audit lookup failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }, [address, client, nullifier]);

  const tryInvalid = useCallback(async () => {
    if (!proven) {
      toast.error("Generate a valid proof first");
      return;
    }
    await submitTransfer(tamperProof(proven));
  }, [proven, submitTransfer]);

  const tryReplay = useCallback(async () => {
    if (!lastProven) {
      toast.error("Submit a valid transfer first");
      return;
    }
    await submitTransfer(lastProven);
  }, [lastProven, submitTransfer]);

  const amount = pkg?.transfer?.amount?.toString() ?? "";
  const recipient = pkg?.transfer?.recipient ?? "";
  const corridorId = pkg?.transfer?.corridor_id?.toString() ?? "";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 py-8 lg:py-12">
      <header className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
        <Badge variant={isConnected ? "success" : "warning"} className="self-center sm:self-start">
          {isConnected ? "Wallet connected" : "Wallet disconnected"}
        </Badge>
        <div>
          <h1 className="text-2xl font-bold text-primary sm:text-3xl">{COPY.demo.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{COPY.demo.honesty}</p>
        </div>
      </header>

      {error && (
        <p className="border-2 border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <DemoProgressSidebar activeStep={activeStep} />

      <DemoTransferPanel
        isConnected={isConnected}
        isConnecting={isConnecting}
        amount={amount}
        recipient={recipient}
        corridorId={corridorId}
        nullifier={nullifier}
        txHash={txHash}
        hasPackage={Boolean(pkg)}
        hasProof={Boolean(proven)}
        auditLedger={auditLedger}
        busy={busy}
        onConnect={() => void connect()}
        onFetchPackage={() => void fetchPackage()}
        onGenerateProof={() => void generateProof()}
        onSubmit={() => void submitTransfer()}
        onViewAudit={() => void viewAudit()}
        onTryInvalid={() => void tryInvalid()}
        onTryReplay={() => void tryReplay()}
        canReplay={Boolean(lastProven)}
      />
    </div>
  );
}
