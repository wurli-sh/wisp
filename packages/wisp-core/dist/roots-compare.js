import { normalizeField } from "@wisp_/js";
function rootEq(a, b) {
    return normalizeField(a).toString() === normalizeField(b).toString();
}
export function rootsMatch(a, b) {
    return (rootEq(a.merkle_root, b.merkle_root) &&
        rootEq(a.sanctions_root, b.sanctions_root) &&
        rootEq(a.jurisdiction_root, b.jurisdiction_root) &&
        rootEq(a.corridor_config_hash, b.corridor_config_hash) &&
        rootEq(a.source_jurisdiction_root, b.source_jurisdiction_root) &&
        rootEq(a.dest_address_root, b.dest_address_root));
}
export function issuerRootsMatch(pkg, chain) {
    return (rootEq(pkg.merkle_root, chain.merkle_root) &&
        rootEq(pkg.sanctions_root, chain.sanctions_root) &&
        rootEq(pkg.jurisdiction_root, chain.jurisdiction_root));
}
export function corridorRootsMatch(pkg, chain) {
    return (rootEq(pkg.corridor_config_hash, chain.corridor_config_hash) &&
        rootEq(pkg.source_jurisdiction_root, chain.source_jurisdiction_root) &&
        rootEq(pkg.dest_address_root, chain.dest_address_root));
}
export function publicInputsRecordMatch(pkg, expected) {
    for (const [key, value] of Object.entries(expected)) {
        if (normalizeField(String(pkg[key] ?? "0")).toString() !== normalizeField(value).toString()) {
            return false;
        }
    }
    return true;
}
//# sourceMappingURL=roots-compare.js.map