import { IssuerMetadataMismatchError, IssuerNotRegisteredError, } from "@wisp_/core";
import { getLatestIssuerRecord, listIssuerRegistryEntries } from "./roots.js";
function normalizeUrl(url) {
    return new URL(url).toString().replace(/\/$/, "");
}
function protocolVersionOf(metadata) {
    return metadata.protocol_version ?? metadata.api_version;
}
function assertMetadataMatchesChain(cfg, record, metadata, requestedUrl) {
    if (metadata.issuer_stellar_address !== record.issuer) {
        throw new IssuerMetadataMismatchError("Issuer well-known address does not match on-chain issuer");
    }
    if (cfg.complianceId && metadata.compliance_contract_id && metadata.compliance_contract_id !== cfg.complianceId) {
        throw new IssuerMetadataMismatchError("Issuer well-known compliance contract does not match configured compliance contract");
    }
    if (cfg.verifierId && metadata.verifier_contract_id && metadata.verifier_contract_id !== cfg.verifierId) {
        throw new IssuerMetadataMismatchError("Issuer well-known verifier contract does not match configured verifier contract");
    }
    if (protocolVersionOf(metadata) !== "2") {
        throw new IssuerMetadataMismatchError("Issuer well-known protocol version is not Wisp v2");
    }
    const canonicalMetadataUri = normalizeUrl(record.metadata_uri);
    const declaredMetadataUri = normalizeUrl(metadata.metadata_uri ?? canonicalMetadataUri);
    if (declaredMetadataUri !== canonicalMetadataUri) {
        throw new IssuerMetadataMismatchError("Issuer well-known metadata_uri does not match the on-chain metadata URI");
    }
    if (requestedUrl && normalizeUrl(requestedUrl) !== canonicalMetadataUri) {
        throw new IssuerMetadataMismatchError("Requested URL does not canonicalize back to the on-chain metadata URI");
    }
    const serviceUrl = normalizeUrl(metadata.service_url ?? new URL(".", canonicalMetadataUri).toString());
    return {
        issuerPublicKey: record.issuer,
        metadataUri: canonicalMetadataUri,
        serviceUrl,
        complianceId: metadata.compliance_contract_id,
        verifierId: metadata.verifier_contract_id,
        vkHash: metadata.circuit_vk_hash,
        protocolVersion: protocolVersionOf(metadata),
        updatedAtLedger: record.updated_at_ledger,
        enabled: record.enabled,
        wellKnown: metadata,
    };
}
export async function resolveIssuer(cfg, issuerPublicKey, opts = {}) {
    const record = opts.registryEntry ??
        (await getLatestIssuerRecord(cfg, issuerPublicKey, { startLedger: opts.startLedger }));
    if (!record) {
        throw new IssuerNotRegisteredError(issuerPublicKey);
    }
    const fetchImpl = opts.fetchImpl ?? fetch;
    const response = await fetchImpl(record.metadata_uri);
    if (!response.ok) {
        throw new Error(`issuer metadata fetch failed: HTTP ${response.status}`);
    }
    const metadata = (await response.json());
    return assertMetadataMatchesChain(cfg, record, metadata);
}
export async function resolveIssuerFromUrl(cfg, url, opts = {}) {
    const fetchImpl = opts.fetchImpl ?? fetch;
    const response = await fetchImpl(url);
    if (!response.ok) {
        throw new Error(`issuer metadata fetch failed: HTTP ${response.status}`);
    }
    const metadata = (await response.json());
    const issuerPublicKey = metadata.issuer_stellar_address;
    if (!issuerPublicKey) {
        throw new IssuerMetadataMismatchError("Issuer well-known is missing issuer_stellar_address");
    }
    const record = opts.registryEntry ??
        (await getLatestIssuerRecord(cfg, issuerPublicKey, { startLedger: opts.startLedger }));
    if (!record) {
        throw new IssuerNotRegisteredError(issuerPublicKey);
    }
    return assertMetadataMatchesChain(cfg, record, metadata, url);
}
export async function listIssuers(cfg, opts = {}) {
    return listIssuerRegistryEntries(cfg, opts);
}
//# sourceMappingURL=resolve.js.map