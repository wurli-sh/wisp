/**
 * Off-chain root computation for issuers who bring their own KYC stack.
 *
 * `@wisp_/issuer-sdk` publishes roots on-chain but does not, by itself, turn a
 * KYC dataset into those roots — historically that aggregation only existed in
 * the reference Rust `issuer-service`. This module ports that logic to pure TS
 * (using only `@wisp_/js` primitives) so a TS-only issuer can derive the six
 * roots `publishRoots`/`registerCorridor` expect, byte-for-byte compatible with
 * the contract and circuit.
 *
 * The output of {@link computeIssuerRoots} feeds straight into
 * `WispIssuerClient.publishRoots`:
 *
 * ```ts
 * const roots = computeIssuerRoots({ members, destinations, corridor });
 * await issuer.publishRoots({ corridorId, metadataUri, ...roots }, signer);
 * ```
 *
 * Layout (must match `backend/crates/issuer-service` + the BN254 circuit):
 * - depth-20 Poseidon2 (t=4) Merkle trees, padded with canonical zero hashes
 * - membership leaves = credential commitments, ordered by wallet hex ascending
 * - jurisdiction leaves = `poseidon2(code)`, deduped + ascending numeric order
 * - destination leaves = `poseidon2(addrLo, addrHi)`, deduped + ascending hex
 * - corridor config hash = domain-separated Poseidon2 over corridor fields
 */
import {
  MERKLE_DEPTH,
  addressToLimbs,
  computeCorridorConfigHash,
  computeZeroHashes,
  hash2,
  mod,
  normalizeField,
  payloadToHex,
  poseidon2Hash1,
  poseidon2Hash2,
  strKeyToPayload,
  toString as fieldToDecimal,
  type FieldElement,
} from "@wisp_/js";

/**
 * Canonical, non-negative field decimal. `@wisp_/js`'s field `toString` returns
 * a balanced (signed) representation; on-chain publishing and
 * `normalizeRootHashToBytes` require the canonical non-negative form the Rust
 * issuer-service emits, so we re-reduce into `[0, p)`.
 */
function canonicalDecimal(value: FieldElement): string {
  return normalizeField(fieldToDecimal(value)).toString();
}

/** A single activated, enabled credential in the issuer's KYC set. */
export interface IssuerRootMember {
  /** KYC'd wallet — a `G…`/`C…` StrKey or a 64-char hex ed25519 public key. */
  wallet: string;
  /** Field-decimal credential commitment captured during activation. */
  credentialCommitment: string;
  /** Numeric jurisdiction code (e.g. 840 = US). See {@link defaultJurisdictionCode}. */
  jurisdictionCode: number;
}

export interface CorridorRootConfig {
  /** Numeric corridor id (matches the on-chain corridor). */
  id: number;
  /** ISO-ish source country used to derive the source jurisdiction code. */
  sourceCountry: string;
  /** Whether the corridor is enabled (default `true`). */
  enabled?: boolean;
  /** Travel-rule threshold; non-numeric values are treated as `0`. */
  travelRuleThreshold?: number | string | bigint;
}

export interface ComputeIssuerRootsInput {
  /** Activated, enabled members. One entry per unique wallet. */
  members: IssuerRootMember[];
  /** Enabled corridor destination addresses (`G…`/`C…` StrKey or 64-char hex). */
  destinations: string[];
  corridor: CorridorRootConfig;
}

/** The six canonical field-decimal roots a corridor publish requires. */
export interface IssuerRoots {
  merkleRoot: string;
  sanctionsRoot: string;
  jurisdictionRoot: string;
  sourceJurisdictionRoot: string;
  destAddressRoot: string;
  corridorConfigHash: string;
}

/**
 * Country → numeric jurisdiction code. Mirrors the reference issuer-service.
 * Unknown countries map to `0`. Override by passing explicit member codes.
 */
export function defaultJurisdictionCode(country: string): number {
  switch (country.trim().toUpperCase()) {
    case "US":
      return 840;
    case "IN":
      return 356;
    case "SG":
      return 702;
    case "GB":
      return 826;
    default:
      return 0;
  }
}

