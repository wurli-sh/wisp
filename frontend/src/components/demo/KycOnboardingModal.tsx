import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle,
  Key,
  Loader2,
  MapPin,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { MockKycStatusResponse } from "@amoeba/sdk";
import { COPY } from "@/content/copy";
import { useDemoIssuerClient } from "@/hooks/useDemoIssuerClient";
import { useWallet } from "@/hooks/useWallet";
import { TextShimmer } from "@/components/ui/TextShimmer";
import { Button } from "@/components/ui/Button";
import { buttonTap, modalContent, modalOverlay } from "@/lib/animations";
import { normalizeKycStatus } from "@/lib/kyc";

type Step = "welcome" | "signing" | "done";
type SubmitPhase = "challenge" | "submit";

const STEPS: { key: Step; label: string }[] = [
  { key: "welcome", label: COPY.demo.kyc.wizard.steps.setup },
  { key: "signing", label: COPY.demo.kyc.wizard.steps.verify },
];

const FEATURE_ICONS = [Key, ShieldCheck, MapPin] as const;
const SUBMIT_TIMEOUT_MS = 15_000;

interface KycOnboardingModalProps {
  open: boolean;
  onComplete: () => void;
  onSkip: () => void;
  onActivating?: () => void;
  onStatusChange?: (status: MockKycStatusResponse | null) => void;
  kycStatus?: MockKycStatusResponse | null;
  corridorId?: number;
  recipient?: string;
}

export function KycOnboardingModal({
  open,
  onComplete,
  onSkip,
  onActivating,
  onStatusChange,
  kycStatus,
  corridorId,
  recipient,
}: KycOnboardingModalProps) {
  const demoIssuer = useDemoIssuerClient();
  const { address, walletSigner } = useWallet();

  const [step, setStep] = useState<Step>("welcome");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<SubmitPhase>("challenge");
  const [error, setError] = useState("");
  const signingStarted = useRef(false);
  const autoCompleteTimeout = useRef<number | null>(null);

  const rejected = kycStatus?.kyc_status === "rejected";

  useEffect(() => {
    if (!open) {
      signingStarted.current = false;
      if (autoCompleteTimeout.current) {
        window.clearTimeout(autoCompleteTimeout.current);
        autoCompleteTimeout.current = null;
      }
      return;
    }
    setError("");
    setPhase("challenge");
    setStep(rejected ? "signing" : "welcome");
  }, [open, rejected]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        onSkip();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onSkip, open]);

  const refreshStatus = useCallback(async () => {
    if (!address) {
      onStatusChange?.(null);
      return null;
    }
    const next = await demoIssuer.getMockKycStatus(address, {
      corridor_id: corridorId,
      recipient: recipient?.trim() || undefined,
    });
    onStatusChange?.(next);
    return next;
  }, [address, demoIssuer, corridorId, onStatusChange, recipient]);

  const completeFlow = useCallback(() => {
    setStep("done");
    autoCompleteTimeout.current = window.setTimeout(() => {
      onComplete();
    }, 900);
  }, [onComplete]);

  const runSignAndSubmit = useCallback(async () => {
    if (!address || !walletSigner) {
      setError(COPY.demo.kyc.connectFirst);
      setStep("welcome");
      return;
    }

    setBusy(true);
    setPhase("challenge");
    setError("");
    try {
      const challenge = await demoIssuer.requestMockKycChallenge(address);
      setPhase("submit");
      const signed = await walletSigner.signTransaction(challenge.challenge_xdr);
      const response = await Promise.race([
        demoIssuer.submitMockKyc({
          challenge_id: challenge.challenge_id,
          signed_challenge_xdr: signed.signedTxXdr,
          corridor_id: corridorId,
          recipient: recipient?.trim() || undefined,
        }),
        new Promise<never>((_, reject) =>
          window.setTimeout(
            () => reject(new Error("Verification timed out while waiting for the issuer.")),
            SUBMIT_TIMEOUT_MS,
          ),
        ),
      ]);
      const immediate = {
        ...normalizeKycStatus(response),
        wallet: address,
      };
      onStatusChange?.(immediate);
      if (response.publish_warning) {
        toast.warning(response.publish_warning);
      }
      if (response.status === "rejected") {
        setError(response.reason ?? COPY.demo.kyc.rejectedHint);
        setStep("welcome");
        signingStarted.current = false;
        return;
      }
      if (immediate.kyc_status === "approved") {
        completeFlow();
        return;
      }
      const next = await refreshStatus();
      if (next?.kyc_status === "approved") {
        completeFlow();
        return;
      }
      setError("Wallet verification finished, but issuer setup is still catching up. Retry in a moment.");
      setStep("welcome");
      signingStarted.current = false;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const next = await refreshStatus().catch(() => null);
      if (next?.kyc_status === "approved") {
        if (next.publish_warning) {
          toast.warning(next.publish_warning);
        }
        completeFlow();
        return;
      }
      const friendly =
        msg.includes("User declined") || msg.includes("denied")
          ? "Signature rejected. Try again."
          : msg;
      setError(friendly);
      setStep("welcome");
      signingStarted.current = false;
    } finally {
      setBusy(false);
    }
  }, [address, completeFlow, corridorId, demoIssuer, onStatusChange, recipient, refreshStatus, walletSigner]);

  useEffect(() => {
    if (step !== "signing" || signingStarted.current) return;
    signingStarted.current = true;
    void runSignAndSubmit();
  }, [step, runSignAndSubmit]);

  const handleStart = () => {
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
            <div className="mx-auto flex w-full max-w-[320px] items-center gap-2 px-10 pt-5 pb-1">
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

                  <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
                    {COPY.demo.kyc.wizard.intro}
                  </p>
                  <p className="mb-5 border-2 border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                    {COPY.demo.kyc.wizard.demoPolicy}
                  </p>

                  <div className="mb-5 space-y-3 border-2 border-border bg-card p-4">
                    {COPY.demo.kyc.wizard.features.map((feature, index) => {
                      const Icon = FEATURE_ICONS[index] ?? ShieldCheck;
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
                    {phase === "challenge"
                      ? COPY.demo.kyc.wizard.signing
                      : COPY.demo.kyc.wizard.submitting}
                  </TextShimmer>
                  <p className="mt-2 text-center text-sm text-muted-foreground">
                    {phase === "challenge"
                      ? COPY.demo.kyc.wizard.signingHint
                      : "Signature received. Waiting for issuer confirmation."}
                  </p>
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
