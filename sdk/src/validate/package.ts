import {
  PUBLIC_INPUT_FIELDS,
  normalizeField,
  publicInputsVectorToRecord,
  publicSignalsMatch,
  rebuildExpectedPublicInputsFromRoots,
  type ProofPackage,
} from "@amoeba/js";
import { rpc } from "@stellar/stellar-sdk";
import type { AmoebaConfig } from "../config.js";
import {
  getLatestChainRoots,
  getLatestCorridorRoots,
  getLatestIssuerRecord,
  getLatestIssuerRoots,
  type ChainRootsBundle,
} from "../audit/roots.js";
import { getVerifierVkHash, vkHashesMatch } from "../audit/verifier.js";
import { issuerRootsMatch, corridorRootsMatch } from "./roots-compare.js";
import { validatePackageStructure, validatePackageStrict } from "./structure.js";
import type { ResolvedIssuer } from "../issuer/resolve.js";
import {
  CorridorDisabledForIssuerError,
  CorridorMissingForIssuerError,
  IssuerNotRegisteredError,
  IssuerRootsMissingError,
} from "../errors.js";

export const MAX_ROOT_AGE_LEDGERS = 172_800;

export interface ValidatePackageOptions {
  issuerPublicKey?: string;
  corridorId: number;
  resolvedIssuer?: ResolvedIssuer;
  /** Skip on-chain root checks (unit tests). */
  skipChain?: boolean;
  /** Run JSON Schema validation (Node only). */
  strict?: boolean;
  startLedger?: number;
  /** Inject chain roots (unit tests) — skips RPC event pagination. */
  chainRoots?: ChainRootsBundle;
  /** Well-known circuit_vk_hash; checked against verifier contract when set. */
  wellKnownVkHash?: string;
  /** Set false to skip optional vk_hash cross-check. Default: true when hash + verifierId present. */
  checkVkHash?: boolean;
}

export interface ValidatePackageResult {
  ok: true;
  chainRoots?: ChainRootsBundle;
}

function resolveStartLedger(cfg: AmoebaConfig, opts: ValidatePackageOptions): number | undefined {
  return opts.startLedger ?? cfg.validateStartLedger;
}

async function assertRootAge(
  chain: ChainRootsBundle,
  cfg: AmoebaConfig,
): Promise<void> {
  const server = new rpc.Server(cfg.rpcUrl);
  const latest = await server.getLatestLedger();
  const issuerAge = latest.sequence - chain.issuer.ledger;
  if (issuerAge > MAX_ROOT_AGE_LEDGERS) {
    throw new Error(
      `Issuer roots stale (${issuerAge} ledgers > ${MAX_ROOT_AGE_LEDGERS}) — republish roots`,
    );
  }
  const corridorAge = latest.sequence - chain.corridor.ledger;
  if (corridorAge > MAX_ROOT_AGE_LEDGERS) {
    throw new Error(
      `Corridor roots stale (${corridorAge} ledgers > ${MAX_ROOT_AGE_LEDGERS}) — republish roots`,
    );
  }
}

