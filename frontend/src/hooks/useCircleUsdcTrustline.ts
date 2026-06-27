import { useCallback, useEffect, useState } from "react";
import {
  WispClient,
  establishCircleUsdcTrustline,
  hasCircleUsdcTrustline,
  type WalletSigner,
} from "@wisp_/sdk/browser";
import { toast } from "sonner";
import { env, getWispConfigOverrides, stellarExplorerTx } from "@/config/env";
import { COPY } from "@/content/copy";
import { demoLog, formatDemoError, friendlyError } from "@/lib/demoLog";

export function useCircleUsdcTrustline(
  address: string | null,
  walletSigner: WalletSigner | null,
) {
  const [hasTrustline, setHasTrustline] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(async () => {
    if (!address) {
      setHasTrustline(null);
      return;
    }
    setChecking(true);
    try {
      const ok = await hasCircleUsdcTrustline(address, env.networkPassphrase);
      setHasTrustline(ok);
    } catch {
      setHasTrustline(null);
    } finally {
      setChecking(false);
    }
  }, [address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addTrustline = useCallback(async (): Promise<boolean> => {
    if (!walletSigner) {
      toast.error(COPY.circleUsdc.connectFirst);
      return false;
    }
    setAdding(true);
    try {
      const client = WispClient.fromEnv(getWispConfigOverrides());
      const { hash } = await establishCircleUsdcTrustline(client.cfg, walletSigner);
      setHasTrustline(true);
      toast.success(COPY.circleUsdc.addedToast);
      window.open(stellarExplorerTx(hash), "_blank", "noopener,noreferrer");
      return true;
    } catch (e) {
      demoLog("circleUsdc.fail", { error: formatDemoError(e) });
      toast.error(friendlyError(e));
      return false;
    } finally {
      setAdding(false);
    }
  }, [walletSigner]);

  return {
    hasTrustline,
    checking,
    adding,
    refresh,
    addTrustline,
    needsTrustline: Boolean(address) && hasTrustline === false,
  };
}
