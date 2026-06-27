export type { ChainClientConfig } from "./types.js";
export type { CorridorDetail, IssuerAdapter, IssuerCapabilities, IssuerWellKnown, ProofPackageRequest, ActivateCredentialRequest, ActivateCredentialResponse, ActivationChallengeRequest, ChallengeResponse, CredentialInfo, ProofPackageDraft, SignedProofPackageRequest, } from "./adapter.js";
export { HttpIssuerAdapter, IssuerClient, issuerFetch } from "./http-adapter.js";
export { getLatestChainRoots, getLatestCorridorRoots, getLatestIssuerEnabled, getLatestIssuerRecord, getLatestIssuerRoots, listIssuerRegistryEntries, } from "./roots.js";
export type { ChainCorridorRoots, ChainIssuerPage, ChainIssuerRecord, ChainIssuerRoots, ChainRootsBundle, } from "./roots.js";
export { getProofSettledByNullifier, getProofSettledByTxHash, listProofSettledEvents, } from "./events.js";
export type { ProofSettledEvent } from "./events.js";
export { auditNullifier } from "./audit.js";
export { getVerifierVkHash, vkHashesMatch } from "./verifier.js";
export { listIssuers, resolveIssuer, resolveIssuerFromUrl } from "./resolve.js";
export type { ResolvedIssuer } from "./resolve.js";
//# sourceMappingURL=index.d.ts.map