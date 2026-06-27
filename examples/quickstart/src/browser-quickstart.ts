/**
 * Browser quickstart for `@wisp_/sdk`.
 *
 * Demonstrates the full compliant-transfer flow from a browser/bundler target:
 *   construct client → fetch ProofPackage from issuer → prove (client-side
 *   Groth16) → SAC approve → simulate → settle with a wallet → audit.
 *
 * Run inside any bundler (Vite/webpack/Next). The import graph of
 * `@wisp_/sdk/browser` is node-free, so NO `node:*` shims or prover aliasing
 * are required. The only browser prerequisite is a global `Buffer` polyfill
 * (Stellar/snarkjs expect it) — see `ensureBufferPolyfill()` below.
 */
import { Buffer } from "buffer";
import {
  WispClient,
  HttpIssuerAdapter,
  DuplicateNullifierError,
  type WalletSigner,
} from "@wisp_/sdk/browser";
import {
  getAddress,
  isConnected,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";

/** Stellar/snarkjs expect a global Buffer. Call once at app startup. */
export function ensureBufferPolyfill(): void {
  (globalThis as { Buffer?: typeof Buffer }).Buffer ??= Buffer;
}

/**
 * Build a client from your own config. Every value is injected — nothing is
 * hardcoded in the SDK. In a real app these come from `import.meta.env`.
 */
export function makeClient(): WispClient {
  return new WispClient({
    profile: "testnet",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
    complianceId: "C_YOUR_COMPLIANCE_CONTRACT_ID",
    verifierId: "C_YOUR_VERIFIER_CONTRACT_ID",
    assetId: "C_YOUR_SAC_CONTRACT_ID",
    issuerUrl: "https://your-issuer.example.com",
    issuerPublicKey: "G_YOUR_ISSUER_PUBLIC_KEY",
    // Browser proving fetches these by URL (serve them as static assets):
    wasmUrl: "/circuits/compliance_corridor.wasm",
    zkeyUrl: "/circuits/compliance_corridor_final.zkey",
    // Node-only fields are unused in the browser:
    artifactDir: "",
    zkeyPath: "",
    wasmPath: "",
    witnessGen: "",
  });
}

/** Wrap Freighter into the SDK's `WalletSigner` shape. */
export async function connectFreighter(networkPassphrase: string): Promise<WalletSigner> {
  if (!(await isConnected()).isConnected) {
    throw new Error("Freighter is not installed");
  }
  const access = await requestAccess();
  if (access.error) throw new Error(access.error);

  const { address, error } = await getAddress();
  if (error || !address) throw new Error(error ?? "no Freighter address");

  return {
    publicKey: address,
    signTransaction: async (xdr: string) => {
      const signed = await signTransaction(xdr, { networkPassphrase, address });
      if (signed.error || !signed.signedTxXdr) {
        throw new Error(signed.error ?? "Freighter sign failed");
      }
      return { signedTxXdr: signed.signedTxXdr };
    },
  };
}

/**
 * One-call happy path: fetch → validate → prove → duplicate-check → approve →
 * simulate → settle. `createAndSettleTransfer` orchestrates all of it.
 */
export async function payOnce(): Promise<void> {
  ensureBufferPolyfill();
  const client = makeClient();

  // Production issuer. Swap for your own object implementing
  // `createProofPackage(req)` — or `DemoIssuerClient` from `@wisp_/sdk/demo`
  // for the bundled mock-KYC demo.
  const issuer = new HttpIssuerAdapter(client.cfg.issuerUrl);

  const walletSigner = await connectFreighter(client.cfg.networkPassphrase);
  const corridorId = 1; // e.g. US -> MX

  try {
    const result = await client.createAndSettleTransfer({
      issuer,
      request: {
        sender_strkey: walletSigner.publicKey,
        recipient_strkey: "G_RECIPIENT_PUBLIC_KEY",
        amount: "1000000", // smallest unit (stroops)
        corridor_id: corridorId,
        source_country: "US",
        dest_country: "MX",
      },
      validation: {
        issuerPublicKey: client.cfg.issuerPublicKey!,
        corridorId,
      },
      walletSigner,
      senderAddress: walletSigner.publicKey,
      proof: { browser: true, wasmUrl: client.cfg.wasmUrl!, zkeyUrl: client.cfg.zkeyUrl! },
      onStage: (stage) => console.log("[wisp] stage:", stage),
    });

    console.log("settled — nullifier:", result.nullifier);
  } catch (e) {
    if (e instanceof DuplicateNullifierError) {
      console.warn("this transfer was already settled (nullifier spent)");
      return;
    }
    throw e;
  }
}

/**
 * The same flow done step-by-step, if you want control over each stage instead
 * of the one-call helper above.
 */
export async function payManually(): Promise<void> {
  ensureBufferPolyfill();
  const client = makeClient();
  const issuer = new HttpIssuerAdapter(client.cfg.issuerUrl);
  const walletSigner = await connectFreighter(client.cfg.networkPassphrase);
  const corridorId = 1;

  // 1. Fetch a compliance proof package from the issuer.
  const pkg = await issuer.createProofPackage({
    sender_wallet: walletSigner.publicKey,
    recipient_wallet: "G_RECIPIENT_PUBLIC_KEY",
    amount: "1000000",
    corridor_id: corridorId,
  });

  // 2. Validate the package against on-chain issuer/corridor roots.
  await client.validatePackage(pkg, {
    issuerPublicKey: client.cfg.issuerPublicKey!,
    corridorId,
  });

  // 3. Generate the Groth16 proof client-side (snarkjs + wasm/zkey).
  const proven = await client.prove({
    package: pkg,
    browser: true,
    wasmUrl: client.cfg.wasmUrl!,
    zkeyUrl: client.cfg.zkeyUrl!,
  });

  // 4. Anti-replay: reject if this nullifier was already settled.
  const { attested } = await client.audit(proven.nullifier, walletSigner.publicKey);
  if (attested) throw new DuplicateNullifierError();

  // 5. Approve the SAC allowance, simulate, then settle on-chain.
  await client.approveSacForCompliance(pkg, walletSigner);
  await client.simulateSettle(proven, pkg, walletSigner.publicKey);
  const settlement = await client.settleWithWallet(proven, pkg, walletSigner);

  console.log("settled:", settlement);
}
