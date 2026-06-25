use async_trait::async_trait;
use serde_json::{json, Value};
use wisp_types::{ProofPackage, Roots};

use crate::model::*;
use crate::proof::{build_canonical_proof_package, normalize_wallet_hex, now_unix};
pub trait Clock: Send + Sync {
    fn now_unix(&self) -> i64;
}

#[derive(Debug, Default)]
pub struct SystemClock;

impl Clock for SystemClock {
    fn now_unix(&self) -> i64 {
        now_unix()
    }
}

pub trait IdentityProviderAdapter: Send + Sync {
    fn normalize_event(
        &self,
        provider: &str,
        event_key: &str,
        payload: &Value,
    ) -> Result<KycDecision, String>;
}

#[derive(Debug, Default)]
pub struct DefaultIdentityProviderAdapter;

impl IdentityProviderAdapter for DefaultIdentityProviderAdapter {
    fn normalize_event(
        &self,
        provider: &str,
        event_key: &str,
        payload: &Value,
    ) -> Result<KycDecision, String> {
        let wallet = normalize_wallet_hex(
            payload
                .get("wallet")
                .or_else(|| payload.get("wallet_hex"))
                .and_then(Value::as_str)
                .ok_or_else(|| "provider payload missing wallet".to_string())?,
        )?;
        let jurisdiction = payload
            .get("jurisdiction")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| "provider payload missing jurisdiction".to_string())?
            .to_string();
        let jurisdiction_code = payload
            .get("jurisdiction_code")
            .and_then(Value::as_u64)
            .map(|value| value as u32)
            .ok_or_else(|| "provider payload missing jurisdiction_code".to_string())?;
        let credential_expiry = payload
            .get("credential_expiry")
            .and_then(Value::as_u64)
            .ok_or_else(|| "provider payload missing credential_expiry".to_string())?;
        let sanctions_clear = payload
            .get("sanctions_clear")
            .and_then(Value::as_bool)
            .ok_or_else(|| "provider payload missing sanctions_clear".to_string())?;
        let enabled = payload
            .get("enabled")
            .and_then(Value::as_bool)
            .ok_or_else(|| "provider payload missing enabled".to_string())?;
        let credential_secret = payload
            .get("credential_secret")
            .and_then(|value| match value {
                Value::String(text) => Some(text.clone()),
                Value::Number(num) => Some(num.to_string()),
                _ => None,
            })
            .ok_or_else(|| "provider payload missing credential_secret".to_string())?;
        let provider_ref = payload
            .get("provider_ref")
            .or_else(|| payload.get("id"))
            .and_then(Value::as_str)
            .unwrap_or(event_key)
            .to_string();
        let corridor_eligibility = payload
            .get("corridor_eligibility")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        Ok(KycDecision {
            provider: provider.to_string(),
            provider_ref,
            enabled,
            subject: IssuerSubject {
                wallet,
                jurisdiction,
                jurisdiction_code,
                metadata: json!({
                    "corridor_eligibility": corridor_eligibility,
                    "raw": payload,
                }),
            },
            credential: IssuerCredential {
                credential_secret,
                credential_expiry,
                sanctions_clear,
                enabled,
            },
        })
    }
}

pub trait DestinationPolicy: Send + Sync {
    fn validate_destination(
        &self,
        corridor: &CorridorRecord,
        destination: Option<&CorridorDestinationRecord>,
    ) -> Result<(), String>;
}

#[derive(Debug, Default)]
pub struct EnabledDestinationPolicy;

impl DestinationPolicy for EnabledDestinationPolicy {
    fn validate_destination(
        &self,
        _corridor: &CorridorRecord,
        destination: Option<&CorridorDestinationRecord>,
    ) -> Result<(), String> {
        match destination {
            Some(item) if item.enabled => Ok(()),
            Some(_) => Err("recipient destination disabled".into()),
            None => Err("recipient not approved for corridor".into()),
        }
    }
}

