export class DuplicateNullifierError extends Error {
    constructor() {
        super("DUPLICATE_NULLIFIER");
        this.name = "DuplicateNullifierError";
    }
}
function emitStage(onStage, stage, payload = {}) {
    onStage?.(stage, payload);
}
export async function validateTransferPackage(client, pkg, validation) {
    return client.validatePackage(pkg, {
        issuerPublicKey: validation.issuerPublicKey,
        corridorId: Number(pkg.transfer?.corridor_id ?? validation.corridorId),
    });
}
async function createProofPackageFromIssuer(issuer, request) {
    if (issuer.createDemoTransfer) {
        return issuer.createDemoTransfer(request);
    }
    if (issuer.createProofPackage) {
        return issuer.createProofPackage({
            sender_wallet: request.sender_strkey,
            recipient_wallet: request.recipient_strkey,
            amount: request.amount,
            corridor_id: request.corridor_id,
        });
    }
    throw new Error("issuer source does not support proof package creation");
}
export async function fetchTransferPackage(input) {
    const pkg = await createProofPackageFromIssuer(input.issuer, input.request);
    const validation = await validateTransferPackage(input.client, pkg, input.validation);
    return { package: pkg, validation };
}
export async function proveTransferPackage(client, pkg, opts) {
    return client.prove({
        package: pkg,
        browser: opts?.browser,
        wasmUrl: opts?.wasmUrl,
        zkeyUrl: opts?.zkeyUrl,
    });
}
export async function createAndSettleTransfer(input) {
    emitStage(input.onStage, "fetch", { request: input.request });
    const fetched = await fetchTransferPackage({
        client: input.client,
        issuer: input.issuer,
        request: input.request,
        validation: input.validation,
    });
    emitStage(input.onStage, "validate", { corridorId: input.validation.corridorId });
    emitStage(input.onStage, "prove", {});
    const proven = await proveTransferPackage(input.client, fetched.package, input.proof);
    emitStage(input.onStage, "duplicate-check", {});
    if (!input.skipDuplicateCheck) {
        const audit = await input.client.audit(proven.nullifier, input.senderAddress);
        if (audit.attested) {
            throw new DuplicateNullifierError();
        }
    }
    emitStage(input.onStage, "approve", {});
    const approval = await input.client.approveSacForCompliance(fetched.package, input.walletSigner);
    emitStage(input.onStage, "simulate", {});
    const simulation = await input.client.simulateSettle(proven, fetched.package, input.walletSigner.publicKey);
    emitStage(input.onStage, "settle", {});
    const settlement = await input.client.settleWithWallet(proven, fetched.package, input.walletSigner);
    return {
        package: fetched.package,
        validation: fetched.validation,
        proven,
        approval,
        simulation,
        settlement,
        nullifier: proven.nullifier,
    };
}
export async function createAndSettleTransferWithRetry(input) {
    try {
        return await createAndSettleTransfer(input);
    }
    catch (error) {
        if (!(error instanceof DuplicateNullifierError)) {
            throw error;
        }
        return createAndSettleTransfer({ ...input, skipDuplicateCheck: true });
    }
}
//# sourceMappingURL=index.js.map