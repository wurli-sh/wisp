/** Hand-maintained mirror of crates/wisp-types ProofPackage JSON shape. */

export interface Credential {
  wallet: string;
  jurisdiction: string;
  jurisdiction_code: number;
  credential_expiry: number;
  sanctions_clear?: boolean;
  corridor_eligibility?: number[];
  credential_commitment: string;
}

export interface TransferParams {
  asset: string;
  sender: string;
  recipient: string;
  amount: string;
  corridor_id: number;
  epoch: number;
  timestamp: number;
}

export interface Roots {
  merkle_root: string;
  sanctions_root: string;
  jurisdiction_root: string;
  source_jurisdiction_root: string;
  dest_address_root: string;
  corridor_config_hash: string;
}

export interface MerklePaths {
  membership: string[];
  membership_indices: number[];
  sanctions: string[];
  sanctions_indices: number[];
  jurisdiction: string[];
  jurisdiction_indices: number[];
  source_jurisdiction: string[];
  source_jurisdiction_indices: number[];
  dest_address: string[];
  dest_address_indices: number[];
}

export interface WitnessPrivate {
  demo_unsafe: boolean;
  transfer_nonce?: string;
  jurisdiction: string;
  credential_expiry: string;
  sanctions_leaf_value: string;
}

export interface ProofPackage {
  credential: Credential;
  transfer: TransferParams;
  roots: Roots;
  paths: MerklePaths;
  witness_private: WitnessPrivate;
  public_inputs: Record<string, string>;
}

export interface DemoTransferFixture {
  demo_only: boolean;
  credential_secret: string;
  transfer_nonce?: string;
  corridor_id: number;
  sender_hex: string;
  recipient_hex: string;
  asset_hex: string;
  amount: string;
  epoch: string;
  jurisdiction: string;
  credential_expiry: string;
  sender_strkey?: string;
  recipient_strkey?: string;
  asset_strkey?: string;
  issuer_strkey?: string;
}
