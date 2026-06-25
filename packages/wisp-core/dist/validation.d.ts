import { type ProofPackage } from "@wisp_/js";
export interface PureValidatePackageOptions {
    corridorId: number;
}
export interface PureValidatePackageResult {
    ok: true;
    publicInputs: Record<string, string>;
}
export interface ValidationPolicy {
    strict: boolean;
    skipChain: boolean;
    checkVkHash: boolean;
}
export declare const validationPolicies: {
    strictProduction(): ValidationPolicy;
    fastTrustedIssuer(): ValidationPolicy;
    offlineOnly(): ValidationPolicy;
    testMode(): ValidationPolicy;
};
export declare function rebuildProofPackagePublicInputs(pkg: ProofPackage, corridorId: number): Record<string, string>;
export declare function assertProofPackagePublicInputsMatch(pkg: ProofPackage, opts: PureValidatePackageOptions): Record<string, string>;
export declare function validateProofPackage(pkg: ProofPackage, opts: PureValidatePackageOptions): PureValidatePackageResult;
//# sourceMappingURL=validation.d.ts.map