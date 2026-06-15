import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getAddress,
  isAllowed,
  isConnected,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";
import type { WalletSigner } from "@amoeba/sdk";
import { env } from "@/config/env";

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [freighterAvailable, setFreighterAvailable] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const connected = await isConnected();
      if (!connected) {
        setAddress(null);
        return;
      }
      const allowed = await isAllowed();
      if (!allowed) {
        setAddress(null);
        return;
      }
      const res = await getAddress();
      if (res.error) {
        setAddress(null);
        return;
      }
      setAddress(res.address);
    } catch {
      setFreighterAvailable(false);
      setAddress(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const access = await requestAccess();
      if (access.error) throw new Error(access.error);
      await refresh();
    } finally {
      setIsConnecting(false);
    }
  }, [refresh]);

  const disconnect = useCallback(() => {
    setAddress(null);
  }, []);

  const walletSigner: WalletSigner | null = useMemo(() => {
    if (!address) return null;
    return {
      publicKey: address,
      signTransaction: async (xdr: string) => {
        const signed = await signTransaction(xdr, {
          networkPassphrase: env.networkPassphrase,
          address,
        });
        if (signed.error || !signed.signedTxXdr) {
          throw new Error(signed.error ?? "Freighter sign failed");
        }
        return { signedTxXdr: signed.signedTxXdr };
      },
    };
  }, [address]);

  return {
    address,
    isConnected: Boolean(address),
    isConnecting,
    freighterAvailable,
    connect,
    disconnect,
    walletSigner,
    refresh,
  };
}
