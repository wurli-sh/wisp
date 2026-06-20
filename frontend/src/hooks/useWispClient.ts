import { useMemo } from "react";
import { WispClient } from "@wisp_/sdk";
import { env } from "@/config/env";

export function useWispClient() {
  return useMemo(
    () =>
      new WispClient({
        profile: env.profile,
        rpcUrl: env.rpcUrl,
        networkPassphrase: env.networkPassphrase,
        verifierId: env.verifierId,
        complianceId: env.complianceId,
        assetId: env.assetId,
        issuerPublicKey: env.issuerPublicKey,
        issuerUrl: env.issuerUrl,
        validateStartLedger: env.validateStartLedger,
        artifactDir: "/circuits",
        zkeyPath: env.zkeyUrl,
        wasmPath: env.wasmUrl,
        witnessGen: "",
        wasmUrl: env.wasmUrl,
        zkeyUrl: env.zkeyUrl,
        demoFixtureUrl: env.demoFixtureUrl,
      }),
    [],
  );
}
