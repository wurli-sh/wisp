import { useEffect } from "react";
import { useDemoIssuerClient } from "@/hooks/useDemoIssuerClient";
import { demoLog } from "@/lib/demoLog";

/**
 * Fire-and-forget issuer ping on app mount. Hosted issuers (Render free tier)
 * cold-start and can block the first KYC/corridor call for 30-60s; warming it
 * early means the backend is awake by the time the user acts. Failures are
 * ignored (harmless locally and offline).
 */
export function useIssuerWarmup() {
  const demoIssuer = useDemoIssuerClient();
  useEffect(() => {
    void demoIssuer.listCorridors().then(
      () => demoLog("warmup.ok"),
      (e) => demoLog("warmup.fail", { error: e instanceof Error ? e.message : String(e) }),
    );
  }, [demoIssuer]);
}
