export class IssuerNotRegisteredError extends Error {
    constructor(issuerPublicKey) {
        super(`Issuer ${issuerPublicKey} is not registered on-chain`);
        this.name = "IssuerNotRegisteredError";
    }
}
export class IssuerMetadataMismatchError extends Error {
    constructor(message) {
        super(message);
        this.name = "IssuerMetadataMismatchError";
    }
}
export class IssuerRootsMissingError extends Error {
    constructor(issuerPublicKey) {
        super(`Issuer ${issuerPublicKey} is registered but has no issuer roots yet`);
        this.name = "IssuerRootsMissingError";
    }
}
export class CorridorMissingForIssuerError extends Error {
    constructor(issuerPublicKey, corridorId) {
        super(`Issuer ${issuerPublicKey} has no corridor ${corridorId} on-chain`);
        this.name = "CorridorMissingForIssuerError";
    }
}
export class CorridorDisabledForIssuerError extends Error {
    constructor(issuerPublicKey, corridorId) {
        super(`Issuer ${issuerPublicKey} corridor ${corridorId} is disabled on-chain`);
        this.name = "CorridorDisabledForIssuerError";
    }
}
//# sourceMappingURL=errors.js.map