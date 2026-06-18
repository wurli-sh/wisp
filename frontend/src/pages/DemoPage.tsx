import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { CorridorOption, DemoTransferRequest, ProofPackage } from "@amoeba/js";
import type { MockKycStatusResponse, ProvenTransfer, AmoebaClient } from "@amoeba/sdk";
import { COPY } from "@/content/copy";
import { useAmoebaClient } from "@/hooks/useAmoebaClient";
import { useDemoIssuerClient } from "@/hooks/useDemoIssuerClient";
import { env } from "@/config/env";
import { useWallet } from "@/hooks/useWallet";
import { DemoKycPanel } from "@/components/demo/DemoKycPanel";
import { KycOnboardingModal } from "@/components/demo/KycOnboardingModal";
import { DemoTransferPanel } from "@/components/demo/DemoTransferPanel";
import { DemoProgressSidebar } from "@/components/demo/DemoProgressSidebar";
import { Badge } from "@/components/ui/Badge";
import {
  checkWalletSender,
  configCheckpoint,
  demoLog,
  formatDemoError,
  loadDemoFixtureStrkeys,
  packageCheckpoint,
  provenCheckpoint,
} from "@/lib/demoLog";
import { kycMissingLabel, kycRootsLabel } from "@/lib/kyc";

function stepIndex(flags: boolean[]): number {
  let count = 0;
  for (const flag of flags) {
    if (!flag) break;
    count += 1;
  }
  return count;
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

function parseUsdcAmount(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d{0,6})?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  const normalized = `${whole}${frac.padEnd(6, "0")}`.replace(/^0+(?=\d)/, "");
  return normalized.length > 0 ? normalized : "0";
}

function formatUsdcDisplay(micro: string): string {
  const value = BigInt(micro);
  const whole = value / 1_000_000n;
  const frac = value % 1_000_000n;
  const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
  return fracStr.length > 0 ? `${whole}.${fracStr}` : whole.toString();
}

function bumpAmountMicro(micro: string): string {
  return (BigInt(micro) + 1n).toString();
}

function defaultCountries(corridors: CorridorOption[]): {
  sourceCountry: string;
  destCountry: string;
} {
  const first = corridors.find((corridor) => corridor.enabled);
  return {
    sourceCountry: first?.source_country ?? "",
    destCountry: first?.dest_country ?? "",
  };
}

function reconcileCorridorSelection(
  corridors: CorridorOption[],
  source: string,
  dest: string,
): { sourceCountry: string; destCountry: string } {
  const enabled = corridors.filter((corridor) => corridor.enabled);
  if (enabled.length === 0) {
    return { sourceCountry: source, destCountry: dest };
  }

  const exact = enabled.find(
    (corridor) => corridor.source_country === source && corridor.dest_country === dest,
  );
  if (exact) {
    return { sourceCountry: source, destCountry: dest };
  }

  const destsForSource = enabled
    .filter((corridor) => corridor.source_country === source)
    .map((corridor) => corridor.dest_country);
  if (destsForSource.length > 0) {
    return {
      sourceCountry: source,
      destCountry: destsForSource.includes(dest) ? dest : destsForSource[0]!,
    };
  }

  const first = enabled[0]!;
  return { sourceCountry: first.source_country, destCountry: first.dest_country };
}

