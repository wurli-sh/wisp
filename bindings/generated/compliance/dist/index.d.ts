import { Buffer } from "buffer";
import { AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions, Result } from "@stellar/stellar-sdk/contract";
import type { u32, u64, i128, u256, Option } from "@stellar/stellar-sdk/contract";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
export interface Proof {
    a: Buffer;
    b: Buffer;
    c: Buffer;
}
export interface CompliantTransferArgs {
    amount: i128;
    asset: string;
    corridor_id: u32;
    epoch: u64;
    issuer: string;
    nullifier: Buffer;
    recipient: string;
    sender: string;
}
export declare const ComplianceError: {
    1: {
        message: string;
    };
    2: {
        message: string;
    };
    3: {
        message: string;
    };
    4: {
        message: string;
    };
    5: {
        message: string;
    };
    6: {
        message: string;
    };
    7: {
        message: string;
    };
    8: {
        message: string;
    };
    9: {
        message: string;
    };
    10: {
        message: string;
    };
    11: {
        message: string;
    };
    12: {
        message: string;
    };
    13: {
        message: string;
    };
    14: {
        message: string;
    };
    15: {
        message: string;
    };
    16: {
        message: string;
    };
    17: {
        message: string;
    };
    18: {
        message: string;
    };
    19: {
        message: string;
    };
    20: {
        message: string;
    };
    21: {
        message: string;
    };
    22: {
        message: string;
    };
};
export interface ProofSettledData {
    amount: i128;
    asset: string;
    corridor_config_hash: Buffer;
    corridor_id: u32;
    dest_address_root: Buffer;
    epoch: u64;
    issuer: string;
    jurisdiction_root: Buffer;
    merkle_root: Buffer;
    nullifier: Buffer;
    recipient: string;
    sanctions_root: Buffer;
    sender: string;
    source_jurisdiction_root: Buffer;
    verifier: string;
    vk_hash: Buffer;
}
export interface Config {
    admin: string;
    expected_vk_hash: Buffer;
    next_issuer_seq: u32;
    paused: boolean;
    pending_admin: Option<string>;
    registration_fee: i128;
    registration_token: string;
    treasury: string;
    verifier: string;
}
export type DataKey = {
    tag: "Config";
    values: void;
} | {
    tag: "Issuer";
    values: readonly [string];
} | {
    tag: "IssuerRoots";
    values: readonly [string];
} | {
    tag: "Corridor";
    values: readonly [string, u32];
} | {
    tag: "IssuerIndex";
    values: readonly [u32];
} | {
    tag: "Nullifier";
    values: readonly [Buffer];
};
export interface IssuerPage {
    issuers: Array<IssuerRecord>;
    next_cursor: Option<u32>;
}
export interface IssuerRoots {
    jurisdiction_root: Buffer;
    merkle_root: Buffer;
    sanctions_root: Buffer;
    updated_ledger: u32;
}
export interface IssuerRecord {
    enabled: boolean;
    issuer: string;
    metadata_uri: string;
    registered_at_ledger: u32;
    registration_seq: u32;
    updated_at_ledger: u32;
}
export interface CorridorConfig {
    corridor_config_hash: Buffer;
    corridor_id: u32;
    dest_address_root: Buffer;
    enabled: boolean;
    issuer: string;
    source_jurisdiction_root: Buffer;
    updated_ledger: u32;
}
export interface Client {
    /**
     * Construct and simulate a get_issuer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    get_issuer: ({ issuer }: {
        issuer: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Option<IssuerRecord>>>;
    /**
     * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    initialize: ({ admin, treasury, registration_token, registration_fee, verifier, expected_vk_hash }: {
        admin: string;
        treasury: string;
        registration_token: string;
        registration_fee: i128;
        verifier: string;
        expected_vk_hash: Buffer;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a set_paused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    set_paused: ({ paused }: {
        paused: boolean;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a accept_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    accept_admin: (options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a get_corridor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    get_corridor: ({ issuer, corridor_id }: {
        issuer: string;
        corridor_id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Option<CorridorConfig>>>;
    /**
     * Construct and simulate a list_issuers transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    list_issuers: ({ cursor, limit }: {
        cursor: Option<u32>;
        limit: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<IssuerPage>>>;
    /**
     * Construct and simulate a set_verifier transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    set_verifier: ({ verifier, expected_vk_hash }: {
        verifier: string;
        expected_vk_hash: Buffer;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a propose_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    propose_admin: ({ new_admin }: {
        new_admin: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a register_issuer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    register_issuer: ({ issuer, metadata_uri }: {
        issuer: string;
        metadata_uri: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a update_corridor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    update_corridor: ({ issuer, corridor_id, source_jurisdiction_root, dest_address_root, corridor_config_hash, enabled }: {
        issuer: string;
        corridor_id: u32;
        source_jurisdiction_root: Buffer;
        dest_address_root: Buffer;
        corridor_config_hash: Buffer;
        enabled: boolean;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a get_issuer_roots transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    get_issuer_roots: ({ issuer }: {
        issuer: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Option<IssuerRoots>>>;
    /**
     * Construct and simulate a check_attestation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    check_attestation: ({ nullifier }: {
        nullifier: Buffer;
    }, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>;
    /**
     * Construct and simulate a register_corridor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    register_corridor: ({ issuer, corridor_id, source_jurisdiction_root, dest_address_root, corridor_config_hash }: {
        issuer: string;
        corridor_id: u32;
        source_jurisdiction_root: Buffer;
        dest_address_root: Buffer;
        corridor_config_hash: Buffer;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a compliant_transfer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    compliant_transfer: ({ args, proof, public_inputs }: {
        args: CompliantTransferArgs;
        proof: Proof;
        public_inputs: Array<u256>;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a set_issuer_enabled transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    set_issuer_enabled: ({ issuer, enabled }: {
        issuer: string;
        enabled: boolean;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a update_issuer_root transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    update_issuer_root: ({ issuer, merkle_root, sanctions_root, jurisdiction_root }: {
        issuer: string;
        merkle_root: Buffer;
        sanctions_root: Buffer;
        jurisdiction_root: Buffer;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a update_issuer_metadata transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    update_issuer_metadata: ({ issuer, metadata_uri }: {
        issuer: string;
        metadata_uri: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
}
export declare class Client extends ContractClient {
    readonly options: ContractClientOptions;
    static deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions & Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
    }): Promise<AssembledTransaction<T>>;
    constructor(options: ContractClientOptions);
    readonly fromJSON: {
        get_issuer: (json: string) => AssembledTransaction<Option<IssuerRecord>>;
        initialize: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        set_paused: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        accept_admin: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        get_corridor: (json: string) => AssembledTransaction<Option<CorridorConfig>>;
        list_issuers: (json: string) => AssembledTransaction<Result<IssuerPage, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        set_verifier: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        propose_admin: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        register_issuer: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        update_corridor: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        get_issuer_roots: (json: string) => AssembledTransaction<Option<IssuerRoots>>;
        check_attestation: (json: string) => AssembledTransaction<boolean>;
        register_corridor: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        compliant_transfer: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        set_issuer_enabled: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        update_issuer_root: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        update_issuer_metadata: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
    };
}
