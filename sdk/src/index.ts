import { loadConfig } from "./config.js";
import { WispClient as WispClientBase, type ProveInput } from "./wisp-client.js";
import { proveFromPackage, type ProvenTransfer } from "./prove/prover.js";

/**
 * Node entry. Extends the browser-safe {@link WispClientBase} with the Node
 * `circom`/`snarkjs` CLI prover and an env-backed {@link WispClient.fromEnv}.
 * Browser apps should import from `@wisp_/sdk/browser` instead.
 */
export class WispClient extends WispClientBase {
  static fromEnv(overrides: Record<string, string | undefined> = {}): WispClient {
    return new WispClient(loadConfig(overrides));
  }

  override async prove(input: ProveInput = {}): Promise<ProvenTransfer> {
    if (input.browser || !input.package) {
      return super.prove(input);
    }
    const cfg = {
      ...this.cfg,
      ...(input.artifactDir ? { artifactDir: input.artifactDir } : {}),
      ...(input.zkeyPath ? { zkeyPath: input.zkeyPath } : {}),
    };
    if (input.credentialSecret == null) {
      throw new Error("prove requires the locally derived credentialSecret");
    }
    return proveFromPackage(input.package, cfg, input.credentialSecret);
  }
}

export type { ProveInput } from "./wisp-client.js";
export { loadConfig } from "./config.js";
export { loadWispEnv, loadAmoebaEnv } from "./env.js";
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
export type { ProvenTransfer } from "./prove/prover.js";
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
