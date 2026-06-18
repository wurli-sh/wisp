import { useMemo } from "react";
import { AmoebaClient } from "@amoeba/sdk";
import { env } from "@/config/env";

export function useAmoebaClient() {
  return useMemo(
    () =>
      new AmoebaClient({
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
