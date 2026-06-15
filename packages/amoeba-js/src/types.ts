export type FieldElement = unknown;

export interface DemoFixture {
  credential_secret: string | number;
  sender_hex: string;
  recipient_hex: string;
  asset_hex: string;
  amount: string | number;
  epoch: string | number;
  jurisdiction: string | number;
  credential_expiry: string | number;
  corridor_id?: string | number;
}

export interface DemoParams {
  credential_secret: bigint;
  sender: Buffer;
  recipient: Buffer;
  asset: Buffer;
  amount: bigint;
  epoch: bigint;
  jurisdiction: bigint;
  credential_expiry: bigint;
  corridor_id?: bigint;
}

export interface ProtocolConfig {
  CORRIDOR_ID?: bigint;
  EPOCH_LEN_SECS?: number;
}

export interface ProofPackagePaths {
  membership: string[];
  membership_indices: number[];
  jurisdiction: string[];
  jurisdiction_indices: number[];
  source_jurisdiction: string[];
  source_jurisdiction_indices: number[];
  dest_address: string[];
  dest_address_indices: number[];
  sanctions: string[];
  sanctions_indices: number[];
}

export interface ProofPackage {
  credential?: { wallet?: string; jurisdiction?: string };
  transfer?: {
    asset?: string;
    sender?: string;
    recipient?: string;
    amount?: string | number;
    corridor_id?: string | number;
    epoch?: string | number;
    timestamp?: string | number;
  };
  roots?: Record<string, string>;
  paths: ProofPackagePaths;
  witness_private?: {
    demo_unsafe?: boolean;
    credential_secret: string | number;
    jurisdiction: string | number;
    credential_expiry: string | number;
    sanctions_leaf_value?: string;
  };
  public_inputs?: Record<string, string | number>;
}

export type WitnessInput = Record<string, string | number | string[] | number[]>;
