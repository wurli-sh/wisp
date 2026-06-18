import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}





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

export const ComplianceError = {
  1: {message:"AlreadyInitialized"},
  2: {message:"NotInitialized"},
  3: {message:"Unauthorized"},
  4: {message:"UnknownIssuer"},
  5: {message:"IssuerDisabled"},
  6: {message:"UnknownCorridor"},
  7: {message:"CorridorDisabled"},
  8: {message:"StaleIssuerRoot"},
  9: {message:"DuplicateNullifier"},
  10: {message:"ZeroAmount"},
  11: {message:"MissingIssuerRoots"},
  12: {message:"WrongVkHash"},
  13: {message:"PublicInputMismatch"},
  14: {message:"InvalidProof"},
  15: {message:"InvalidPublicInputLength"},
  16: {message:"FutureEpoch"},
  17: {message:"StaleEpoch"},
  18: {message:"Paused"},
  19: {message:"NoPendingAdmin"},
  20: {message:"AlreadyRegistered"},
  21: {message:"CorridorAlreadyExists"},
  22: {message:"InvalidPageLimit"}
}







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

export type DataKey = {tag: "Config", values: void} | {tag: "Issuer", values: readonly [string]} | {tag: "IssuerRoots", values: readonly [string]} | {tag: "Corridor", values: readonly [string, u32]} | {tag: "IssuerIndex", values: readonly [u32]} | {tag: "Nullifier", values: readonly [Buffer]};


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
  get_issuer: ({issuer}: {issuer: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<IssuerRecord>>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  initialize: ({admin, treasury, registration_token, registration_fee, verifier, expected_vk_hash}: {admin: string, treasury: string, registration_token: string, registration_fee: i128, verifier: string, expected_vk_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_paused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_paused: ({paused}: {paused: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a accept_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  accept_admin: (options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_corridor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_corridor: ({issuer, corridor_id}: {issuer: string, corridor_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<CorridorConfig>>>

  /**
   * Construct and simulate a list_issuers transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  list_issuers: ({cursor, limit}: {cursor: Option<u32>, limit: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<IssuerPage>>>

  /**
   * Construct and simulate a set_verifier transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_verifier: ({verifier, expected_vk_hash}: {verifier: string, expected_vk_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a propose_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  propose_admin: ({new_admin}: {new_admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a register_issuer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  register_issuer: ({issuer, metadata_uri}: {issuer: string, metadata_uri: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a update_corridor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  update_corridor: ({issuer, corridor_id, source_jurisdiction_root, dest_address_root, corridor_config_hash, enabled}: {issuer: string, corridor_id: u32, source_jurisdiction_root: Buffer, dest_address_root: Buffer, corridor_config_hash: Buffer, enabled: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_issuer_roots transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_issuer_roots: ({issuer}: {issuer: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<IssuerRoots>>>

  /**
   * Construct and simulate a check_attestation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  check_attestation: ({nullifier}: {nullifier: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a register_corridor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  register_corridor: ({issuer, corridor_id, source_jurisdiction_root, dest_address_root, corridor_config_hash}: {issuer: string, corridor_id: u32, source_jurisdiction_root: Buffer, dest_address_root: Buffer, corridor_config_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a compliant_transfer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  compliant_transfer: ({args, proof, public_inputs}: {args: CompliantTransferArgs, proof: Proof, public_inputs: Array<u256>}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_issuer_enabled transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_issuer_enabled: ({issuer, enabled}: {issuer: string, enabled: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a update_issuer_root transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  update_issuer_root: ({issuer, merkle_root, sanctions_root, jurisdiction_root}: {issuer: string, merkle_root: Buffer, sanctions_root: Buffer, jurisdiction_root: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a update_issuer_metadata transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  update_issuer_metadata: ({issuer, metadata_uri}: {issuer: string, metadata_uri: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAQAAAAAAAAAAAAAABVByb29mAAAAAAAAAwAAAAAAAAABYQAAAAAAA+4AAABAAAAAAAAAAAFiAAAAAAAD7gAAAIAAAAAAAAAAAWMAAAAAAAPuAAAAQA==",
        "AAAAAAAAAAAAAAAKZ2V0X2lzc3VlcgAAAAAAAQAAAAAAAAAGaXNzdWVyAAAAAAATAAAAAQAAA+gAAAfQAAAADElzc3VlclJlY29yZA==",
        "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAABgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAh0cmVhc3VyeQAAABMAAAAAAAAAEnJlZ2lzdHJhdGlvbl90b2tlbgAAAAAAEwAAAAAAAAAQcmVnaXN0cmF0aW9uX2ZlZQAAAAsAAAAAAAAACHZlcmlmaWVyAAAAEwAAAAAAAAAQZXhwZWN0ZWRfdmtfaGFzaAAAA+4AAAAgAAAAAQAAA+kAAAACAAAH0AAAAA9Db21wbGlhbmNlRXJyb3IA",
        "AAAAAAAAAAAAAAAKc2V0X3BhdXNlZAAAAAAAAQAAAAAAAAAGcGF1c2VkAAAAAAABAAAAAQAAA+kAAAACAAAH0AAAAA9Db21wbGlhbmNlRXJyb3IA",
        "AAAAAAAAAAAAAAAMYWNjZXB0X2FkbWluAAAAAAAAAAEAAAPpAAAAAgAAB9AAAAAPQ29tcGxpYW5jZUVycm9yAA==",
        "AAAAAAAAAAAAAAAMZ2V0X2NvcnJpZG9yAAAAAgAAAAAAAAAGaXNzdWVyAAAAAAATAAAAAAAAAAtjb3JyaWRvcl9pZAAAAAAEAAAAAQAAA+gAAAfQAAAADkNvcnJpZG9yQ29uZmlnAAA=",
        "AAAAAAAAAAAAAAAMbGlzdF9pc3N1ZXJzAAAAAgAAAAAAAAAGY3Vyc29yAAAAAAPoAAAABAAAAAAAAAAFbGltaXQAAAAAAAAEAAAAAQAAA+kAAAfQAAAACklzc3VlclBhZ2UAAAAAB9AAAAAPQ29tcGxpYW5jZUVycm9yAA==",
        "AAAAAAAAAAAAAAAMc2V0X3ZlcmlmaWVyAAAAAgAAAAAAAAAIdmVyaWZpZXIAAAATAAAAAAAAABBleHBlY3RlZF92a19oYXNoAAAD7gAAACAAAAABAAAD6QAAAAIAAAfQAAAAD0NvbXBsaWFuY2VFcnJvcgA=",
        "AAAAAAAAAAAAAAANcHJvcG9zZV9hZG1pbgAAAAAAAAEAAAAAAAAACW5ld19hZG1pbgAAAAAAABMAAAABAAAD6QAAAAIAAAfQAAAAD0NvbXBsaWFuY2VFcnJvcgA=",
        "AAAAAAAAAAAAAAAPcmVnaXN0ZXJfaXNzdWVyAAAAAAIAAAAAAAAABmlzc3VlcgAAAAAAEwAAAAAAAAAMbWV0YWRhdGFfdXJpAAAAEAAAAAEAAAPpAAAAAgAAB9AAAAAPQ29tcGxpYW5jZUVycm9yAA==",
        "AAAAAAAAAAAAAAAPdXBkYXRlX2NvcnJpZG9yAAAAAAYAAAAAAAAABmlzc3VlcgAAAAAAEwAAAAAAAAALY29ycmlkb3JfaWQAAAAABAAAAAAAAAAYc291cmNlX2p1cmlzZGljdGlvbl9yb290AAAD7gAAACAAAAAAAAAAEWRlc3RfYWRkcmVzc19yb290AAAAAAAD7gAAACAAAAAAAAAAFGNvcnJpZG9yX2NvbmZpZ19oYXNoAAAD7gAAACAAAAAAAAAAB2VuYWJsZWQAAAAAAQAAAAEAAAPpAAAAAgAAB9AAAAAPQ29tcGxpYW5jZUVycm9yAA==",
        "AAAAAAAAAAAAAAAQZ2V0X2lzc3Vlcl9yb290cwAAAAEAAAAAAAAABmlzc3VlcgAAAAAAEwAAAAEAAAPoAAAH0AAAAAtJc3N1ZXJSb290cwA=",
        "AAAAAAAAAAAAAAARY2hlY2tfYXR0ZXN0YXRpb24AAAAAAAABAAAAAAAAAAludWxsaWZpZXIAAAAAAAPuAAAAIAAAAAEAAAAB",
        "AAAAAAAAAAAAAAARcmVnaXN0ZXJfY29ycmlkb3IAAAAAAAAFAAAAAAAAAAZpc3N1ZXIAAAAAABMAAAAAAAAAC2NvcnJpZG9yX2lkAAAAAAQAAAAAAAAAGHNvdXJjZV9qdXJpc2RpY3Rpb25fcm9vdAAAA+4AAAAgAAAAAAAAABFkZXN0X2FkZHJlc3Nfcm9vdAAAAAAAA+4AAAAgAAAAAAAAABRjb3JyaWRvcl9jb25maWdfaGFzaAAAA+4AAAAgAAAAAQAAA+kAAAACAAAH0AAAAA9Db21wbGlhbmNlRXJyb3IA",
        "AAAAAQAAAAAAAAAAAAAAFUNvbXBsaWFudFRyYW5zZmVyQXJncwAAAAAAAAgAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAFYXNzZXQAAAAAAAATAAAAAAAAAAtjb3JyaWRvcl9pZAAAAAAEAAAAAAAAAAVlcG9jaAAAAAAAAAYAAAAAAAAABmlzc3VlcgAAAAAAEwAAAAAAAAAJbnVsbGlmaWVyAAAAAAAD7gAAACAAAAAAAAAACXJlY2lwaWVudAAAAAAAABMAAAAAAAAABnNlbmRlcgAAAAAAEw==",
        "AAAAAAAAAAAAAAASY29tcGxpYW50X3RyYW5zZmVyAAAAAAADAAAAAAAAAARhcmdzAAAH0AAAABVDb21wbGlhbnRUcmFuc2ZlckFyZ3MAAAAAAAAAAAAABXByb29mAAAAAAAH0AAAAAVQcm9vZgAAAAAAAAAAAAANcHVibGljX2lucHV0cwAAAAAAA+oAAAAMAAAAAQAAA+kAAAACAAAH0AAAAA9Db21wbGlhbmNlRXJyb3IA",
        "AAAAAAAAAAAAAAASc2V0X2lzc3Vlcl9lbmFibGVkAAAAAAACAAAAAAAAAAZpc3N1ZXIAAAAAABMAAAAAAAAAB2VuYWJsZWQAAAAAAQAAAAEAAAPpAAAAAgAAB9AAAAAPQ29tcGxpYW5jZUVycm9yAA==",
        "AAAAAAAAAAAAAAASdXBkYXRlX2lzc3Vlcl9yb290AAAAAAAEAAAAAAAAAAZpc3N1ZXIAAAAAABMAAAAAAAAAC21lcmtsZV9yb290AAAAA+4AAAAgAAAAAAAAAA5zYW5jdGlvbnNfcm9vdAAAAAAD7gAAACAAAAAAAAAAEWp1cmlzZGljdGlvbl9yb290AAAAAAAD7gAAACAAAAABAAAD6QAAAAIAAAfQAAAAD0NvbXBsaWFuY2VFcnJvcgA=",
        "AAAAAAAAAAAAAAAWdXBkYXRlX2lzc3Vlcl9tZXRhZGF0YQAAAAAAAgAAAAAAAAAGaXNzdWVyAAAAAAATAAAAAAAAAAxtZXRhZGF0YV91cmkAAAAQAAAAAQAAA+kAAAACAAAH0AAAAA9Db21wbGlhbmNlRXJyb3IA",
        "AAAABAAAAAAAAAAAAAAAD0NvbXBsaWFuY2VFcnJvcgAAAAAWAAAAAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAAAEAAAAAAAAADk5vdEluaXRpYWxpemVkAAAAAAACAAAAAAAAAAxVbmF1dGhvcml6ZWQAAAADAAAAAAAAAA1Vbmtub3duSXNzdWVyAAAAAAAABAAAAAAAAAAOSXNzdWVyRGlzYWJsZWQAAAAAAAUAAAAAAAAAD1Vua25vd25Db3JyaWRvcgAAAAAGAAAAAAAAABBDb3JyaWRvckRpc2FibGVkAAAABwAAAAAAAAAPU3RhbGVJc3N1ZXJSb290AAAAAAgAAAAAAAAAEkR1cGxpY2F0ZU51bGxpZmllcgAAAAAACQAAAAAAAAAKWmVyb0Ftb3VudAAAAAAACgAAAAAAAAASTWlzc2luZ0lzc3VlclJvb3RzAAAAAAALAAAAAAAAAAtXcm9uZ1ZrSGFzaAAAAAAMAAAAAAAAABNQdWJsaWNJbnB1dE1pc21hdGNoAAAAAA0AAAAAAAAADEludmFsaWRQcm9vZgAAAA4AAAAAAAAAGEludmFsaWRQdWJsaWNJbnB1dExlbmd0aAAAAA8AAAAAAAAAC0Z1dHVyZUVwb2NoAAAAABAAAAAAAAAAClN0YWxlRXBvY2gAAAAAABEAAAAAAAAABlBhdXNlZAAAAAAAEgAAAAAAAAAOTm9QZW5kaW5nQWRtaW4AAAAAABMAAAAAAAAAEUFscmVhZHlSZWdpc3RlcmVkAAAAAAAAFAAAAAAAAAAVQ29ycmlkb3JBbHJlYWR5RXhpc3RzAAAAAAAAFQAAAAAAAAAQSW52YWxpZFBhZ2VMaW1pdAAAABY=",
        "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" ]),
      options
    )
  }
  public readonly fromJSON = {
    get_issuer: this.txFromJSON<Option<IssuerRecord>>,
        initialize: this.txFromJSON<Result<void>>,
        set_paused: this.txFromJSON<Result<void>>,
        accept_admin: this.txFromJSON<Result<void>>,
        get_corridor: this.txFromJSON<Option<CorridorConfig>>,
        list_issuers: this.txFromJSON<Result<IssuerPage>>,
        set_verifier: this.txFromJSON<Result<void>>,
        propose_admin: this.txFromJSON<Result<void>>,
        register_issuer: this.txFromJSON<Result<void>>,
        update_corridor: this.txFromJSON<Result<void>>,
        get_issuer_roots: this.txFromJSON<Option<IssuerRoots>>,
        check_attestation: this.txFromJSON<boolean>,
        register_corridor: this.txFromJSON<Result<void>>,
        compliant_transfer: this.txFromJSON<Result<void>>,
        set_issuer_enabled: this.txFromJSON<Result<void>>,
        update_issuer_root: this.txFromJSON<Result<void>>,
        update_issuer_metadata: this.txFromJSON<Result<void>>
  }
}