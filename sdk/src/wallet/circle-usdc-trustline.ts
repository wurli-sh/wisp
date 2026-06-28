import {
  Asset,
  Horizon,
  Operation,
  TransactionBuilder,
  Keypair,
} from "@stellar/stellar-sdk";
import type { WispConfig } from "../config.js";
import type { WalletSigner } from "../settle/compliant-transfer.js";

/** Circle testnet USDC issuer (classic asset backing the SAC). */
export const CIRCLE_TESTNET_USDC_ISSUER =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

export const CIRCLE_TESTNET_USDC_CODE = "USDC";

function horizonUrl(networkPassphrase: string): string {
  if (networkPassphrase.includes("Test")) {
    return "https://horizon-testnet.stellar.org";
  }
  return "https://horizon.stellar.org";
}

export function circleUsdcAsset(): Asset {
  return new Asset(CIRCLE_TESTNET_USDC_CODE, CIRCLE_TESTNET_USDC_ISSUER);
}

export async function hasCircleUsdcTrustline(
  publicKey: string,
  networkPassphrase: string,
): Promise<boolean> {
  const server = new Horizon.Server(horizonUrl(networkPassphrase));
  try {
    const account = await server.loadAccount(publicKey);
    return account.balances.some((b) => {
      if (b.asset_type === "native" || b.asset_type === "liquidity_pool_shares") {
        return false;
      }
      return (
        b.asset_code === CIRCLE_TESTNET_USDC_CODE &&
        b.asset_issuer === CIRCLE_TESTNET_USDC_ISSUER
      );
    });
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } })?.response?.status;
    if (status === 404) return false;
    throw e;
  }
}

/**
 * Pulls Horizon's `extras.result_codes` out of a failed submission so callers
 * see the real reason (e.g. `tx_bad_auth`, `op_low_reserve`, `op_no_issuer`)
 * instead of an opaque `400 Bad Request`.
 */
function describeSubmitError(err: unknown): string | null {
  const codes = (
    err as {
      response?: { data?: { extras?: { result_codes?: unknown } } };
    }
  )?.response?.data?.extras?.result_codes;
  if (!codes || typeof codes !== "object") return null;
  return JSON.stringify(codes);
}

export async function establishCircleUsdcTrustline(
  cfg: WispConfig,
  wallet: WalletSigner,
): Promise<{ hash: string }> {
  const server = new Horizon.Server(horizonUrl(cfg.networkPassphrase));
  const account = await server.loadAccount(wallet.publicKey);
  const asset = circleUsdcAsset();

  let tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: cfg.networkPassphrase,
  })
    .addOperation(Operation.changeTrust({ asset }))
    .setTimeout(30)
    .build();

  const signed = await wallet.signTransaction(tx.toXDR());
  const signedTx = TransactionBuilder.fromXDR(signed.signedTxXdr, cfg.networkPassphrase);
  let result: Awaited<ReturnType<typeof server.submitTransaction>>;
  try {
    result = await server.submitTransaction(signedTx);
  } catch (err) {
    const codes = describeSubmitError(err);
    if (codes) {
      throw new Error(`changeTrust rejected by Horizon: ${codes}`);
    }
    throw err;
  }
  if (!result.successful) {
    throw new Error(`changeTrust failed: ${JSON.stringify(result)}`);
  }
  return { hash: result.hash };
}

export async function establishCircleUsdcTrustlineWithSecret(
  cfg: WispConfig,
  secret: string,
): Promise<{ hash: string }> {
  const kp = Keypair.fromSecret(secret);
  const wallet: WalletSigner = {
    publicKey: kp.publicKey(),
    signTransaction: async (xdr: string) => {
      const tx = TransactionBuilder.fromXDR(xdr, cfg.networkPassphrase);
      tx.sign(kp);
      return { signedTxXdr: tx.toXDR() };
    },
  };
  return establishCircleUsdcTrustline(cfg, wallet);
}
