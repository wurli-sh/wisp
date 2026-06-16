import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle,
  Key,
  Loader2,
  MapPin,
  Shield,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import type { MockKycStatusResponse } from "@amoeba/sdk";
import { COPY } from "@/content/copy";
import { useAmoebaClient } from "@/hooks/useAmoebaClient";
import { useWallet } from "@/hooks/useWallet";
import { TextShimmer } from "@/components/ui/TextShimmer";
import { Button } from "@/components/ui/Button";
import { validateKycForm } from "@/lib/kyc";
import { buttonTap, modalContent, modalOverlay } from "@/lib/animations";
import { cn } from "@/lib/cn";

type Step = "welcome" | "details" | "signing" | "done";

const STEPS: { key: Step; label: string }[] = [
  { key: "welcome", label: COPY.demo.kyc.wizard.steps.setup },
  { key: "details", label: COPY.demo.kyc.wizard.steps.identity },
  { key: "signing", label: COPY.demo.kyc.wizard.steps.verify },
];

const FEATURE_ICONS = [Key, Shield, MapPin] as const;

interface KycOnboardingModalProps {
  open: boolean;
  onComplete: () => void;
  onSkip: () => void;
  onActivating?: () => void;
  onStatusChange?: (status: MockKycStatusResponse | null) => void;
  kycStatus?: MockKycStatusResponse | null;
}

