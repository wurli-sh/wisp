import type { WispConfig } from "./config.js";
import type { IssuerAdapter } from "@wisp_/client";
import { HttpIssuerAdapter } from "@wisp_/client";
import type {
  CreateAndSettleTransferInput,
  CreateAndSettleTransferResult,
  ProofPackageSource,
} from "@wisp_/flows";
import {
  createAndSettleTransfer,
  createAndSettleTransferWithRetry,
} from "@wisp_/flows";
import { proveFromPackageBrowser } from "./prove/browser.js";
import type { ProvenTransfer } from "./prove/prover.js";
import {
  settleWithKeypair,
  settleWithWallet,
  simulateSettle,
  approveSacForCompliance,
  approveSacForComplianceWithKeypair,
  type WalletSigner,
} from "./settle/compliant-transfer.js";
import {
  getProofSettledByNullifier,
  getProofSettledByTxHash,
  listProofSettledEvents,
  auditNullifier,
} from "@wisp_/client";
import { resolveIssuer, resolveIssuerFromUrl, listIssuers } from "@wisp_/client";
import { fieldDecimalToBytes32 } from "./settle/encoding.js";
import type { ProofPackage } from "@wisp_/js";
import {
  validatePackage,
  type ValidatePackageOptions,
  type ValidatePackageResult,
} from "./validate/package.js";

/** Input accepted by {@link WispClient.prove}. */
export interface ProveInput {
  package?: ProofPackage;
  artifactDir?: string;
  zkeyPath?: string;
  browser?: boolean;
  wasmUrl?: string;
  zkeyUrl?: string;
  credentialSecret?: bigint;
}

/**
 * Browser-safe Wisp client.
 *
 * This base contains the entire prove → settle → audit surface with **no
 * static Node built-in imports**, so it can be bundled for the browser without
 * shimming `node:*`. `prove()` here only supports browser proving (snarkjs +
 * wasm/zkey URLs); the Node entry (`@wisp_/sdk`) overrides it to add the
 * `circom`/`snarkjs` CLI prover.
 */
export class WispClient {
  readonly cfg: WispConfig;
  readonly issuer: IssuerAdapter;

  constructor(cfg: WispConfig, issuer?: IssuerAdapter) {
    this.cfg = cfg;
    this.issuer = issuer ?? new HttpIssuerAdapter(cfg.issuerUrl);
  }

  async prove(input: ProveInput = {}): Promise<ProvenTransfer> {
    if (!input.package) {
      throw new Error("prove requires an explicit ProofPackage (fetch via IssuerAdapter first)");
    }
    if (input.credentialSecret == null) {
      throw new Error("prove requires the locally derived credentialSecret");
    }
    if (!input.browser) {
      throw new Error(
        'Node prove is unavailable in this build. Call prove({ browser: true }) with wasmUrl/zkeyUrl, or import WispClient from "@wisp_/sdk" in a Node runtime.',
      );
    }
    const wasmUrl = input.wasmUrl ?? this.cfg.wasmUrl;
    const zkeyUrl = input.zkeyUrl ?? this.cfg.zkeyUrl;
    if (!wasmUrl || !zkeyUrl) {
      throw new Error("browser prove requires wasmUrl and zkeyUrl");
    }
    return proveFromPackageBrowser(
      input.package,
      { wasmUrl, zkeyUrl },
      input.credentialSecret,
    );
  }

  validatePackage(
    pkg: ProofPackage,
    opts: ValidatePackageOptions,
  ): Promise<ValidatePackageResult> {
    return validatePackage(pkg, this.cfg, opts);
  }

  settleWithKeypair(proven: ProvenTransfer, pkg: ProofPackage, secret: string) {
    return settleWithKeypair(proven, pkg, this.cfg, secret);
  }

  settleWithWallet(proven: ProvenTransfer, pkg: ProofPackage, wallet: WalletSigner) {
    return settleWithWallet(proven, pkg, this.cfg, wallet);
  }

  approveSacForCompliance(pkg: ProofPackage, wallet: WalletSigner) {
    return approveSacForCompliance(pkg, this.cfg, wallet);
  }

  approveSacForComplianceWithKeypair(pkg: ProofPackage, secret: string) {
    return approveSacForComplianceWithKeypair(pkg, this.cfg, secret);
  }

  simulateSettle(proven: ProvenTransfer, pkg: ProofPackage, publicKey: string) {
    return simulateSettle(proven, pkg, this.cfg, publicKey);
  }

  async audit(nullifierDecimal: string, publicKey: string) {
    const bytes = fieldDecimalToBytes32(nullifierDecimal);
    const attested = await auditNullifier(bytes, this.cfg, publicKey);
    const event = await getProofSettledByNullifier(this.cfg, bytes.toString("hex")).catch(
      () => null,
    );
    return {
      attested,
      nullifier: bytes.toString("hex"),
      event,
    };
  }

  listProofSettledEvents(opts?: { limit?: number; startLedger?: number }) {
    return listProofSettledEvents(this.cfg, opts);
  }

  getProofSettledByTxHash(txHash: string) {
    return getProofSettledByTxHash(this.cfg, txHash);
  }

  getProofSettledByNullifier(nullifierHex: string) {
    return getProofSettledByNullifier(this.cfg, nullifierHex);
  }

  resolveIssuer(issuerPublicKey: string) {
    return resolveIssuer(this.cfg, issuerPublicKey);
  }

  resolveIssuerFromUrl(url: string) {
    return resolveIssuerFromUrl(this.cfg, url);
  }

  listIssuers(opts?: { cursor?: number; limit?: number; startLedger?: number }) {
    return listIssuers(this.cfg, opts);
  }

  createAndSettleTransfer(
    input: Omit<CreateAndSettleTransferInput, "client" | "issuer"> & { issuer?: ProofPackageSource },
  ): Promise<CreateAndSettleTransferResult> {
    return createAndSettleTransfer({
      ...input,
      client: this,
      issuer: input.issuer ?? this.issuer,
    });
  }

  createAndSettleTransferWithRetry(
    input: Omit<CreateAndSettleTransferInput, "client" | "issuer"> & { issuer?: ProofPackageSource },
  ): Promise<CreateAndSettleTransferResult> {
    return createAndSettleTransferWithRetry({
      ...input,
      client: this,
      issuer: input.issuer ?? this.issuer,
    });
  }
}
