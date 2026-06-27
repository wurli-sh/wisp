import { type ActivateCredentialRequest, type ActivateCredentialResponse, type ActivationChallengeRequest, type ChallengeResponse, type CredentialInfo, type DemoTransferRequest, type ProofPackage, type ProofPackageDraft, type ProofPackageRequest, type SignedProofPackageRequest } from "@wisp_/js";
export type TransferStage = "fetch" | "validate" | "prove" | "duplicate-check" | "approve" | "simulate" | "settle";
export interface WalletSigner {
    publicKey: string;
    signTransaction: (xdr: string) => Promise<{
        signedTxXdr: string;
    }>;
    signMessage?: (message: string) => Promise<{
        signedMessage: Uint8Array;
    }>;
}
export interface ProvenTransfer {
    nullifier: string;
}
export interface TransferClientLike {
    validatePackage(pkg: ProofPackage, opts: {
        issuerPublicKey: string;
        corridorId: number;
    }): Promise<unknown>;
    prove(input: {
        package: ProofPackage;
        browser?: boolean;
        wasmUrl?: string;
        zkeyUrl?: string;
        credentialSecret: bigint;
    }): Promise<ProvenTransfer>;
    audit(nullifierDecimal: string, publicKey: string): Promise<{
        attested: boolean;
    }>;
    approveSacForCompliance(pkg: ProofPackage, wallet: WalletSigner): Promise<unknown>;
    simulateSettle(proven: ProvenTransfer, pkg: ProofPackage, publicKey: string): Promise<unknown>;
    settleWithWallet(proven: ProvenTransfer, pkg: ProofPackage, wallet: WalletSigner): Promise<unknown>;
}
export interface ProofPackageSource {
    getCredential(wallet: string): Promise<CredentialInfo>;
    createActivationChallenge(req: ActivationChallengeRequest): Promise<ChallengeResponse>;
    activateCredential(req: ActivateCredentialRequest): Promise<ActivateCredentialResponse>;
    createProofPackageChallenge(req: ProofPackageRequest): Promise<ChallengeResponse>;
    createProofPackage(req: SignedProofPackageRequest): Promise<ProofPackageDraft>;
}
export interface BrowserProofOptions {
    browser: true;
    wasmUrl: string;
    zkeyUrl: string;
}
export interface TransferValidationOptions {
    issuerPublicKey: string;
    corridorId: number;
    networkPassphrase: string;
}
export interface CreateAndSettleTransferInput {
    client: TransferClientLike;
    issuer: ProofPackageSource;
    request: DemoTransferRequest;
    validation: TransferValidationOptions;
    walletSigner: WalletSigner;
    senderAddress: string;
    proof?: Partial<BrowserProofOptions>;
    onStage?: (stage: TransferStage, payload: Record<string, unknown>) => void;
    skipDuplicateCheck?: boolean;
}
export interface CreateAndSettleTransferResult {
    package: ProofPackage;
    validation: unknown;
    proven: ProvenTransfer;
    approval: unknown;
    simulation: unknown;
    settlement: unknown;
    nullifier: string;
}
export declare class DuplicateNullifierError extends Error {
    constructor();
}
export declare function validateTransferPackage(client: TransferClientLike, pkg: ProofPackage, validation: TransferValidationOptions): Promise<unknown>;
export declare function fetchTransferPackage(input: {
    client: TransferClientLike;
    issuer: ProofPackageSource;
    request: DemoTransferRequest;
    validation: TransferValidationOptions;
    walletSigner: WalletSigner;
}): Promise<{
    package: ProofPackage;
    validation: unknown;
}>;
export declare function proveTransferPackage(client: TransferClientLike, pkg: ProofPackage, credentialSecret: bigint, opts?: Partial<BrowserProofOptions>): Promise<ProvenTransfer>;
export declare function createAndSettleTransfer(input: CreateAndSettleTransferInput): Promise<CreateAndSettleTransferResult>;
export declare function createAndSettleTransferWithRetry(input: CreateAndSettleTransferInput): Promise<CreateAndSettleTransferResult>;
//# sourceMappingURL=index.d.ts.map