export function KycOnboardingModal({
  open,
  onComplete,
  onSkip,
  onActivating,
  onStatusChange,
  kycStatus,
}: KycOnboardingModalProps) {
  const client = useAmoebaClient();
  const { address, walletSigner } = useWallet();

  const [step, setStep] = useState<Step>("welcome");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [sanctionsClear, setSanctionsClear] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const signingStarted = useRef(false);

  const rejected = kycStatus?.kyc_status === "rejected";

  useEffect(() => {
    if (!open) {
      signingStarted.current = false;
      return;
    }
    setError("");
    setStep(rejected ? "details" : "welcome");
  }, [open, rejected]);

  const refreshStatus = useCallback(async () => {
    if (!address) {
      onStatusChange?.(null);
      return null;
    }
    const next = await client.issuer.getMockKycStatus(address);
    onStatusChange?.(next);
    return next;
  }, [address, client, onStatusChange]);

  const runSignAndSubmit = useCallback(async () => {
    if (!address || !walletSigner) {
      setError(COPY.demo.kyc.connectFirst);
      setStep("details");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const challenge = await client.issuer.requestMockKycChallenge(address);
      const signed = await walletSigner.signTransaction(challenge.challenge_xdr);
      const response = await client.issuer.submitMockKyc({
        challenge_id: challenge.challenge_id,
        signed_challenge_xdr: signed.signedTxXdr,
        name: name.trim(),
        country: "US",
        dob,
        sanctions_clear: sanctionsClear,
      });
      await refreshStatus();
      if (response.status === "rejected") {
        setError(response.reason ?? COPY.demo.kyc.rejectedHint);
        setStep("details");
        signingStarted.current = false;
        return;
      }
      setTimeout(() => setStep("done"), 500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const friendly =
        msg.includes("User declined") || msg.includes("denied")
          ? "Signature rejected. Try again."
          : msg;
      setError(friendly);
      setStep("details");
      signingStarted.current = false;
    } finally {
      setBusy(false);
    }
  }, [address, client, dob, name, refreshStatus, sanctionsClear, walletSigner]);

  useEffect(() => {
    if (step !== "signing" || signingStarted.current) return;
    signingStarted.current = true;
    void runSignAndSubmit();
  }, [step, runSignAndSubmit]);

  const handleStart = () => {
    setError("");
    setStep("details");
  };

  const handleContinue = () => {
    const validationError = validateKycForm({ name, dob, sanctionsClear });
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    onActivating?.();
    setStep("signing");
  };

  const stepIdx = STEPS.findIndex((s) => s.key === step);

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <motion.div
          className="absolute inset-0 bg-charcoal/30 backdrop-blur-sm"
          variants={modalOverlay}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onSkip}
        />

        <motion.div
          className="relative w-full max-w-[420px] overflow-hidden border-2 border-primary/15 bg-background shadow-elev"
          variants={modalContent}
          initial="hidden"
          animate="visible"
          exit="exit"
          role="dialog"
          aria-modal="true"
          aria-label={COPY.demo.kyc.wizard.title}
        >
          <button
            type="button"
            onClick={onSkip}
            className="absolute top-3.5 right-3.5 z-10 flex size-7 cursor-pointer items-center justify-center border-2 border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X size={14} />
          </button>

          {step !== "done" && (
            <div className="flex items-center gap-2 px-6 pt-5 pb-1">
              {STEPS.map((s, i) => (
                <div key={s.key} className="h-[3px] flex-1 overflow-hidden bg-muted">
                  <motion.div
                    className="h-full bg-primary"
                    initial={{ width: "0%" }}
                    animate={{
                      width: i < stepIdx ? "100%" : i === stepIdx ? "50%" : "0%",
                    }}
                    transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="px-6 pt-4 pb-6">
            <AnimatePresence mode="wait">
              {step === "welcome" && (
                <motion.div
                  key="welcome"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center bg-primary-soft">
                      <ShieldCheck size={18} className="text-primary-bright" />
                    </div>
                    <div>
                      <h2 className="text-lg leading-tight font-bold text-primary">
                        {COPY.demo.kyc.wizard.title}
                      </h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {COPY.demo.kyc.wizard.subtitle}
                      </p>
                    </div>
                  </div>

                  <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
                    {COPY.demo.kyc.wizard.intro}
                  </p>

                  <div className="mb-5 space-y-3 border-2 border-border bg-card p-4">
                    {COPY.demo.kyc.wizard.features.map((feature, index) => {
                      const Icon = FEATURE_ICONS[index] ?? Shield;
                      return (
                        <div key={feature.label} className="flex items-center gap-3">
                          <div className="flex size-8 shrink-0 items-center justify-center bg-primary-soft">
                            <Icon size={14} className="text-primary-bright" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="block text-sm leading-tight font-medium text-foreground">
                              {feature.label}
                            </span>
                            <span className="text-xs text-muted-foreground">{feature.detail}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {error && (
                    <div className="mb-3 flex items-center gap-2 border-2 border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive">
                      <AlertTriangle size={13} />
                      <span className="text-xs">{error}</span>
                    </div>
                  )}

                  <motion.div whileTap={buttonTap}>
                    <Button className="w-full" onClick={handleStart}>
                      <Sparkles size={14} />
                      {COPY.demo.kyc.wizard.start}
                    </Button>
                  </motion.div>
                  <button
                    type="button"
                    onClick={onSkip}
                    className="mt-2.5 w-full cursor-pointer py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {COPY.demo.kyc.wizard.skip}
                  </button>
                </motion.div>
              )}

              {step === "details" && (
                <motion.div
                  key="details"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center bg-primary-soft">
                      <Shield size={16} className="text-primary-bright" />
                    </div>
                    <div>
                      <h3 className="leading-tight font-bold text-primary">Identity details</h3>
                      <p className="text-xs text-muted-foreground">
                        Demo KYC — not stored on-chain
                      </p>
                    </div>
                  </div>

                  {rejected && (
                    <div className="mb-3 space-y-1 border-2 border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                      <p>{COPY.demo.kyc.wizard.rejectedBanner}</p>
                      {kycStatus?.rejection_reason && (
                        <p className="font-medium text-foreground">{kycStatus.rejection_reason}</p>
                      )}
                      <p className="text-muted-foreground">{COPY.demo.kyc.wizard.rejectedRequirements}</p>
                    </div>
                  )}

                  <div className="mb-4 grid gap-3">
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="font-medium text-muted-foreground">{COPY.demo.kyc.name}</span>
                      <input
                        className="border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary-bright"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={COPY.demo.kyc.namePlaceholder}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="font-medium text-muted-foreground">{COPY.demo.kyc.country}</span>
                      <input
                        className="border-2 border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
                        value="US"
                        readOnly
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="font-medium text-muted-foreground">{COPY.demo.kyc.dob}</span>
                      <input
                        type="date"
                        className="border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary-bright"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                      />
                    </label>
                    <label className={cn("flex items-start gap-2 text-xs")}>
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={sanctionsClear}
                        onChange={(e) => setSanctionsClear(e.target.checked)}
                      />
                      <span>{COPY.demo.kyc.sanctions}</span>
                    </label>
                  </div>

                  {error && (
                    <div className="mb-3 flex items-center gap-2 border-2 border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive">
                      <AlertTriangle size={13} />
                      <span className="text-xs">{error}</span>
                    </div>
                  )}

                  <motion.div whileTap={buttonTap}>
                    <Button className="w-full" onClick={handleContinue} disabled={busy}>
                      {COPY.demo.kyc.wizard.continue}
                    </Button>
                  </motion.div>
                </motion.div>
              )}

              {step === "signing" && (
                <motion.div
                  key="signing"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-center justify-center py-14"
                >
                  <div className="relative mb-5">
                    <div className="flex size-12 items-center justify-center bg-primary-soft">
                      <ShieldCheck size={22} className="text-primary" />
                    </div>
                    <motion.div
                      className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center bg-primary-bright"
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <Key size={10} className="text-primary-foreground" />
                    </motion.div>
                  </div>
                  <TextShimmer className="text-base font-semibold text-muted-foreground" active>
                    {busy ? COPY.demo.kyc.wizard.signing : COPY.demo.kyc.wizard.submitting}
                  </TextShimmer>
                  <p className="mt-2 text-sm text-muted-foreground">{COPY.demo.kyc.wizard.signingHint}</p>
                  {busy && <Loader2 className="mt-4 h-5 w-5 animate-spin text-primary" />}
                </motion.div>
              )}

              {step === "done" && (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="flex flex-col items-center justify-center py-10"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.2, 1] }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="mb-4 flex size-14 items-center justify-center bg-success-soft"
                  >
                    <CheckCircle size={28} className="text-success" />
                  </motion.div>
                  <h3 className="mb-1 text-lg font-bold text-primary">{COPY.demo.kyc.wizard.doneTitle}</h3>
                  <p className="mb-6 max-w-[260px] text-center text-sm text-muted-foreground">
                    {COPY.demo.kyc.wizard.doneSubtitle}
                  </p>
                  <motion.div whileTap={buttonTap}>
                    <Button onClick={onComplete}>{COPY.demo.kyc.wizard.continueTransfer}</Button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
