import { loadConfig, type WispConfig } from "./config.js";
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
import { proveFromPackage, type ProvenTransfer } from "./prove/prover.js";
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
  type ProofSettledEvent,
  auditNullifier,
} from "@wisp_/client";
import {
  getLatestChainRoots,
  getLatestCorridorRoots,
  getLatestIssuerRecord,
  getLatestIssuerRoots,
  getLatestIssuerEnabled,
  listIssuerRegistryEntries,
  type ChainCorridorRoots,
  type ChainIssuerPage,
  type ChainIssuerRecord,
  type ChainIssuerRoots,
  type ChainRootsBundle,
} from "@wisp_/client";
import {
  listIssuers,
  resolveIssuer,
  resolveIssuerFromUrl,
  type ResolvedIssuer,
} from "@wisp_/client";
import { fieldDecimalToBytes32, normalizeField } from "./settle/encoding.js";
import type { ProofPackage } from "@wisp_/js";
import {
  validatePackage,
  type ValidatePackageOptions,
  type ValidatePackageResult,
  MAX_ROOT_AGE_LEDGERS,
} from "./validate/package.js";
import {
  CorridorDisabledForIssuerError,
  CorridorMissingForIssuerError,
  IssuerMetadataMismatchError,
  IssuerNotRegisteredError,
  IssuerRootsMissingError,
  corridorRootsMatch,
  issuerRootsMatch,
  rootsMatch,
  validatePackageStructure,
} from "@wisp_/core";
import type {
  MockKycChallengeResponse,
  MockKycLifecycleStatus,
  MockKycMissing,
  MockKycRootsStatus,
  MockKycStatusResponse,
  MockKycSubmitRequest,
  MockKycSubmitResponse,
  MockKycSubmitStatus,
} from "@wisp_/demo";
import { DemoIssuerClient } from "@wisp_/demo";

export class WispClient {
  readonly cfg: WispConfig;
  readonly issuer: IssuerAdapter;

  constructor(cfg: WispConfig, issuer?: IssuerAdapter) {
    this.cfg = cfg;
    this.issuer = issuer ?? new HttpIssuerAdapter(cfg.issuerUrl);
  }

  static fromEnv(overrides: Record<string, string | undefined> = {}): WispClient {
    return new WispClient(loadConfig(overrides));
  }

  async prove(input: {
    package?: ProofPackage;
    artifactDir?: string;
    zkeyPath?: string;
    browser?: boolean;
    wasmUrl?: string;
    zkeyUrl?: string;
  } = {}): Promise<ProvenTransfer> {
    if (!input.package) {
      throw new Error("prove requires an explicit ProofPackage (fetch via IssuerAdapter first)");
    }
    const pkg = input.package;
    const cfg: WispConfig = {
      ...this.cfg,
      ...(input.artifactDir ? { artifactDir: input.artifactDir } : {}),
      ...(input.zkeyPath ? { zkeyPath: input.zkeyPath } : {}),
    };

    if (input.browser) {
      const wasmUrl = input.wasmUrl ?? cfg.wasmUrl;
      const zkeyUrl = input.zkeyUrl ?? cfg.zkeyUrl;
      if (!wasmUrl || !zkeyUrl) {
        throw new Error("browser prove requires wasmUrl and zkeyUrl");
      }
      return proveFromPackageBrowser(pkg, { wasmUrl, zkeyUrl });
    }

    return proveFromPackage(pkg, cfg);
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

export { loadConfig } from "./config.js";
export { loadWispEnv, loadAmoebaEnv } from "./env.js";
export { serializeSnarkjsProof } from "./prove/serialize.js";
export { fieldDecimalToBytes32, normalizeField } from "./settle/encoding.js";
export type { ProofSettledEvent };
export type { ChainCorridorRoots, ChainIssuerPage, ChainIssuerRecord, ChainIssuerRoots, ChainRootsBundle };
export {
  getLatestChainRoots,
  getLatestCorridorRoots,
  getLatestIssuerRecord,
  getLatestIssuerRoots,
  getLatestIssuerEnabled,
  listIssuerRegistryEntries,
} from "./audit/roots.js";
export type { WalletSigner } from "./settle/compliant-transfer.js";
export { approveSacForCompliance, approveSacForComplianceWithKeypair } from "./settle/compliant-transfer.js";
export type { ProvenTransfer } from "./prove/prover.js";
export type { ResolvedIssuer } from "@wisp_/client";
export { resolveIssuer, resolveIssuerFromUrl, listIssuers } from "@wisp_/client";
export type { IssuerAdapter, IssuerWellKnown, CorridorDetail, ProofPackageRequest } from "@wisp_/client";
export { HttpIssuerAdapter, IssuerClient } from "@wisp_/client";
export {
  validatePackage,
  MAX_ROOT_AGE_LEDGERS,
  type ValidatePackageOptions,
  type ValidatePackageResult,
} from "./validate/package.js";
export { rootsMatch, issuerRootsMatch, corridorRootsMatch, validatePackageStructure } from "@wisp_/core";
export type { DemoStrkeys } from "./config.js";
export {
  CorridorDisabledForIssuerError,
  CorridorMissingForIssuerError,
  IssuerMetadataMismatchError,
  IssuerNotRegisteredError,
  IssuerRootsMissingError,
} from "@wisp_/core";
export type {
  CreateAndSettleTransferInput,
  CreateAndSettleTransferResult,
  ProofPackageSource,
  TransferStage,
} from "@wisp_/flows";
export {
  DuplicateNullifierError,
  createAndSettleTransfer,
  createAndSettleTransferWithRetry,
  fetchTransferPackage,
  proveTransferPackage,
  validateTransferPackage,
} from "@wisp_/flows";
export type {
  MockKycChallengeResponse,
  MockKycLifecycleStatus,
  MockKycMissing,
  MockKycRootsStatus,
  MockKycStatusResponse,
  MockKycSubmitRequest,
  MockKycSubmitResponse,
  MockKycSubmitStatus,
} from "@wisp_/demo";
export { DemoIssuerClient } from "@wisp_/demo";
export {
  CIRCLE_TESTNET_USDC_CODE,
  CIRCLE_TESTNET_USDC_ISSUER,
  circleUsdcAsset,
  establishCircleUsdcTrustline,
  establishCircleUsdcTrustlineWithSecret,
  hasCircleUsdcTrustline,
} from "./wallet/circle-usdc-trustline.js";
