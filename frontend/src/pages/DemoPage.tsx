import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Circle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ProofPackage } from "@amoeba/js";
import type { ProvenTransfer, AmoebaClient } from "@amoeba/sdk";
import { COPY } from "@/content/copy";
import { stellarExplorerTx } from "@/config/env";
import { useAmoebaClient } from "@/hooks/useAmoebaClient";
import { useWallet } from "@/hooks/useWallet";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

interface DemoFixtureMeta {
  corridor_id?: number;
  sender_strkey?: string;
  recipient_strkey?: string;
  amount?: string;
}

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
  const navigate = useNavigate();
  const { isConnected, walletSigner, address } = useWallet();

  const [pkg, setPkg] = useState<ProofPackage | null>(null);
  const [proven, setProven] = useState<ProvenTransfer | null>(null);
  const [lastProven, setLastProven] = useState<ProvenTransfer | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [nullifier, setNullifier] = useState<string | null>(null);
  const [auditLedger, setAuditLedger] = useState<number | null>(null);
  const [fixtureMeta, setFixtureMeta] = useState<DemoFixtureMeta | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(client.cfg.demoFixtureUrl!);
        if (res.ok) {
          const data = (await res.json()) as DemoFixtureMeta & ProofPackage;
          const rawCorridor =
            data.transfer?.corridor_id ??
            (typeof data.corridor_id === "number" ? data.corridor_id : undefined);
          setFixtureMeta({
            corridor_id:
              rawCorridor === undefined ? undefined : Number(rawCorridor),
            sender_strkey: data.sender_strkey,
            recipient_strkey: data.recipient_strkey,
            amount:
              data.transfer?.amount?.toString() ??
              (typeof data.amount === "string" ? data.amount : undefined),
          });
        }
      } catch {
        /* optional fixture metadata */
      }
    })();
  }, [client.cfg.demoFixtureUrl]);

  const stepsDone = useMemo(
    () => [
      isConnected,
      Boolean(isConnected && address),
      Boolean(fixtureMeta?.corridor_id ?? pkg?.transfer?.corridor_id),
      Boolean(fixtureMeta?.recipient_strkey ?? pkg?.transfer),
      Boolean(fixtureMeta?.amount ?? pkg?.transfer?.amount),
      Boolean(pkg),
      Boolean(proven),
      Boolean(proven && isConnected),
      Boolean(txHash),
      Boolean(txHash),
      Boolean(auditLedger),
    ],
    [address, auditLedger, fixtureMeta, isConnected, pkg, proven, txHash],
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
      try {
        await client.simulateSettle(toSettle, activePkg, walletSigner.publicKey);
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
        navigate(`/compliance?tab=audit&nullifier=${audit.nullifier}`);
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
  }, [address, client, navigate, nullifier]);

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

  return (
    <div className="flex h-full flex-col py-6">
      <div className="mb-6 border-b border-border pb-4">
        <h1 className="text-2xl font-bold text-primary">{COPY.demo.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{COPY.demo.honesty}</p>
        {error && (
          <p className="mt-3 border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="border border-border bg-card p-4 shadow-soft">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Progress · {activeStep}/{COPY.demo.steps.length}
          </p>
          <ol className="mt-4 space-y-2">
            {COPY.demo.steps.map((label, index) => {
              const done = stepsDone[index];
              const current = index === activeStep;
              return (
                <li
                  key={label}
                  className={cn(
                    "flex items-start gap-2 border border-transparent px-2 py-1.5 text-xs",
                    current && "border-primary/20 bg-primary-soft",
                  )}
                >
                  {done ? (
                    <Check size={14} className="mt-0.5 shrink-0 text-success" />
                  ) : current ? (
                    <Loader2 size={14} className="mt-0.5 shrink-0 animate-spin text-primary" />
                  ) : (
                    <Circle size={14} className="mt-0.5 shrink-0 text-border-strong" />
                  )}
                  <span className={done ? "text-foreground" : "text-muted-foreground"}>
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>
        </aside>

        <div className="flex min-h-0 flex-col gap-4">
          <div className="grid gap-3 border border-border bg-card p-4 shadow-soft sm:grid-cols-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Corridor
              </p>
              <p className="mt-1 text-sm">
                US→MX · id {fixtureMeta?.corridor_id ?? pkg?.transfer?.corridor_id ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Amount
              </p>
              <p className="mt-1 text-sm">
                {fixtureMeta?.amount ?? pkg?.transfer?.amount ?? "—"} base units
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Nullifier
              </p>
              <p className="mt-1 truncate text-xs">{nullifier ?? "—"}</p>
            </div>
            {txHash && (
              <div className="sm:col-span-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Transaction
                </p>
                <a
                  href={stellarExplorerTx(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block truncate text-xs text-primary-bright hover:underline"
                >
                  {txHash}
                </a>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={Boolean(busy) || !isConnected}
              onClick={() => void fetchPackage()}
            >
              {busy === "fetch" && <Loader2 size={14} className="animate-spin" />}
              Fetch package
            </Button>
            <Button
              variant="secondary"
              disabled={Boolean(busy) || !isConnected}
              onClick={() => void generateProof()}
            >
              {busy === "prove" && <Loader2 size={14} className="animate-spin" />}
              {COPY.demo.actions.generateProof}
            </Button>
            <Button
              disabled={Boolean(busy) || !proven || !isConnected}
              onClick={() => void submitTransfer()}
            >
              {busy === "settle" && <Loader2 size={14} className="animate-spin" />}
              {COPY.demo.actions.submit}
            </Button>
            <Button
              variant="danger"
              disabled={Boolean(busy) || !proven}
              onClick={() => void tryInvalid()}
            >
              {COPY.demo.actions.invalid}
            </Button>
            <Button
              variant="outline"
              disabled={Boolean(busy) || !lastProven}
              onClick={() => void tryReplay()}
            >
              {COPY.demo.actions.replay}
            </Button>
            <Button
              variant="outline"
              disabled={Boolean(busy) || !nullifier}
              onClick={() => void viewAudit()}
            >
              {busy === "audit" && <Loader2 size={14} className="animate-spin" />}
              {COPY.demo.actions.audit}
            </Button>
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-2 border border-border bg-muted/40 p-4">
            <Badge variant={isConnected ? "success" : "warning"}>
              {isConnected ? "Wallet connected" : "Wallet disconnected"}
            </Badge>
            {auditLedger && (
              <Badge variant="success">Audit ledger {auditLedger}</Badge>
            )}
            <Link to="/compliance" className="ml-auto text-xs font-semibold text-primary">
              Open compliance hub →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