export function DemoPage() {
  const client = useAmoebaClient();
  const demoIssuer = useDemoIssuerClient();
  const { isConnected, isConnecting, connect, walletSigner, address } = useWallet();

  const [corridors, setCorridors] = useState<CorridorOption[]>([]);
  const [sourceCountry, setSourceCountry] = useState("");
  const [destCountry, setDestCountry] = useState("");
  const [recipientInput, setRecipientInput] = useState("");
  const [amountInput, setAmountInput] = useState("10.00");
  const [pkg, setPkg] = useState<ProofPackage | null>(null);
  const [proven, setProven] = useState<ProvenTransfer | null>(null);
  const [lastProven, setLastProven] = useState<ProvenTransfer | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [nullifier, setNullifier] = useState<string | null>(null);
  const [auditLedger, setAuditLedger] = useState<number | null>(null);
  const [approvedSac, setApprovedSac] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [kycStatus, setKycStatus] = useState<MockKycStatusResponse | null>(null);
  const [kycStatusLoading, setKycStatusLoading] = useState(false);
  const [kycSkipped, setKycSkipped] = useState(false);
  const [kycActivating, setKycActivating] = useState(false);
  const prevRootsStatusRef = useRef<MockKycStatusResponse["roots_status"] | null>(null);

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
          .map((item) => (item === "roots_published" ? kycRootsLabel(kycStatus) : kycMissingLabel(item)) ?? item)
          .join(" ");
      }
      return "Complete SEP-10 wallet verification from the banner above to fetch a proof package.";
    }
    return null;
  }, [address, isConnected, kycApproved, kycRejected, kycSkipped, kycStatus, proofReady]);

  const showKycModal =
    (isConnected && !kycStatusLoading && kycStatus !== null && !kycApproved && !kycSkipped && !kycRevoked && !kycRejected) ||
    (isConnected && !kycStatusLoading && kycStatus !== null && kycRejected && !kycSkipped) ||
    (kycActivating && !kycSkipped);

  const selectedCorridor = useMemo(
    () =>
      corridors.find(
        (corridor) =>
          corridor.enabled &&
          corridor.source_country === sourceCountry &&
          corridor.dest_country === destCountry,
      ) ?? null,
    [corridors, destCountry, sourceCountry],
  );

  const stepsDone = useMemo(
    () => [
      isConnected,
      Boolean(isConnected && kycApproved),
      Boolean(selectedCorridor),
      Boolean(recipientInput.trim()),
      Boolean(parseUsdcAmount(amountInput) && parseUsdcAmount(amountInput) !== "0"),
      Boolean(pkg),
      Boolean(proven),
      approvedSac,
      simulated,
      Boolean(txHash),
      Boolean(txHash),
      Boolean(auditLedger),
    ],
    [address, amountInput, approvedSac, auditLedger, isConnected, kycApproved, pkg, proven, recipientInput, selectedCorridor, simulated, txHash],
  );

  const activeStep = stepIndex(stepsDone);

  useEffect(() => {
    demoLog("init", configCheckpoint());
    void loadDemoFixtureStrkeys()
      .then((fixture) => {
        if (fixture.recipient_strkey) {
          setRecipientInput((current) => current || fixture.recipient_strkey!);
        }
        demoLog("fixture.ok", {
          recipient_strkey: fixture.recipient_strkey,
          sender_strkey: fixture.sender_strkey,
        });
      })
      .catch((e) => {
        demoLog("fixture.fail", { error: formatDemoError(e) });
      });
  }, []);

  useEffect(() => {
    void demoIssuer
      .listCorridors()
      .then((next) => {
        setCorridors(next);
        const defaults = defaultCountries(next);
        setSourceCountry((current) => current || defaults.sourceCountry);
        setDestCountry((current) => current || defaults.destCountry);
        demoLog("corridors.ok", { count: next.length });
      })
      .catch((e) => {
        const msg = formatDemoError(e);
        demoLog("corridors.fail", { error: msg });
        setError(msg);
      });
  }, [demoIssuer]);

  useEffect(() => {
    if (!address) return;
    checkWalletSender(address, pkg?.demo?.sender_strkey);
  }, [address, pkg?.demo?.sender_strkey]);

  const refreshKycStatus = useCallback(async () => {
    if (!address) {
      setKycStatus(null);
      setKycStatusLoading(false);
      return;
    }
    setKycStatusLoading(true);
    try {
      const next = await demoIssuer.getMockKycStatus(address, {
        corridor_id: selectedCorridor?.id,
        recipient: recipientInput.trim() || undefined,
      });
      setKycStatus(next);
      if (next.publish_warning) {
        toast.warning(next.publish_warning);
      }
    } catch (e) {
      const msg = formatDemoError(e);
      demoLog("kyc.status.fail", { error: msg });
    } finally {
      setKycStatusLoading(false);
    }
  }, [address, demoIssuer, recipientInput, selectedCorridor?.id]);

  useEffect(() => {
    void refreshKycStatus();
  }, [refreshKycStatus]);

  useEffect(() => {
    setKycStatus(null);
    setKycStatusLoading(Boolean(address));
  }, [address]);

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

    const onVisibilityChange = () => {
      if (!document.hidden) {
        attempt = 0;
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
        void refreshKycStatus();
        schedule();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [address, isConnected, kycApproved, kycStatus?.roots_status, proofReady, refreshKycStatus]);

  useEffect(() => {
    if (kycApproved) {
      setKycSkipped(false);
    }
  }, [kycApproved]);

  useEffect(() => {
    if (!corridors.length) return;
    const next = reconcileCorridorSelection(corridors, sourceCountry, destCountry);
    if (next.sourceCountry !== sourceCountry || next.destCountry !== destCountry) {
      setSourceCountry(next.sourceCountry);
      setDestCountry(next.destCountry);
    }
  }, [corridors, destCountry, sourceCountry]);

  const resetDerivedState = useCallback(() => {
    setPkg(null);
    setProven(null);
    setLastProven(null);
    setTxHash(null);
    setNullifier(null);
    setAuditLedger(null);
    setSimulated(false);
    setApprovedSac(false);
  }, []);

  useEffect(() => {
    const prev = prevRootsStatusRef.current;
    const next = kycStatus?.roots_status ?? null;
    if (prev === "publishing" && next === "active") {
      resetDerivedState();
    }
    prevRootsStatusRef.current = next;
  }, [kycStatus?.roots_status, resetDerivedState]);

  const prepareFreshTransfer = useCallback(() => {
    const current = parseUsdcAmount(amountInput);
    if (current) {
      setAmountInput(formatUsdcDisplay(bumpAmountMicro(current)));
    }
    setPkg(null);
    setProven(null);
    setTxHash(null);
    setNullifier(null);
    setAuditLedger(null);
    setSimulated(false);
    setApprovedSac(false);
  }, [amountInput]);

  const buildRequest = useCallback((): DemoTransferRequest | null => {
    if (!address) {
      setValidationError("Connect Freighter first.");
      return null;
    }
    if (!selectedCorridor) {
      setValidationError("Select an available corridor.");
      return null;
    }
    const recipient = recipientInput.trim();
    if (!recipient) {
      setValidationError("Enter a recipient Stellar address.");
      return null;
    }
    const amount = parseUsdcAmount(amountInput);
    if (!amount || amount === "0") {
      setValidationError("Enter a valid USDC amount with up to 6 decimals.");
      return null;
    }
    setValidationError(null);
    return {
      sender_strkey: address,
      recipient_strkey: recipient,
      amount,
      corridor_id: selectedCorridor.id,
      source_country: selectedCorridor.source_country,
      dest_country: selectedCorridor.dest_country,
    };
  }, [address, amountInput, recipientInput, selectedCorridor]);

  const validateFetchedPackage = useCallback(
    async (next: ProofPackage) => {
      if (!env.issuerPublicKey) {
        throw new Error("VITE_ISSUER_PUBLIC_KEY is not configured — cannot validate package roots");
      }
      if (!env.complianceId) {
        throw new Error(
          "VITE_COMPLIANCE_CONTRACT_ID is not configured — cannot validate package roots",
        );
      }
      const corridorId = Number(next.transfer?.corridor_id ?? selectedCorridor?.id ?? 1);
      await client.validatePackage(next, {
        issuerPublicKey: env.issuerPublicKey,
        corridorId,
      });
      demoLog("validate.ok", { corridor_id: corridorId });
    },
    [client, selectedCorridor?.id],
  );

  const fetchPackage = useCallback(async () => {
    if (!proofReady) {
      setValidationError("Complete wallet verification before fetching a proof package.");
      return;
    }
    const request = buildRequest();
    if (!request) return;
    setBusy("fetch");
    setError(null);
    demoLog("fetch.start", { ...request });
    try {
      const next = await demoIssuer.createDemoTransfer(request);
      await validateFetchedPackage(next);
      demoLog("fetch.ok", packageCheckpoint(next));
      setPkg(next);
      setProven(null);
      setTxHash(null);
      setNullifier(null);
      setAuditLedger(null);
      setSimulated(false);
      setApprovedSac(false);
      toast.success("Proof package fetched");
    } catch (e) {
      const msg = formatDemoError(e);
      demoLog("fetch.fail", { error: msg });
      setError(msg);
      toast.error(msg.split("\n")[0] ?? msg);
    } finally {
      setBusy(null);
    }
  }, [buildRequest, demoIssuer, proofReady, validateFetchedPackage]);

  const generateProof = useCallback(async () => {
    if (!isConnected) {
      toast.error("Connect Freighter first");
      return;
    }
    if (!proofReady) {
      toast.error("Complete wallet verification before generating a proof");
      return;
    }
    const request = buildRequest();
    if (!request) return;
    setBusy("prove");
    setError(null);
    demoLog("prove.start");
    try {
      const packageToProve = pkg ?? (await demoIssuer.createDemoTransfer(request));
      if (!pkg) setPkg(packageToProve);
      demoLog("prove.package", packageCheckpoint(packageToProve));

      await validateFetchedPackage(packageToProve);

      const result = await client.prove({
        package: packageToProve,
        browser: true,
        wasmUrl: client.cfg.wasmUrl,
        zkeyUrl: client.cfg.zkeyUrl,
      });

      demoLog("prove.ok", provenCheckpoint(result, packageToProve));
      setProven(result);
      setLastProven(result);
      setNullifier(result.nullifier);
      toast.success("Proof generated in browser");
    } catch (e) {
      const msg = formatDemoError(e);
      demoLog("prove.fail", { error: msg });
      setError(msg);
      toast.error(msg.split("\n")[0] ?? msg);
    } finally {
      setBusy(null);
    }
  }, [buildRequest, client, demoIssuer, isConnected, pkg, proofReady, validateFetchedPackage]);

  const approveSac = useCallback(async () => {
    if (!walletSigner || !pkg) {
      toast.error("Fetch a proof package first");
      return;
    }
    setBusy("approve");
    setError(null);
    demoLog("approve.start");
    try {
      const result = await client.approveSacForCompliance(pkg, walletSigner);
      setApprovedSac(true);
      demoLog("approve.ok", { tx_hash: result.hash });
      toast.success("USDC allowance approved for compliance contract");
    } catch (e) {
      const msg = formatDemoError(e);
      demoLog("approve.fail", { error: msg });
      setError(msg);
      toast.error(msg.split("\n")[0] ?? msg);
    } finally {
      setBusy(null);
    }
  }, [client, pkg, walletSigner]);

  const submitTransfer = useCallback(
    async (overrideProven?: ProvenTransfer) => {
      if (!walletSigner || !proven) {
        toast.error("Connect wallet and generate proof first");
        return;
      }
      if (!approvedSac) {
        toast.error("Approve USDC allowance for the compliance contract first");
        return;
      }
      const request = buildRequest();
      if (!request) return;
      const activePkg = pkg ?? (await demoIssuer.createDemoTransfer(request));
      if (!pkg) setPkg(activePkg);

      const toSettle = overrideProven ?? proven;
      setBusy("settle");
      setError(null);
      setSimulated(false);
      demoLog("settle.start", {
        ...provenCheckpoint(toSettle, activePkg),
        freighter: walletSigner.publicKey,
        replay: Boolean(overrideProven),
      });
      try {
        if (!overrideProven && address) {
          const audit = await client.audit(toSettle.nullifier, address);
          if (audit.attested) {
            const msg = COPY.demo.transfer.duplicateNullifier;
            prepareFreshTransfer();
            setValidationError(msg);
            toast.error(msg);
            return;
          }
        }
        await client.simulateSettle(toSettle, activePkg, walletSigner.publicKey);
        demoLog("settle.simulate.ok");
        setSimulated(true);
        const result = await client.settleWithWallet(
          toSettle,
          activePkg,
          walletSigner,
        );
        const hash = extractTxHash(result);
        if (!hash) throw new Error("Transaction submitted but hash missing");
        demoLog("settle.ok", { tx_hash: hash, nullifier: toSettle.nullifier });
        setTxHash(hash);
        setNullifier(toSettle.nullifier);
        toast.success("Transfer submitted");
      } catch (e) {
        const msg = formatDemoError(e);
        if (/Error\(Contract,\s*#9\)/.test(msg) && !overrideProven) {
          prepareFreshTransfer();
          setValidationError(COPY.demo.transfer.duplicateNullifier);
          toast.error(COPY.demo.transfer.duplicateNullifier);
        } else {
          demoLog("settle.fail", { error: msg });
          setError(msg);
          toast.error(msg.split("\n")[0] ?? msg);
        }
      } finally {
        setBusy(null);
      }
    },
    [approvedSac, buildRequest, client, demoIssuer, pkg, prepareFreshTransfer, proven, walletSigner, address],
  );

  const viewAudit = useCallback(async () => {
    if (!nullifier && !txHash) {
      toast.error("No nullifier or transaction hash yet");
      return;
    }
    setBusy("audit");
    setError(null);
    demoLog("audit.start", { nullifier, tx_hash: txHash, address });
    try {
      const eventByTx = txHash ? await client.getProofSettledByTxHash(txHash) : null;
      const audit = nullifier
        ? await client.audit(nullifier, address ?? "")
        : { attested: false, nullifier: "", event: null };
      const event = eventByTx ?? audit.event;

      demoLog("audit.ok", {
        attested: audit.attested,
        ledger: event?.ledger,
        tx_lookup_hit: Boolean(eventByTx),
      });

      if (event) {
        setAuditLedger(event.ledger);
        toast.success(`Audit event at ledger ${event.ledger}`);
      } else if (audit.attested) {
        toast.message("Transfer is attested on-chain, but the event index has not caught up yet");
      } else {
        toast.message("No on-chain proof event found yet — confirm the transaction succeeded, then retry");
      }
    } catch (e) {
      const msg = formatDemoError(e);
      demoLog("audit.fail", { error: msg });
      setError(msg);
      toast.error(msg.split("\n")[0] ?? msg);
    } finally {
      setBusy(null);
    }
  }, [address, client, nullifier, txHash]);

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
    toast.message(COPY.demo.transfer.replayHint);
    await submitTransfer(lastProven);
  }, [lastProven, submitTransfer]);

  const corridorId = selectedCorridor?.id.toString() ?? "";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 py-8 lg:gap-8 lg:py-12">
      <header className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
        <Badge variant={isConnected ? "success" : "warning"} className="self-center sm:self-start">
          {isConnected ? "Wallet connected" : "Wallet disconnected"}
        </Badge>
        <div>
          <h1 className="text-2xl font-bold text-primary sm:text-3xl">{COPY.demo.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{COPY.demo.honesty}</p>
        </div>
      </header>

      <DemoKycPanel
        status={kycStatus}
        skipped={kycSkipped && !kycApproved}
        onReopen={() => {
          setKycSkipped(false);
          setKycActivating(false);
        }}
      />

      {error && (
        <p className="whitespace-pre-wrap border-2 border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <DemoProgressSidebar activeStep={activeStep} />

      <KycOnboardingModal
        open={showKycModal}
        kycStatus={kycStatus}
        corridorId={selectedCorridor?.id}
        recipient={recipientInput}
        onStatusChange={setKycStatus}
        onComplete={() => {
          setKycSkipped(false);
          setKycActivating(false);
          void refreshKycStatus();
        }}
        onSkip={() => {
          setKycSkipped(true);
          setKycActivating(false);
        }}
        onActivating={() => setKycActivating(true)}
      />

      <DemoTransferPanel
        isConnected={isConnected}
        isConnecting={isConnecting}
        amount={amountInput}
        recipient={recipientInput}
        sourceCountry={sourceCountry}
        destCountry={destCountry}
        corridorId={corridorId}
        corridors={corridors}
        nullifier={nullifier}
        txHash={txHash}
        hasPackage={Boolean(pkg)}
        hasProof={Boolean(proven)}
        auditLedger={auditLedger}
        busy={busy}
        validationError={validationError}
        onAmountChange={(value) => {
          setAmountInput(value);
          resetDerivedState();
        }}
        onRecipientChange={(value) => {
          setRecipientInput(value);
          resetDerivedState();
        }}
        onSourceCountryChange={(value) => {
          setSourceCountry(value);
          resetDerivedState();
        }}
        onDestCountryChange={(value) => {
          setDestCountry(value);
          resetDerivedState();
        }}
        onSwapCountries={() => {
          if (!sourceCountry || !destCountry || sourceCountry === destCountry) return;
          const hasReverse = corridors.some(
            (corridor) =>
              corridor.enabled &&
              corridor.source_country === destCountry &&
              corridor.dest_country === sourceCountry,
          );
          if (hasReverse) {
            setSourceCountry(destCountry);
            setDestCountry(sourceCountry);
          } else {
            const next = reconcileCorridorSelection(corridors, destCountry, sourceCountry);
            setSourceCountry(next.sourceCountry);
            setDestCountry(next.destCountry);
          }
          resetDerivedState();
        }}
        onConnect={() => void connect()}
        onFetchPackage={() => void fetchPackage()}
        walletVerified={kycApproved}
        proofReady={proofReady}
        kycBlockReason={kycBlockReason}
        onGenerateProof={() => void generateProof()}
        onApproveSac={() => void approveSac()}
        sacApproved={approvedSac}
        onSubmit={() => void submitTransfer()}
        onViewAudit={() => void viewAudit()}
        onTryInvalid={() => void tryInvalid()}
        onTryReplay={() => void tryReplay()}
        canReplay={Boolean(lastProven)}
      />
    </div>
  );
}
