import { useMemo } from "react";
import { DemoIssuerClient } from "@wisp_/sdk/demo";
import { env } from "@/config/env";

export function useDemoIssuerClient() {
  return useMemo(() => new DemoIssuerClient(env.issuerUrl), []);
}