pub trait RootPublisher: Send + Sync {
    fn publish_roots(&self, roots: &Roots, corridor_id: u32) -> Result<String, String>;
}

#[derive(Debug, Default)]
pub struct NoopRootPublisher;

impl RootPublisher for NoopRootPublisher {
    fn publish_roots(&self, _roots: &Roots, _corridor_id: u32) -> Result<String, String> {
        Err("root publishing disabled".into())
    }
}

pub trait ProofPackageBuilder: Send + Sync {
    fn build(
        &self,
        sender: &IssuerUser,
        credential: &IssuerCredentialRecord,
        corridor: &CorridorRecord,
        destination: &CorridorDestinationRecord,
        users: &[IssuerUser],
        destinations: &[CorridorDestinationRecord],
        amount: String,
    ) -> Result<ProofPackage, String>;
}

#[derive(Debug, Default)]
pub struct CanonicalProofPackageBuilder;

impl ProofPackageBuilder for CanonicalProofPackageBuilder {
    fn build(
        &self,
        sender: &IssuerUser,
        credential: &IssuerCredentialRecord,
        corridor: &CorridorRecord,
        destination: &CorridorDestinationRecord,
        users: &[IssuerUser],
        destinations: &[CorridorDestinationRecord],
        amount: String,
    ) -> Result<ProofPackage, String> {
        build_canonical_proof_package(
            sender,
            credential,
            corridor,
            destination,
            users,
            destinations,
            amount,
            None,
        )
    }
}

pub trait EligibilityPolicy: Send + Sync {
    fn eligible_corridors(&self, sender: &IssuerUser, corridors: &[CorridorRecord]) -> Vec<u32>;
}

#[derive(Debug, Default)]
pub struct JurisdictionEligibilityPolicy;

impl EligibilityPolicy for JurisdictionEligibilityPolicy {
    fn eligible_corridors(&self, sender: &IssuerUser, corridors: &[CorridorRecord]) -> Vec<u32> {
        corridors
            .iter()
            .filter(|corridor| {
                corridor.enabled
                    && corridor
                        .source_country
                        .eq_ignore_ascii_case(&sender.jurisdiction)
            })
            .map(|corridor| corridor.id)
            .collect()
    }
}

#[async_trait]
pub trait IssuerRepository: Send + Sync {
    async fn list_users(&self) -> Result<Vec<IssuerUser>, String>;
    async fn list_corridors(&self) -> Result<Vec<CorridorRecord>, String>;
    async fn get_corridor(&self, id: u32) -> Result<Option<CorridorRecord>, String>;
    async fn find_active_user_by_wallet(&self, wallet: &str) -> Result<Option<IssuerUser>, String>;
    async fn find_active_credential(
        &self,
        user_id: i64,
    ) -> Result<Option<IssuerCredentialRecord>, String>;
    async fn list_enabled_destinations(
        &self,
        corridor_id: u32,
    ) -> Result<Vec<CorridorDestinationRecord>, String>;
    async fn find_destination(
        &self,
        corridor_id: u32,
        address: &str,
    ) -> Result<Option<CorridorDestinationRecord>, String>;
    async fn latest_root_snapshot(
        &self,
        corridor_id: Option<u32>,
    ) -> Result<Option<RootSnapshotRecord>, String>;
    async fn create_pending_root_snapshot(
        &self,
        corridor_id: u32,
        roots: &Roots,
        now: i64,
    ) -> Result<RootSnapshotRecord, String>;
    async fn activate_root_snapshot(
        &self,
        id: i64,
        message: String,
        compliance_contract_id: Option<String>,
        now: i64,
    ) -> Result<(), String>;
    async fn fail_root_snapshot(&self, id: i64, message: String) -> Result<(), String>;
    async fn upsert_approval(&self, decision: KycDecision) -> Result<IssuerUser, String>;
    async fn store_webhook(
        &self,
        provider: &str,
        event_key: &str,
        payload: Value,
    ) -> Result<(WebhookEventRecord, bool), String>;
}
