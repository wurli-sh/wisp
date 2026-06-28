use serde::{Deserialize, Serialize};

fn zero_string() -> String {
    "0".to_string()
}

fn one_string() -> String {
    "1".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Credential {
    pub wallet: String,
    pub jurisdiction: String,
    pub jurisdiction_code: u32,
    pub credential_expiry: u64,
    #[serde(default)]
    pub sanctions_clear: bool,
    #[serde(default)]
    pub corridor_eligibility: Vec<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub credential_commitment: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferParams {
    pub asset: String,
    pub sender: String,
    pub recipient: String,
    pub amount: String,
    pub corridor_id: u32,
    pub epoch: u64,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Roots {
    pub merkle_root: String,
    pub sanctions_root: String,
    pub jurisdiction_root: String,
    pub source_jurisdiction_root: String,
    pub dest_address_root: String,
    pub corridor_config_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MerklePaths {
    pub membership: Vec<String>,
    pub membership_indices: Vec<u8>,
    pub sanctions: Vec<String>,
    pub sanctions_indices: Vec<u8>,
    pub jurisdiction: Vec<String>,
    pub jurisdiction_indices: Vec<u8>,
    pub source_jurisdiction: Vec<String>,
    pub source_jurisdiction_indices: Vec<u8>,
    pub dest_address: Vec<String>,
    pub dest_address_indices: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WitnessPrivate {
    pub demo_unsafe: bool,
    pub credential_secret: String,
    #[serde(default = "zero_string")]
    pub transfer_nonce: String,
    pub jurisdiction: String,
    pub credential_expiry: String,
    pub sanctions_leaf_value: String,
    #[serde(default = "zero_string")]
    pub travel_rule_threshold: String,
    #[serde(default = "one_string")]
    pub enabled: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DemoPackageMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sender_strkey: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recipient_strkey: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub asset_strkey: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub issuer_strkey: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_country: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dest_country: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofPackage {
    pub credential: Credential,
    pub transfer: TransferParams,
    pub roots: Roots,
    pub paths: MerklePaths,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub demo: Option<DemoPackageMetadata>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub witness_private: Option<WitnessPrivate>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub public_inputs: Option<std::collections::HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DemoTransferFixture {
    pub demo_only: bool,
    pub credential_secret: String,
    #[serde(default = "zero_string")]
    pub transfer_nonce: String,
    pub corridor_id: u32,
    pub sender_hex: String,
    pub recipient_hex: String,
    pub asset_hex: String,
    pub amount: String,
    pub epoch: String,
    pub jurisdiction: String,
    pub credential_expiry: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sender_strkey: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recipient_strkey: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub asset_strkey: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub issuer_strkey: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_country: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dest_country: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DemoTransferRequest {
    pub sender_strkey: String,
    pub recipient_strkey: String,
    pub amount: String,
    pub corridor_id: u32,
    pub source_country: String,
    pub dest_country: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorridorOption {
    pub id: u32,
    pub name: String,
    pub source_country: String,
    pub dest_country: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DemoUsersFixture {
    pub demo_only: bool,
    pub users: Vec<DemoUser>,
    pub corridors: Vec<DemoCorridor>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DemoUser {
    pub wallet_hex: String,
    pub jurisdiction: String,
    pub jurisdiction_code: u32,
    pub credential_expiry: u64,
    pub sanctions_clear: bool,
    pub corridor_eligibility: Vec<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DemoCorridor {
    pub id: u32,
    pub name: String,
    pub enabled: bool,
    pub allowed_destinations_hex: Vec<String>,
}
