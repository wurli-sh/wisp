import { loadConfigBrowser } from "./config-browser.js";
import { WispClient as WispClientBase, type ProveInput } from "./wisp-client.js";
import type { ProvenTransfer } from "./prove/prover.js";

/**
 * Browser entry for `@wisp_/sdk/browser`.
 *
 * This module's reachable import graph contains **no `node:*` references**, so
 * it bundles for the browser without aliasing/stubbing the Node prover or
 * shimming `node:fs`/`path`/`os`/`url`/`child_process`. `prove()` is
 * browser-only (snarkjs + `wasmUrl`/`zkeyUrl`); for Node CLI proving use the
 * default `@wisp_/sdk` entry.
 *
 * (Stellar/snarkjs still expect a global `Buffer`; provide a `Buffer`
 * polyfill in your app entry — that is a standard browser concern, not a Wisp
 * one.)
 */
export class WispClient extends WispClientBase {
  static fromEnv(overrides: Record<string, string | undefined> = {}): WispClient {
    return new WispClient(loadConfigBrowser(overrides));
  }
}

export type { ProveInput, ProvenTransfer };
export { loadConfigBrowser as loadConfig };
export { loadConfigBrowser };
export { serializeSnarkjsProof } from "./prove/serialize.js";
export { fieldDecimalToBytes32, normalizeField } from "./settle/encoding.js";
export {
  deriveCredentialSecret,
  activateWalletCredential,
  encodeSignedMessageBase64,
  finalizeProofPackageDraft,
  requestProofPackage,
  UnsupportedWalletCapabilityError,
} from "./credential.js";
export type { ProofSettledEvent } from "@wisp_/client";
export type {
  ChainCorridorRoots,
  ChainIssuerPage,
  ChainIssuerRecord,
  ChainIssuerRoots,
  ChainRootsBundle,
} from "@wisp_/client";
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
export type { ResolvedIssuer } from "@wisp_/client";
export { resolveIssuer, resolveIssuerFromUrl, listIssuers } from "@wisp_/client";
export type {
  IssuerAdapter,
  IssuerWellKnown,
  CorridorDetail,
  ProofPackageRequest,
} from "@wisp_/client";
export { HttpIssuerAdapter, IssuerClient } from "@wisp_/client";
export {
  validatePackage,
  MAX_ROOT_AGE_LEDGERS,
  type ValidatePackageOptions,
  type ValidatePackageResult,
} from "./validate/package.js";
export { rootsMatch, issuerRootsMatch, corridorRootsMatch, validatePackageStructure } from "@wisp_/core";
export type { DemoStrkeys, WispConfig } from "./config.js";
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