function toBytes32(address: string): Buffer {
  const trimmed = address.trim();
  const hex = trimmed.startsWith("0x") || trimmed.startsWith("0X") ? trimmed.slice(2) : trimmed;
  if (/^[0-9a-fA-F]{64}$/.test(hex)) {
    return Buffer.from(hex, "hex");
  }
  return strKeyToPayload(trimmed);
}

function walletHex(address: string): string {
  return payloadToHex(toBytes32(address));
}

function toThreshold(value: number | string | bigint | undefined): bigint {
  if (value == null) return 0n;
  try {
    return BigInt(typeof value === "string" ? value.trim() || "0" : value);
  } catch {
    return 0n;
  }
}

/**
 * Dense, fixed-depth Merkle root over `leaves`, padding each odd level with the
 * canonical zero hash for that depth. Empty input collapses to a single zero
 * leaf, matching `build_merkle_tree` in the reference issuer-service.
 */
function denseMerkleRoot(leaves: FieldElement[]): FieldElement {
  const zeros = computeZeroHashes(MERKLE_DEPTH);
  let level = leaves.length === 0 ? [zeros[0]] : leaves.slice();
  for (let depth = 0; depth < MERKLE_DEPTH; depth += 1) {
    if (level.length % 2 === 1) {
      level.push(zeros[depth]);
    }
    const next: FieldElement[] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(hash2(level[i], level[i + 1]));
    }
    level = next;
  }
  return level[0];
}

/**
 * Compute the six issuer/corridor roots from a KYC dataset, with no Rust
 * issuer-service required.
 *
 * Note on sanctions: the sanctions root is the canonical empty sparse-Merkle
 * root, identical to the reference issuer-service, which proves a sender is
 * absent from an *empty* sanctions tree. Populating a real sanctions tree with
 * known-bad entries requires SMT insertion logic that is intentionally out of
 * scope here — wire your screening provider into that tree before production.
 */
export function computeIssuerRoots(input: ComputeIssuerRootsInput): IssuerRoots {
  const { members, destinations, corridor } = input;

  // Membership tree — credential-commitment leaves ordered by wallet hex.
  const membership = members
    .map((member) => ({
      key: walletHex(member.wallet),
      leaf: mod(BigInt(member.credentialCommitment)),
    }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const merkleRoot = denseMerkleRoot(membership.map((m) => m.leaf));

  // Jurisdiction tree — unique codes, ascending numeric order.
  const codes = [...new Set(members.map((m) => m.jurisdictionCode))].sort((a, b) => a - b);
  const jurisdictionRoot = denseMerkleRoot(codes.map((code) => poseidon2Hash1(mod(BigInt(code)))));

  // Corridor source jurisdiction — single leaf derived from source country.
  const sourceLeaf = poseidon2Hash1(mod(BigInt(defaultJurisdictionCode(corridor.sourceCountry))));
  const sourceRoot = denseMerkleRoot([sourceLeaf]);

  // Destination registry — unique addresses, ascending hex order.
  const destHex = [...new Set(destinations.map((address) => walletHex(address)))].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const destRoot = denseMerkleRoot(
    destHex.map((hex) => {
      const limbs = addressToLimbs(Buffer.from(hex, "hex"));
      return poseidon2Hash2(limbs.lo, limbs.hi);
    }),
  );

  const sanctionsRoot = computeZeroHashes(MERKLE_DEPTH)[MERKLE_DEPTH];

  const corridorConfigHash = computeCorridorConfigHash({
    corridorId: BigInt(corridor.id),
    sourceJurisdictionRoot: sourceRoot,
    destAddressRoot: destRoot,
    enabled: (corridor.enabled ?? true) ? 1n : 0n,
    travelRuleThreshold: toThreshold(corridor.travelRuleThreshold),
  });

  return {
    merkleRoot: canonicalDecimal(merkleRoot),
    sanctionsRoot: canonicalDecimal(sanctionsRoot),
    jurisdictionRoot: canonicalDecimal(jurisdictionRoot),
    sourceJurisdictionRoot: canonicalDecimal(sourceRoot),
    destAddressRoot: canonicalDecimal(destRoot),
    corridorConfigHash: canonicalDecimal(corridorConfigHash),
  };
}