export async function validatePackage(
  pkg: ProofPackage,
  cfg: AmoebaConfig,
  opts: ValidatePackageOptions,
): Promise<ValidatePackageResult> {
  const issuerPublicKey = opts.resolvedIssuer?.issuerPublicKey ?? opts.issuerPublicKey;
  if (!issuerPublicKey) {
    throw new IssuerNotRegisteredError("<unknown>");
  }
  validatePackageStructure(pkg);

  if (opts.strict) {
    await validatePackageStrict(pkg);
  }

  if (!pkg.roots || !pkg.transfer || !pkg.public_inputs) {
    throw new Error("ProofPackage incomplete after structure check");
  }

  const nullifier = String(pkg.public_inputs.nullifier ?? "");
  if (!nullifier) {
    throw new Error("ProofPackage public_inputs.nullifier required for validation");
  }

  const rebuilt = rebuildExpectedPublicInputsFromRoots(
    pkg.roots as {
      merkle_root: string;
      sanctions_root: string;
      jurisdiction_root: string;
      corridor_config_hash: string;
      source_jurisdiction_root: string;
      dest_address_root: string;
    },
    {
      asset: String(pkg.transfer.asset ?? ""),
      sender: String(pkg.transfer.sender ?? ""),
      recipient: String(pkg.transfer.recipient ?? ""),
      amount: String(pkg.transfer.amount ?? ""),
      corridor_id: Number(pkg.transfer.corridor_id ?? opts.corridorId),
      epoch: pkg.transfer.epoch ?? 0,
    },
    nullifier,
  );

  const fromPackage = PUBLIC_INPUT_FIELDS.map((name) =>
    normalizeField(String(pkg.public_inputs![name] ?? "0")).toString(),
  ).map((d) => BigInt(d));

  if (!publicSignalsMatch(fromPackage, rebuilt)) {
    throw new Error(
      "ProofPackage public_inputs do not match roots + transfer (PublicInputMismatch)",
    );
  }

  if (opts.skipChain) {
    return { ok: true };
  }

  if (!cfg.complianceId) {
    throw new Error("COMPLIANCE_CONTRACT_ID required for chain validation");
  }

  const startLedger = resolveStartLedger(cfg, opts);
  let chain =
    opts.chainRoots ??
    (await getLatestChainRoots(cfg, issuerPublicKey, opts.corridorId, {
      startLedger,
    }));

  if (!chain) {
    const record = await getLatestIssuerRecord(cfg, issuerPublicKey, { startLedger });
    if (!record) {
      throw new Error(
        `On-chain issuer/corridor roots not found — issuer may be unregistered or events unavailable (set VALIDATE_START_LEDGER / COMPLIANCE_DEPLOY_LEDGER or pass startLedger)`,
      );
    }
    const issuerRoots = await getLatestIssuerRoots(cfg, issuerPublicKey, { startLedger });
    if (!issuerRoots) throw new IssuerRootsMissingError(issuerPublicKey);
    const corridor = await getLatestCorridorRoots(cfg, issuerPublicKey, opts.corridorId, {
      startLedger,
    });
    if (!corridor) throw new CorridorMissingForIssuerError(issuerPublicKey, opts.corridorId);
    chain = { issuer: issuerRoots, corridor };
  }

  if (!issuerRootsMatch(pkg.roots as never, chain.issuer)) {
    throw new Error(
      "Package issuer roots stale vs chain — republish roots and refetch proof package",
    );
  }

  if (!corridorRootsMatch(pkg.roots as never, chain.corridor)) {
    throw new Error(
      "Package corridor roots stale vs chain — republish roots and refetch proof package",
    );
  }

  if (!chain.corridor.enabled) {
    throw new CorridorDisabledForIssuerError(issuerPublicKey, opts.corridorId);
  }

  if (chain.issuer.enabled === false) {
    throw new Error(`Issuer ${issuerPublicKey} is disabled on-chain`);
  }

  if (!opts.chainRoots) {
    if (!chain.issuer.merkle_root) {
      throw new IssuerRootsMissingError(issuerPublicKey);
    }
    await assertRootAge(chain, cfg);
  }

  const vkHash = opts.resolvedIssuer?.vkHash?.trim() ?? opts.wellKnownVkHash?.trim();
  if (
    opts.checkVkHash !== false &&
    vkHash &&
    (opts.resolvedIssuer?.verifierId ?? cfg.verifierId)
  ) {
    const onChainVk = await getVerifierVkHash(cfg);
    if (!vkHashesMatch(vkHash, onChainVk)) {
      throw new Error(
        "Issuer well-known circuit_vk_hash does not match on-chain verifier vk_hash",
      );
    }
  }

  return { ok: true, chainRoots: chain };
}

export { publicInputsVectorToRecord, rebuildExpectedPublicInputsFromRoots };
