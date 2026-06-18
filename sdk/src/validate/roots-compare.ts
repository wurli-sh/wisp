import { normalizeField } from "@amoeba_/js";

export interface RootsRecord {
  merkle_root: string;
  sanctions_root: string;
  jurisdiction_root: string;
  corridor_config_hash: string;
  source_jurisdiction_root: string;
  dest_address_root: string;
}

function rootEq(a: string, b: string): boolean {
  return normalizeField(a).toString() === normalizeField(b).toString();
}

export function rootsMatch(a: RootsRecord, b: RootsRecord): boolean {
  return (
    rootEq(a.merkle_root, b.merkle_root) &&
    rootEq(a.sanctions_root, b.sanctions_root) &&
    rootEq(a.jurisdiction_root, b.jurisdiction_root) &&
    rootEq(a.corridor_config_hash, b.corridor_config_hash) &&
    rootEq(a.source_jurisdiction_root, b.source_jurisdiction_root) &&
    rootEq(a.dest_address_root, b.dest_address_root)
  );
}

export function issuerRootsMatch(
  pkg: RootsRecord,
  chain: Pick<RootsRecord, "merkle_root" | "sanctions_root" | "jurisdiction_root">,
): boolean {
  return (
    rootEq(pkg.merkle_root, chain.merkle_root) &&
    rootEq(pkg.sanctions_root, chain.sanctions_root) &&
    rootEq(pkg.jurisdiction_root, chain.jurisdiction_root)
  );
}

export function corridorRootsMatch(
  pkg: RootsRecord,
  chain: Pick<
    RootsRecord,
    "corridor_config_hash" | "source_jurisdiction_root" | "dest_address_root"
  >,
): boolean {
  return (
    rootEq(pkg.corridor_config_hash, chain.corridor_config_hash) &&
    rootEq(pkg.source_jurisdiction_root, chain.source_jurisdiction_root) &&
    rootEq(pkg.dest_address_root, chain.dest_address_root)
  );
}

export function publicInputsRecordMatch(
  pkg: Record<string, string | number | undefined>,
  expected: Record<string, string>,
): boolean {
  for (const [key, value] of Object.entries(expected)) {
    if (normalizeField(String(pkg[key] ?? "0")).toString() !== normalizeField(value).toString()) {
      return false;
    }
  }
  return true;
}
