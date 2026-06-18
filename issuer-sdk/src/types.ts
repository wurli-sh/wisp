import type { AssembledTransaction, Result } from "@stellar/stellar-sdk/contract";

export interface AmoebaIssuerConfig {
  rpcUrl: string;
  networkPassphrase: string;
  complianceId: string;
  operatorPublicKey: string;
  issuerPublicKey?: string;
}

export interface IssuerTransactionSigner {
  publicKey: string;
  signTransaction: (xdr: string) => Promise<{ signedTxXdr: string }>;
}

export type RootHashInput = string | Buffer | Uint8Array;

export interface IssuerRootsInput {
  merkleRoot: RootHashInput;
  sanctionsRoot: RootHashInput;
  jurisdictionRoot: RootHashInput;
}

export interface CorridorRootsInput {
  sourceJurisdictionRoot: RootHashInput;
  destAddressRoot: RootHashInput;
  corridorConfigHash: RootHashInput;
}

export interface RegisterIssuerInput {
  issuer?: string;
  metadataUri: string;
}

export interface UpdateIssuerMetadataInput {
  issuer?: string;
  metadataUri: string;
}

export interface RegisterCorridorInput extends CorridorRootsInput {
  issuer?: string;
  corridorId: number;
}

export interface UpdateCorridorInput extends CorridorRootsInput {
  issuer?: string;
  corridorId: number;
  enabled: boolean;
}

export interface PublishIssuerRootsInput extends IssuerRootsInput {
  issuer?: string;
}

export interface PublishRootsInput extends IssuerRootsInput, CorridorRootsInput {
  issuer?: string;
  corridorId: number;
  metadataUri: string;
  enabled?: boolean;
}

export type IssuerMutationTransaction = AssembledTransaction<Result<void>>;

export interface PublishRootsPlan {
  issuer: string;
  corridorId: number;
  registerIssuer?: {
    action: "registerIssuer";
    build: (publicKey?: string) => Promise<IssuerMutationTransaction>;
  };
  publishIssuerRoots: {
    action: "publishIssuerRoots";
    build: (publicKey?: string) => Promise<IssuerMutationTransaction>;
  };
  corridor:
    | {
        action: "register";
        build: (publicKey?: string) => Promise<IssuerMutationTransaction>;
      }
    | {
        action: "update";
        build: (publicKey?: string) => Promise<IssuerMutationTransaction>;
      };
}

export interface PublishRootsSendResult {
  plan: PublishRootsPlan;
  sent: {
    registerIssuer?: unknown;
    publishIssuerRoots: unknown;
    corridor: unknown;
  };
}
