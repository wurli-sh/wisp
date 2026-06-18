import { useMemo } from "react";
import { DemoIssuerClient } from "@amoeba/sdk/demo";
import { env } from "@/config/env";

export function useDemoIssuerClient() {
  return useMemo(() => new DemoIssuerClient(env.issuerUrl), []);
}
