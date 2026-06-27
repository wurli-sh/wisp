use serde::{Deserialize, Serialize};
use serde_json::Value;
use wisp_types::Roots;
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IssuerUser {
    pub id: i64,
    pub wallet: String,
    pub jurisdiction: String,
    pub jurisdiction_code: u32,
    pub credential_expiry: u64,
    pub sanctions_clear: bool,
    pub enabled: bool,
    pub provider: Option<String>,
    pub provider_ref: Option<String>,
    pub metadata: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IssuerCredentialRecord {
    pub id: i64,
    pub user_id: i64,
    pub credential_secret: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorridorRecord {
    pub id: u32,
    pub name: String,
    pub source_country: String,
    pub dest_country: String,
    pub enabled: bool,
    pub asset_hex: String,
    pub issuer_strkey: Option<String>,
    pub travel_rule_threshold: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorridorDestinationRecord {
    pub id: i64,
    pub corridor_id: u32,
    pub address: String,
    pub enabled: bool,
    pub metadata: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RootSnapshotRecord {
    pub id: i64,
    pub corridor_id: u32,
    pub merkle_root: String,
    pub sanctions_root: String,
    pub jurisdiction_root: String,
    pub source_jurisdiction_root: String,
    pub dest_address_root: String,
    pub corridor_config_hash: String,
    pub publish_status: String,
    pub publish_message: Option<String>,
    pub compliance_contract_id: Option<String>,
    pub created_at: i64,
    pub activated_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookEventRecord {
    pub id: i64,
    pub provider: String,
    pub event_key: String,
    pub payload: Value,
    pub processed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IssuerSubject {
    pub wallet: String,
    pub jurisdiction: String,
    pub jurisdiction_code: u32,
    pub metadata: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IssuerCredential {
    pub credential_secret: String,
    pub credential_expiry: u64,
    pub sanctions_clear: bool,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KycDecision {
    pub provider: String,
    pub provider_ref: String,
    pub enabled: bool,
    pub subject: IssuerSubject,
    pub credential: IssuerCredential,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovedDestination {
    pub corridor_id: u32,
    pub address: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofPackageRequest {
    pub sender_wallet: String,
    pub recipient_wallet: String,
    pub amount: String,
    pub corridor_id: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BootstrapIssuerRequest {
    pub issuer_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BootstrapIssuerResult {
    pub issuer_name: Option<String>,
    pub corridor_plans: Vec<PublishPlan>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RootsState {
    Active,
    Stale,
    Missing,
    Publishing,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NextAction {
    PublishRoots,
    ApproveDestination,
    RegisterCorridor,
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishPlan {
    pub corridor_id: u32,
    pub roots_state: RootsState,
    pub next_action: NextAction,
    pub reasons: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub computed_roots: Option<Roots>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latest_snapshot: Option<RootSnapshotRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishOutcome {
    pub snapshot_id: i64,
    pub corridor_id: u32,
    pub roots_state: RootsState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IssuanceReadiness {
    pub wallet: String,
    pub corridor_id: u32,
    pub recipient: Option<String>,
    pub ready: bool,
    pub roots_state: RootsState,
    pub next_action: NextAction,
    pub reasons: Vec<String>,
}
