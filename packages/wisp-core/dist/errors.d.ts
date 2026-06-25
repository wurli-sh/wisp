export declare class IssuerNotRegisteredError extends Error {
    constructor(issuerPublicKey: string);
}
export declare class IssuerMetadataMismatchError extends Error {
    constructor(message: string);
}
export declare class IssuerRootsMissingError extends Error {
    constructor(issuerPublicKey: string);
}
export declare class CorridorMissingForIssuerError extends Error {
    constructor(issuerPublicKey: string, corridorId: number);
}
export declare class CorridorDisabledForIssuerError extends Error {
    constructor(issuerPublicKey: string, corridorId: number);
}
//# sourceMappingURL=errors.d.ts.map