import { PUBLIC_INPUT_FIELDS, normalizeField, publicSignalsMatch, rebuildExpectedPublicInputsFromRoots, } from "@wisp_/js";
import { validatePackageStructure } from "./structure.js";
export const validationPolicies = {
    strictProduction() {
        return { strict: true, skipChain: false, checkVkHash: true };
    },
    fastTrustedIssuer() {
        return { strict: false, skipChain: false, checkVkHash: false };
    },
    offlineOnly() {
        return { strict: false, skipChain: true, checkVkHash: false };
    },
    testMode() {
        return { strict: false, skipChain: true, checkVkHash: false };
    },
};
export function rebuildProofPackagePublicInputs(pkg, corridorId) {
    validatePackageStructure(pkg);
    if (!pkg.roots || !pkg.transfer || !pkg.public_inputs) {
        throw new Error("ProofPackage incomplete after structure check");
    }
    const nullifier = String(pkg.public_inputs.nullifier ?? "");
    if (!nullifier) {
        throw new Error("ProofPackage public_inputs.nullifier required for validation");
    }
    const rebuilt = rebuildExpectedPublicInputsFromRoots(pkg.roots, {
        asset: String(pkg.transfer.asset ?? ""),
        sender: String(pkg.transfer.sender ?? ""),
        recipient: String(pkg.transfer.recipient ?? ""),
        amount: String(pkg.transfer.amount ?? ""),
        corridor_id: Number(pkg.transfer.corridor_id ?? corridorId),
        epoch: pkg.transfer.epoch ?? 0,
    }, nullifier);
    const out = {};
    PUBLIC_INPUT_FIELDS.forEach((name, index) => {
        out[name] = rebuilt[index].toString();
    });
    return out;
}
export function assertProofPackagePublicInputsMatch(pkg, opts) {
    const expected = rebuildProofPackagePublicInputs(pkg, opts.corridorId);
    const fromPackage = PUBLIC_INPUT_FIELDS.map((name) => normalizeField(String(pkg.public_inputs?.[name] ?? "0")).toString()).map((d) => BigInt(d));
    const rebuilt = PUBLIC_INPUT_FIELDS.map((name) => BigInt(expected[name]));
    if (!publicSignalsMatch(fromPackage, rebuilt)) {
        throw new Error("ProofPackage public_inputs do not match roots + transfer (PublicInputMismatch)");
    }
    return expected;
}
export function validateProofPackage(pkg, opts) {
    const publicInputs = assertProofPackagePublicInputsMatch(pkg, opts);
    return { ok: true, publicInputs };
}
//# sourceMappingURL=validation.js.map