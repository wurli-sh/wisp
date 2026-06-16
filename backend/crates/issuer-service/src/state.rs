use std::collections::{BTreeSet, HashMap};
use std::fs;
use std::path::Path;
use std::sync::{Arc, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};

use amoeba_types::{
    CorridorOption, Credential, DemoTransferFixture, DemoTransferRequest, DemoUsersFixture,
    ProofPackage, Roots,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio_postgres::{Client, NoTls, Row};

use crate::config::Config;
use crate::mock_kyc::{
    build_challenge, classify_mock_kyc_resubmit, evaluate_mock_kyc_form, mock_credential_expiry,
    mock_jurisdiction, validate_wallet_strkey, verify_signed_challenge, MockKycChallengeRecord,
    MockKycChallengeResponse, MockKycLifecycleStatus, MockKycMissing, MockKycResubmitAction,
    MockKycStatusResponse, MockKycSubmitRequest, MockKycSubmitResponse, MockKycSubmitStatus,
    MOCK_CREDENTIAL_SECRET,
};
use crate::trees::{
    build_canonical_proof_package, build_dynamic_demo_fixture, corridor_options,
    normalize_provider_payload, NormalizedProviderEvent,
};

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
pub struct UserPatch {
    pub enabled: Option<bool>,
    pub sanctions_clear: Option<bool>,
    pub credential_expiry: Option<u64>,
    pub jurisdiction: Option<String>,
    pub jurisdiction_code: Option<u32>,
    pub wallet: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorridorPatch {
    pub enabled: Option<bool>,
    pub name: Option<String>,
    pub source_country: Option<String>,
    pub dest_country: Option<String>,
    pub asset_hex: Option<String>,
    pub issuer_strkey: Option<String>,
    pub travel_rule_threshold: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DestinationCreate {
    pub address: String,
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub metadata: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishRootsRequest {
    pub corridor_id: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofPackageRequest {
    pub sender_wallet: String,
    pub recipient_wallet: String,
    pub amount: String,
    pub corridor_id: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishResult {
    pub snapshot_id: i64,
    pub corridor_id: u32,
    pub status: String,
    pub message: Option<String>,
}

#[derive(Clone)]
pub struct AppState {
    pub(crate) repo: Arc<Repository>,
    cache: Arc<RwLock<Option<ProofPackage>>>,
    bootstrap_corridor_id: Arc<RwLock<Option<u32>>>,
}

pub(crate) enum Repository {
    Memory(Arc<RwLock<MemoryStore>>),
    Postgres(PostgresStore),
}

struct PostgresStore {
    client: Client,
}

struct MemoryStore {
    next_user_id: i64,
    next_credential_id: i64,
    next_destination_id: i64,
    next_snapshot_id: i64,
    next_webhook_id: i64,
    users: Vec<IssuerUser>,
    credentials: Vec<IssuerCredentialRecord>,
    corridors: Vec<CorridorRecord>,
    destinations: Vec<CorridorDestinationRecord>,
    root_snapshots: Vec<RootSnapshotRecord>,
    webhook_events: Vec<WebhookEventRecord>,
    mock_kyc_challenges: Vec<crate::mock_kyc::MockKycChallengeRecord>,
    mock_kyc_last_request: HashMap<String, i64>,
}

impl Default for MemoryStore {
    fn default() -> Self {
        Self {
            next_user_id: 0,
            next_credential_id: 0,
            next_destination_id: 0,
            next_snapshot_id: 0,
            next_webhook_id: 0,
            users: Vec::new(),
            credentials: Vec::new(),
            corridors: Vec::new(),
            destinations: Vec::new(),
            root_snapshots: Vec::new(),
            webhook_events: Vec::new(),
            mock_kyc_challenges: Vec::new(),
            mock_kyc_last_request: HashMap::new(),
        }
    }
}

impl AppState {
    pub async fn load(cfg: &Config) -> Self {
        let repo = if let Some(db_url) = cfg.supabase_db_url.clone() {
            match PostgresStore::connect(&db_url).await {
                Ok(store) => Arc::new(Repository::Postgres(store)),
                Err(err) => {
                    tracing::warn!("supabase postgres unavailable, using memory store: {err}");
                    Arc::new(Repository::Memory(Arc::new(RwLock::new(MemoryStore::default()))))
                }
            }
        } else {
            Arc::new(Repository::Memory(Arc::new(RwLock::new(MemoryStore::default()))))
        };

        let state = Self {
            repo,
            cache: Arc::new(RwLock::new(None)),
            bootstrap_corridor_id: Arc::new(RwLock::new(None)),
        };

        state.seed_from_fixtures(cfg).await;
        if let Some(req) = state.bootstrap_request(cfg).await {
            let _ = state.create_proof_package(&req).await.map(|pkg| {
                *state.cache.write().expect("lock") = Some(pkg);
            });
        }
        state
    }

    pub async fn bootstrap_request(&self, cfg: &Config) -> Option<ProofPackageRequest> {
        let fixture = load_demo_transfer(cfg)?;
        Some(ProofPackageRequest {
            sender_wallet: fixture.sender_hex,
            recipient_wallet: fixture.recipient_hex,
            amount: fixture.amount,
            corridor_id: fixture.corridor_id,
        })
    }

    pub async fn seed_from_fixtures(&self, cfg: &Config) {
        let transfer = load_demo_transfer(cfg);
        if self.repo.user_count().await == 0 && self.repo.corridor_count().await == 0 {
            let Some(users_fixture) = load_demo_users(cfg) else {
                if let Some(transfer) = &transfer {
                    self.repo
                        .ensure_corridor_destination(transfer.corridor_id, &transfer.recipient_hex)
                        .await;
                }
                return;
            };
            self.repo.seed_demo_data(&users_fixture, transfer.as_ref()).await;
            *self.bootstrap_corridor_id.write().expect("lock") =
                transfer.as_ref().map(|item| item.corridor_id);
        } else if let Some(transfer) = &transfer {
            self.repo
                .ensure_corridor_destination(transfer.corridor_id, &transfer.recipient_hex)
                .await;
        }
    }

    pub async fn proof_package(&self) -> Option<ProofPackage> {
        self.cache.read().expect("lock").clone()
    }

    pub async fn roots(&self) -> Option<Roots> {
        self.proof_package().await.map(|pkg| pkg.roots)
    }

    pub async fn roots_hash(&self) -> String {
        let Some(roots) = self.roots().await else {
            return "empty".into();
        };
        format!(
            "{:x}",
            hash_to_u64(&format!(
                "{}{}{}{}{}{}",
                roots.merkle_root,
                roots.sanctions_root,
                roots.jurisdiction_root,
                roots.source_jurisdiction_root,
                roots.dest_address_root,
                roots.corridor_config_hash
            ))
        )
    }

    pub async fn wallet_credential(&self, wallet_hex: &str) -> Option<Credential> {
        self.repo.get_user_credential(wallet_hex).await
    }

    pub async fn available_corridors(&self) -> Vec<CorridorOption> {
        self.repo.list_corridor_options().await
    }

    pub async fn get_corridor(&self, id: u32) -> Option<CorridorRecord> {
        self.repo.get_corridor(id).await
    }

    pub async fn list_users(&self) -> Vec<IssuerUser> {
        self.repo.list_users().await
    }

    pub async fn update_user(&self, id: i64, patch: UserPatch) -> Result<IssuerUser, String> {
        self.repo.update_user(id, patch).await
    }

    pub async fn list_admin_corridors(&self) -> Vec<CorridorRecord> {
        self.repo.list_corridors().await
    }

    pub async fn update_corridor(
        &self,
        id: u32,
        patch: CorridorPatch,
    ) -> Result<CorridorRecord, String> {
        self.repo.update_corridor(id, patch).await
    }

    pub async fn add_destination(
        &self,
        corridor_id: u32,
        request: DestinationCreate,
    ) -> Result<CorridorDestinationRecord, String> {
        self.repo.add_destination(corridor_id, request).await
    }

    pub async fn latest_root_snapshot(
        &self,
        corridor_id: Option<u32>,
    ) -> Option<RootSnapshotRecord> {
        self.repo.latest_root_snapshot(corridor_id).await
    }

    pub async fn store_webhook(
        &self,
        provider: &str,
        event_key: &str,
        payload: Value,
    ) -> Result<(WebhookEventRecord, bool), String> {
        self.repo.store_webhook(provider, event_key, payload).await
    }

    pub async fn apply_webhook_event(
        &self,
        provider: &str,
        event_key: &str,
        payload: Value,
    ) -> Result<IssuerUser, String> {
        let normalized = normalize_provider_payload(provider, event_key, &payload)?;
        self.repo.apply_normalized_event(normalized).await
    }

    pub async fn create_demo_transfer(
        &self,
        req: &DemoTransferRequest,
    ) -> Result<(DemoTransferFixture, ProofPackage), String> {
        let users_fixture = self.repo.export_demo_fixture().await;
        let fixture = build_dynamic_demo_fixture(
            req,
            &users_fixture,
            &load_demo_transfer_fixture_template(),
        )?;
        let proof = self
            .create_proof_package(&ProofPackageRequest {
                sender_wallet: fixture.sender_hex.clone(),
                recipient_wallet: fixture.recipient_hex.clone(),
                amount: fixture.amount.clone(),
                corridor_id: fixture.corridor_id,
            })
            .await?;
        Ok((fixture, proof))
    }

    pub async fn create_proof_package(
        &self,
        req: &ProofPackageRequest,
    ) -> Result<ProofPackage, String> {
        let sender = self
            .repo
            .find_active_user_by_wallet(&req.sender_wallet)
            .await
            .ok_or_else(|| "approved sender not found".to_string())?;
        if !sender.sanctions_clear {
            return Err("sender is not sanctions clear".into());
        }

        let credential = self
            .repo
            .find_active_credential(sender.id)
            .await
            .ok_or_else(|| "active credential not found".to_string())?;

        let corridor = self
            .repo
            .get_corridor(req.corridor_id)
            .await
            .ok_or_else(|| format!("unknown corridor id: {}", req.corridor_id))?;
        if !corridor.enabled {
            return Err(format!("corridor {} is disabled", corridor.id));
        }

        let destination = self
            .repo
            .find_destination(req.corridor_id, &req.recipient_wallet)
            .await
            .ok_or_else(|| "recipient not approved for corridor".to_string())?;
        if !destination.enabled {
            return Err("recipient destination disabled".into());
        }

        let users = self.repo.list_active_users().await;
        let destinations = self.repo.list_enabled_destinations(req.corridor_id).await;
        let proof = build_canonical_proof_package(
            &sender,
            &credential,
            &corridor,
            &destination,
            &users,
            &destinations,
            req.amount.clone(),
        )?;
        *self.cache.write().expect("lock") = Some(proof.clone());
        Ok(proof)
    }

    pub async fn publish_roots(
        &self,
        cfg: &Config,
        request: PublishRootsRequest,
    ) -> Result<Vec<PublishResult>, String> {
        let corridor_ids = if let Some(id) = request.corridor_id {
            vec![id]
        } else {
            self.repo
                .list_corridors()
                .await
                .into_iter()
                .filter(|corridor| corridor.enabled)
                .map(|corridor| corridor.id)
                .collect()
        };

        let mut results = Vec::new();
        for corridor_id in corridor_ids {
            let roots = self.compute_roots_for_corridor(corridor_id).await?;
            let snapshot = self
                .repo
                .create_pending_root_snapshot(corridor_id, &roots)
                .await?;
            match crate::stellar::publish_roots(cfg, &roots, corridor_id) {
                Ok(msg) => {
                    self.repo
                        .activate_root_snapshot(snapshot.id, msg.clone())
                        .await?;
                    results.push(PublishResult {
                        snapshot_id: snapshot.id,
                        corridor_id,
                        status: "active".into(),
                        message: Some(msg),
                    });
                }
                Err(err) => {
                    self.repo
                        .fail_root_snapshot(snapshot.id, err.clone())
                        .await?;
                    results.push(PublishResult {
                        snapshot_id: snapshot.id,
                        corridor_id,
                        status: "failed".into(),
                        message: Some(err),
                    });
                }
            }
        }

        Ok(results)
    }

    pub async fn create_mock_kyc_challenge(
        &self,
        cfg: &Config,
        wallet_strkey: &str,
    ) -> Result<MockKycChallengeResponse, String> {
        let wallet_hex = validate_wallet_strkey(wallet_strkey)?;
        self.repo
            .throttle_mock_kyc_wallet(&wallet_hex, 2)
            .await?;

        let (challenge_id, challenge_xdr, nonce, expires_at) =
            build_challenge(wallet_strkey, &cfg.network_passphrase)?;

        self.repo
            .insert_mock_kyc_challenge(MockKycChallengeRecord {
                id: challenge_id.clone(),
                wallet_hex,
                wallet_strkey: wallet_strkey.trim().to_string(),
                challenge_xdr: challenge_xdr.clone(),
                nonce,
                expires_at,
                consumed_at: None,
            })
            .await?;

        Ok(MockKycChallengeResponse {
            challenge_id,
            challenge_xdr,
            expires_at,
        })
    }

    pub async fn submit_mock_kyc(
        &self,
        cfg: &Config,
        req: &MockKycSubmitRequest,
    ) -> Result<MockKycSubmitResponse, String> {
        let challenge = self
            .repo
            .get_mock_kyc_challenge_by_id(&req.challenge_id)
            .await?
            .ok_or_else(|| "unknown challenge".to_string())?;

        if challenge.consumed_at.is_some() {
            return Err("challenge already consumed".into());
        }

        verify_signed_challenge(
            &req.signed_challenge_xdr,
            &challenge.wallet_strkey,
            &challenge.nonce,
            &cfg.network_passphrase,
            challenge.expires_at,
        )?;

        self.repo
            .consume_mock_kyc_challenge(&challenge.id)
            .await?;

        let existing = self.repo.find_user_by_wallet(&challenge.wallet_hex).await?;
        let credential = if let Some(user) = &existing {
            self.repo.find_credential_for_user(user.id).await?
        } else {
            None
        };
        let kyc_status = existing
            .as_ref()
            .and_then(|user| user.metadata.get("kyc_status"))
            .and_then(|value| value.as_str());

        match classify_mock_kyc_resubmit(
            existing.as_ref().and_then(|user| user.provider.as_deref()),
            existing.as_ref().is_some_and(|user| user.enabled),
            existing.as_ref().is_some_and(|user| user.sanctions_clear),
            kyc_status,
            credential.as_ref().is_some_and(|item| item.enabled),
        ) {
            MockKycResubmitAction::Revoked => return Err("wallet revoked".into()),
            MockKycResubmitAction::AlreadyApproved => {
                return Ok(MockKycSubmitResponse {
                    status: MockKycSubmitStatus::AlreadyApproved,
                    reason: None,
                });
            }
            MockKycResubmitAction::Continue => {}
        }

        let approval = evaluate_mock_kyc_form(&req.country, &req.dob, req.sanctions_clear);
        let submitted_at = now_unix();
        let metadata = json!({
            "wallet_strkey": challenge.wallet_strkey,
            "full_name": req.name,
            "country": req.country,
            "date_of_birth": req.dob,
            "sanctions_declaration": req.sanctions_clear,
            "corridor_eligibility": [1],
            "submitted_at": submitted_at,
        });

        let _ = self
            .store_webhook(
                "mock",
                &challenge.id,
                json!({
                    "challenge_id": challenge.id,
                    "wallet": challenge.wallet_strkey,
                    "name": req.name,
                    "country": req.country,
                    "dob": req.dob,
                    "sanctions_clear": req.sanctions_clear,
                    "approval_ok": approval.is_ok(),
                }),
            )
            .await?;

        if let Err(reason) = approval {
            let (jurisdiction, jurisdiction_code) = mock_jurisdiction();
            let mut rejected_meta = metadata.clone();
            rejected_meta
                .as_object_mut()
                .expect("metadata object")
                .insert("kyc_status".into(), json!("rejected"));
            rejected_meta
                .as_object_mut()
                .expect("metadata object")
                .insert("rejected_at".into(), json!(submitted_at));
            rejected_meta
                .as_object_mut()
                .expect("metadata object")
                .insert("rejection_reason".into(), json!(reason.clone()));

            self.repo
                .upsert_mock_kyc_user(
                    &challenge.wallet_hex,
                    jurisdiction,
                    jurisdiction_code,
                    mock_credential_expiry(),
                    false,
                    false,
                    "mock",
                    &challenge.id,
                    rejected_meta,
                    false,
                )
                .await?;

            return Ok(MockKycSubmitResponse {
                status: MockKycSubmitStatus::Rejected,
                reason: Some(reason),
            });
        }

        let (jurisdiction, jurisdiction_code) = mock_jurisdiction();
        let mut approved_meta = metadata;
        approved_meta
            .as_object_mut()
            .expect("metadata object")
            .insert("kyc_status".into(), json!("approved"));
        approved_meta
            .as_object_mut()
            .expect("metadata object")
            .insert("approved_at".into(), json!(submitted_at));

        self.repo
            .upsert_mock_kyc_user(
                &challenge.wallet_hex,
                jurisdiction,
                jurisdiction_code,
                mock_credential_expiry(),
                true,
                true,
                "mock",
                &challenge.id,
                approved_meta,
                true,
            )
            .await?;

        Ok(MockKycSubmitResponse {
            status: MockKycSubmitStatus::Approved,
            reason: None,
        })
    }

    pub async fn mock_kyc_status(
        &self,
        wallet_strkey: &str,
    ) -> Result<MockKycStatusResponse, String> {
        let wallet_hex = validate_wallet_strkey(wallet_strkey)?;
        let wallet = wallet_strkey.trim().to_string();
        let mut missing = Vec::new();

        let corridors = self.list_admin_corridors().await;
        let enabled_corridor = corridors.iter().find(|c| c.enabled).cloned();
        if enabled_corridor.is_none() {
            missing.push(MockKycMissing::Corridor);
        }

        let user = self.repo.find_user_by_wallet(&wallet_hex).await?;
        let credential = if let Some(user) = &user {
            self.repo.find_credential_for_user(user.id).await?
        } else {
            None
        };

        let kyc_status = match user.as_ref() {
            None => MockKycLifecycleStatus::None,
            Some(user) if user.enabled
                && user.sanctions_clear
                && user.provider.as_deref() == Some("mock")
                && credential.as_ref().is_some_and(|c| c.enabled) =>
            {
                MockKycLifecycleStatus::Approved
            }
            Some(user) if !user.enabled && user.provider.as_deref() == Some("mock") => {
                if user.metadata.get("kyc_status").and_then(|v| v.as_str()) == Some("rejected") {
                    MockKycLifecycleStatus::Rejected
                } else {
                    MockKycLifecycleStatus::Revoked
                }
            }
            Some(_) => MockKycLifecycleStatus::Rejected,
        };

        if kyc_status != MockKycLifecycleStatus::Approved {
            missing.push(MockKycMissing::Kyc);
        }

        if let Some(corridor) = &enabled_corridor {
            let destinations = self.repo.list_enabled_destinations(corridor.id).await;
            if destinations.is_empty() {
                missing.push(MockKycMissing::Destination);
            }
        }

        let has_active_root = if let Some(corridor) = &enabled_corridor {
            self.latest_root_snapshot(Some(corridor.id))
                .await
                .is_some_and(|snapshot| snapshot.publish_status == "active")
        } else {
            false
        };
        if !has_active_root {
            missing.push(MockKycMissing::RootsPublished);
        }

        let rejection_reason = user.as_ref().and_then(|item| {
            item.metadata
                .get("rejection_reason")
                .and_then(|value| value.as_str())
                .map(str::to_string)
        });

        Ok(MockKycStatusResponse {
            wallet,
            kyc_status,
            eligible_for_proof: missing.is_empty(),
            missing,
            rejection_reason,
        })
    }

    async fn compute_roots_for_corridor(&self, corridor_id: u32) -> Result<Roots, String> {
        let corridor = self
            .repo
            .get_corridor(corridor_id)
            .await
            .ok_or_else(|| format!("unknown corridor id: {corridor_id}"))?;
        let users = self.repo.list_active_users().await;
        let destinations = self.repo.list_enabled_destinations(corridor_id).await;
        let sender = users
            .iter()
            .find(|user| user.jurisdiction.eq_ignore_ascii_case(&corridor.source_country))
            .cloned()
            .or_else(|| users.first().cloned())
            .ok_or_else(|| "no active issuer users found".to_string())?;
        let credential = self
            .repo
            .find_active_credential(sender.id)
            .await
            .ok_or_else(|| "no active credential found".to_string())?;
        let destination = destinations
            .first()
            .cloned()
            .ok_or_else(|| "no approved destinations found".to_string())?;
        let pkg = build_canonical_proof_package(
            &sender,
            &credential,
            &corridor,
            &destination,
            &users,
            &destinations,
            "1".into(),
        )?;
        Ok(pkg.roots)
    }
}

impl Repository {
    async fn user_count(&self) -> usize {
        match self {
            Self::Memory(store) => store.read().expect("lock").users.len(),
            Self::Postgres(store) => store.user_count().await.unwrap_or(0),
        }
    }

    async fn corridor_count(&self) -> usize {
        match self {
            Self::Memory(store) => store.read().expect("lock").corridors.len(),
            Self::Postgres(store) => store.corridor_count().await.unwrap_or(0),
        }
    }

    async fn seed_demo_data(
        &self,
        users_fixture: &DemoUsersFixture,
        transfer: Option<&DemoTransferFixture>,
    ) {
        match self {
            Self::Memory(store) => {
                let mut store = store.write().expect("lock");
                if !store.users.is_empty() || !store.corridors.is_empty() {
                    return;
                }
                let fallback_asset = transfer
                    .map(|item| item.asset_hex.clone())
                    .unwrap_or_else(default_asset_hex);
                let issuer = transfer.and_then(|item| item.issuer_strkey.clone());
                for corridor in corridor_options(users_fixture) {
                    store.corridors.push(CorridorRecord {
                        id: corridor.id,
                        name: corridor.name,
                        source_country: corridor.source_country,
                        dest_country: corridor.dest_country,
                        enabled: corridor.enabled,
                        asset_hex: fallback_asset.clone(),
                        issuer_strkey: issuer.clone(),
                        travel_rule_threshold: "0".into(),
                    });
                }
                for corridor in &users_fixture.corridors {
                    for address in &corridor.allowed_destinations_hex {
                        store.next_destination_id += 1;
                        let destination_id = store.next_destination_id;
                        store.destinations.push(CorridorDestinationRecord {
                            id: destination_id,
                            corridor_id: corridor.id,
                            address: address.clone(),
                            enabled: true,
                            metadata: Value::Null,
                        });
                    }
                }
                if let Some(transfer) = transfer {
                    let exists = store.destinations.iter().any(|item| {
                        item.corridor_id == transfer.corridor_id && item.address == transfer.recipient_hex
                    });
                    if !exists {
                        store.next_destination_id += 1;
                        let destination_id = store.next_destination_id;
                        store.destinations.push(CorridorDestinationRecord {
                            id: destination_id,
                            corridor_id: transfer.corridor_id,
                            address: transfer.recipient_hex.clone(),
                            enabled: true,
                            metadata: Value::Null,
                        });
                    }
                }
            }
            Self::Postgres(store) => {
                let _ = store.seed_demo_data(users_fixture, transfer).await;
            }
        }
    }

    async fn ensure_corridor_destination(&self, corridor_id: u32, address: &str) {
        match self {
            Self::Memory(store) => {
                let mut store = store.write().expect("lock");
                let exists = store.destinations.iter().any(|item| {
                    item.corridor_id == corridor_id && item.address == address
                });
                if exists {
                    return;
                }
                store.next_destination_id += 1;
                let destination_id = store.next_destination_id;
                store.destinations.push(CorridorDestinationRecord {
                    id: destination_id,
                    corridor_id,
                    address: address.to_string(),
                    enabled: true,
                    metadata: Value::Null,
                });
            }
            Self::Postgres(store) => {
                let _ = store.ensure_corridor_destination(corridor_id, address).await;
            }
        }
    }

    async fn get_user_credential(&self, wallet: &str) -> Option<Credential> {
        match self {
            Self::Memory(store) => {
                let store = store.read().expect("lock");
                let user = store.users.iter().find(|user| user.wallet == wallet && user.enabled)?;
                Some(Credential {
                    wallet: user.wallet.clone(),
                    jurisdiction: user.jurisdiction.clone(),
                    credential_expiry: user.credential_expiry,
                    sanctions_clear: user.sanctions_clear,
                    corridor_eligibility: corridor_eligibility(&user.metadata),
                    credential_commitment: None,
                })
            }
            Self::Postgres(store) => store.get_user_credential(wallet).await.ok().flatten(),
        }
    }

    async fn list_corridor_options(&self) -> Vec<CorridorOption> {
        self.list_corridors()
            .await
            .into_iter()
            .map(|corridor| CorridorOption {
                id: corridor.id,
                name: corridor.name,
                source_country: corridor.source_country,
                dest_country: corridor.dest_country,
                enabled: corridor.enabled,
            })
            .collect()
    }

    async fn get_corridor(&self, id: u32) -> Option<CorridorRecord> {
        match self {
            Self::Memory(store) => store
                .read()
                .expect("lock")
                .corridors
                .iter()
                .find(|corridor| corridor.id == id)
                .cloned(),
            Self::Postgres(store) => store.get_corridor(id).await.ok().flatten(),
        }
    }

    async fn list_users(&self) -> Vec<IssuerUser> {
        match self {
            Self::Memory(store) => store.read().expect("lock").users.clone(),
            Self::Postgres(store) => store.list_users().await.unwrap_or_default(),
        }
    }

    async fn list_active_users(&self) -> Vec<IssuerUser> {
        self.list_users()
            .await
            .into_iter()
            .filter(|user| user.enabled)
            .collect()
    }

    async fn update_user(&self, id: i64, patch: UserPatch) -> Result<IssuerUser, String> {
        match self {
            Self::Memory(store) => {
                let mut store = store.write().expect("lock");
                let user = store
                    .users
                    .iter_mut()
                    .find(|user| user.id == id)
                    .ok_or_else(|| format!("unknown user id: {id}"))?;
                if let Some(enabled) = patch.enabled {
                    user.enabled = enabled;
                }
                if let Some(sanctions_clear) = patch.sanctions_clear {
                    user.sanctions_clear = sanctions_clear;
                }
                if let Some(credential_expiry) = patch.credential_expiry {
                    user.credential_expiry = credential_expiry;
                }
                if let Some(jurisdiction) = patch.jurisdiction {
                    user.jurisdiction = jurisdiction;
                }
                if let Some(jurisdiction_code) = patch.jurisdiction_code {
                    user.jurisdiction_code = jurisdiction_code;
                }
                if let Some(wallet) = patch.wallet {
                    user.wallet = wallet;
                }
                Ok(user.clone())
            }
            Self::Postgres(store) => store.update_user(id, patch).await,
        }
    }

    async fn list_corridors(&self) -> Vec<CorridorRecord> {
        match self {
            Self::Memory(store) => store.read().expect("lock").corridors.clone(),
            Self::Postgres(store) => store.list_corridors().await.unwrap_or_default(),
        }
    }

    async fn update_corridor(&self, id: u32, patch: CorridorPatch) -> Result<CorridorRecord, String> {
        match self {
            Self::Memory(store) => {
                let mut store = store.write().expect("lock");
                let corridor = store
                    .corridors
                    .iter_mut()
                    .find(|corridor| corridor.id == id)
                    .ok_or_else(|| format!("unknown corridor id: {id}"))?;
                if let Some(enabled) = patch.enabled {
                    corridor.enabled = enabled;
                }
                if let Some(name) = patch.name {
                    corridor.name = name;
                }
                if let Some(source_country) = patch.source_country {
                    corridor.source_country = source_country;
                }
                if let Some(dest_country) = patch.dest_country {
                    corridor.dest_country = dest_country;
                }
                if let Some(asset_hex) = patch.asset_hex {
                    corridor.asset_hex = asset_hex;
                }
                if let Some(issuer_strkey) = patch.issuer_strkey {
                    corridor.issuer_strkey = Some(issuer_strkey);
                }
                if let Some(threshold) = patch.travel_rule_threshold {
                    corridor.travel_rule_threshold = threshold;
                }
                Ok(corridor.clone())
            }
            Self::Postgres(store) => store.update_corridor(id, patch).await,
        }
    }

    async fn add_destination(
        &self,
        corridor_id: u32,
        request: DestinationCreate,
    ) -> Result<CorridorDestinationRecord, String> {
        match self {
            Self::Memory(store) => {
                let mut store = store.write().expect("lock");
                if !store.corridors.iter().any(|corridor| corridor.id == corridor_id) {
                    return Err(format!("unknown corridor id: {corridor_id}"));
                }
                if let Some(existing) = store
                    .destinations
                    .iter_mut()
                    .find(|item| item.corridor_id == corridor_id && item.address == request.address)
                {
                    existing.enabled = request.enabled;
                    existing.metadata = request.metadata;
                    return Ok(existing.clone());
                }
                store.next_destination_id += 1;
                let record = CorridorDestinationRecord {
                    id: store.next_destination_id,
                    corridor_id,
                    address: request.address,
                    enabled: request.enabled,
                    metadata: request.metadata,
                };
                store.destinations.push(record.clone());
                Ok(record)
            }
            Self::Postgres(store) => store.add_destination(corridor_id, request).await,
        }
    }

    async fn list_enabled_destinations(&self, corridor_id: u32) -> Vec<CorridorDestinationRecord> {
        match self {
            Self::Memory(store) => store
                .read()
                .expect("lock")
                .destinations
                .iter()
                .filter(|item| item.corridor_id == corridor_id && item.enabled)
                .cloned()
                .collect(),
            Self::Postgres(store) => store
                .list_enabled_destinations(corridor_id)
                .await
                .unwrap_or_default(),
        }
    }

    async fn find_destination(
        &self,
        corridor_id: u32,
        address: &str,
    ) -> Option<CorridorDestinationRecord> {
        match self {
            Self::Memory(store) => store
                .read()
                .expect("lock")
                .destinations
                .iter()
                .find(|item| item.corridor_id == corridor_id && item.address == address)
                .cloned(),
            Self::Postgres(store) => store.find_destination(corridor_id, address).await.ok().flatten(),
        }
    }

    async fn find_active_user_by_wallet(&self, wallet: &str) -> Option<IssuerUser> {
        match self {
            Self::Memory(store) => store
                .read()
                .expect("lock")
                .users
                .iter()
                .find(|user| user.wallet == wallet && user.enabled)
                .cloned(),
            Self::Postgres(store) => store.find_active_user_by_wallet(wallet).await.ok().flatten(),
        }
    }

    async fn find_active_credential(&self, user_id: i64) -> Option<IssuerCredentialRecord> {
        match self {
            Self::Memory(store) => store
                .read()
                .expect("lock")
                .credentials
                .iter()
                .find(|credential| credential.user_id == user_id && credential.enabled)
                .cloned(),
            Self::Postgres(store) => store.find_active_credential(user_id).await.ok().flatten(),
        }
    }

    async fn create_pending_root_snapshot(
        &self,
        corridor_id: u32,
        roots: &Roots,
    ) -> Result<RootSnapshotRecord, String> {
        match self {
            Self::Memory(store) => {
                let mut store = store.write().expect("lock");
                store.next_snapshot_id += 1;
                let record = RootSnapshotRecord {
                    id: store.next_snapshot_id,
                    corridor_id,
                    merkle_root: roots.merkle_root.clone(),
                    sanctions_root: roots.sanctions_root.clone(),
                    jurisdiction_root: roots.jurisdiction_root.clone(),
                    source_jurisdiction_root: roots.source_jurisdiction_root.clone(),
                    dest_address_root: roots.dest_address_root.clone(),
                    corridor_config_hash: roots.corridor_config_hash.clone(),
                    publish_status: "pending".into(),
                    publish_message: None,
                    created_at: now_unix(),
                    activated_at: None,
                };
                store.root_snapshots.push(record.clone());
                Ok(record)
            }
            Self::Postgres(store) => store.create_pending_root_snapshot(corridor_id, roots).await,
        }
    }

    async fn activate_root_snapshot(&self, id: i64, message: String) -> Result<(), String> {
        match self {
            Self::Memory(store) => {
                let mut store = store.write().expect("lock");
                let corridor_id = {
                    let snapshot = store
                        .root_snapshots
                        .iter_mut()
                        .find(|snapshot| snapshot.id == id)
                        .ok_or_else(|| format!("unknown snapshot id: {id}"))?;
                    snapshot.publish_status = "active".into();
                    snapshot.publish_message = Some(message);
                    snapshot.activated_at = Some(now_unix());
                    snapshot.corridor_id
                };
                for snapshot in &mut store.root_snapshots {
                    if snapshot.corridor_id == corridor_id
                        && snapshot.id != id
                        && snapshot.publish_status == "active"
                    {
                        snapshot.publish_status = "superseded".into();
                    }
                }
                Ok(())
            }
            Self::Postgres(store) => store.activate_root_snapshot(id, message).await,
        }
    }

    async fn fail_root_snapshot(&self, id: i64, message: String) -> Result<(), String> {
        match self {
            Self::Memory(store) => {
                let mut store = store.write().expect("lock");
                let snapshot = store
                    .root_snapshots
                    .iter_mut()
                    .find(|snapshot| snapshot.id == id)
                    .ok_or_else(|| format!("unknown snapshot id: {id}"))?;
                snapshot.publish_status = "failed".into();
                snapshot.publish_message = Some(message);
                Ok(())
            }
            Self::Postgres(store) => store.fail_root_snapshot(id, message).await,
        }
    }

    async fn latest_root_snapshot(&self, corridor_id: Option<u32>) -> Option<RootSnapshotRecord> {
        match self {
            Self::Memory(store) => store
                .read()
                .expect("lock")
                .root_snapshots
                .iter()
                .filter(|snapshot| corridor_id.is_none_or(|id| snapshot.corridor_id == id))
                .max_by_key(|snapshot| snapshot.id)
                .cloned(),
            Self::Postgres(store) => store.latest_root_snapshot(corridor_id).await.ok().flatten(),
        }
    }

    async fn store_webhook(
        &self,
        provider: &str,
        event_key: &str,
        payload: Value,
    ) -> Result<(WebhookEventRecord, bool), String> {
        match self {
            Self::Memory(store) => {
                let mut store = store.write().expect("lock");
                if let Some(existing) = store
                    .webhook_events
                    .iter()
                    .find(|event| event.provider == provider && event.event_key == event_key)
                    .cloned()
                {
                    return Ok((existing, true));
                }
                store.next_webhook_id += 1;
                let record = WebhookEventRecord {
                    id: store.next_webhook_id,
                    provider: provider.to_string(),
                    event_key: event_key.to_string(),
                    payload,
                    processed: true,
                };
                store.webhook_events.push(record.clone());
                Ok((record, false))
            }
            Self::Postgres(store) => store.store_webhook(provider, event_key, payload).await,
        }
    }

    async fn apply_normalized_event(
        &self,
        event: NormalizedProviderEvent,
    ) -> Result<IssuerUser, String> {
        match self {
            Self::Memory(store) => {
                let mut store = store.write().expect("lock");
                let user_index = store.users.iter().position(|user| user.wallet == event.wallet);
                let user_id = if let Some(index) = user_index {
                    let user = &mut store.users[index];
                    user.wallet = event.wallet.clone();
                    user.jurisdiction = event.jurisdiction.clone();
                    user.jurisdiction_code = event.jurisdiction_code;
                    user.credential_expiry = event.credential_expiry;
                    user.sanctions_clear = event.sanctions_clear;
                    user.enabled = event.enabled;
                    user.provider = Some(event.provider.clone());
                    user.provider_ref = Some(event.provider_ref.clone());
                    user.metadata = event.metadata.clone();
                    user.id
                } else {
                    store.next_user_id += 1;
                    let user_id = store.next_user_id;
                    store.users.push(IssuerUser {
                        id: user_id,
                        wallet: event.wallet.clone(),
                        jurisdiction: event.jurisdiction.clone(),
                        jurisdiction_code: event.jurisdiction_code,
                        credential_expiry: event.credential_expiry,
                        sanctions_clear: event.sanctions_clear,
                        enabled: event.enabled,
                        provider: Some(event.provider.clone()),
                        provider_ref: Some(event.provider_ref.clone()),
                        metadata: event.metadata.clone(),
                    });
                    user_id
                };

                if let Some(existing) = store
                    .credentials
                    .iter_mut()
                    .find(|credential| credential.user_id == user_id)
                {
                    existing.credential_secret = event.credential_secret.clone();
                    existing.enabled = event.enabled;
                } else {
                    store.next_credential_id += 1;
                    let credential_id = store.next_credential_id;
                    store.credentials.push(IssuerCredentialRecord {
                        id: credential_id,
                        user_id,
                        credential_secret: event.credential_secret.clone(),
                        enabled: event.enabled,
                    });
                }

                store
                    .users
                    .iter()
                    .find(|user| user.id == user_id)
                    .cloned()
                    .ok_or_else(|| "failed to persist user".to_string())
            }
            Self::Postgres(store) => store.apply_normalized_event(event).await,
        }
    }

    async fn export_demo_fixture(&self) -> DemoUsersFixture {
        let users = self.list_users().await;
        let corridors = self.list_corridors().await;
        let mut allowed: HashMap<u32, BTreeSet<String>> = HashMap::new();
        for destination in self
            .list_corridors()
            .await
            .into_iter()
            .map(|corridor| corridor.id)
            .flat_map(|corridor_id| futures_for_destinations(self, corridor_id))
        {
            allowed
                .entry(destination.corridor_id)
                .or_default()
                .insert(destination.address);
        }
        DemoUsersFixture {
            demo_only: false,
            users: users
                .into_iter()
                .map(|user| amoeba_types::DemoUser {
                    wallet_hex: user.wallet,
                    jurisdiction: user.jurisdiction,
                    jurisdiction_code: user.jurisdiction_code,
                    credential_expiry: user.credential_expiry,
                    sanctions_clear: user.sanctions_clear,
                    corridor_eligibility: corridor_eligibility(&user.metadata),
                })
                .collect(),
            corridors: corridors
                .into_iter()
                .map(|corridor| amoeba_types::DemoCorridor {
                    id: corridor.id,
                    name: corridor.name,
                    enabled: corridor.enabled,
                    allowed_destinations_hex: allowed
                        .remove(&corridor.id)
                        .unwrap_or_default()
                        .into_iter()
                        .collect(),
                })
                .collect(),
        }
    }

    async fn throttle_mock_kyc_wallet(&self, wallet_hex: &str, min_secs: i64) -> Result<(), String> {
        match self {
            Self::Memory(store) => {
                let mut store = store.write().expect("lock");
                let now = now_unix();
                if let Some(last) = store.mock_kyc_last_request.get(wallet_hex) {
                    if now - last < min_secs {
                        return Err("rate limited".into());
                    }
                }
                store
                    .mock_kyc_last_request
                    .insert(wallet_hex.to_string(), now);
                Ok(())
            }
            Self::Postgres(store) => store.throttle_mock_kyc_wallet(wallet_hex, min_secs).await,
        }
    }

    async fn insert_mock_kyc_challenge(&self, record: MockKycChallengeRecord) -> Result<(), String> {
        match self {
            Self::Memory(store) => {
                store.write().expect("lock").mock_kyc_challenges.push(record);
                Ok(())
            }
            Self::Postgres(store) => store.insert_mock_kyc_challenge(record).await,
        }
    }

    async fn get_mock_kyc_challenge_by_id(
        &self,
        challenge_id: &str,
    ) -> Result<Option<MockKycChallengeRecord>, String> {
        match self {
            Self::Memory(store) => Ok(store
                .read()
                .expect("lock")
                .mock_kyc_challenges
                .iter()
                .find(|item| item.id == challenge_id)
                .cloned()),
            Self::Postgres(store) => store.get_mock_kyc_challenge_by_id(challenge_id).await,
        }
    }

    async fn consume_mock_kyc_challenge(&self, challenge_id: &str) -> Result<(), String> {
        match self {
            Self::Memory(store) => {
                let mut store = store.write().expect("lock");
                let challenge = store
                    .mock_kyc_challenges
                    .iter_mut()
                    .find(|item| item.id == challenge_id)
                    .ok_or_else(|| "challenge not found".to_string())?;
                if challenge.consumed_at.is_some() {
                    return Err("challenge already consumed".into());
                }
                challenge.consumed_at = Some(now_unix());
                Ok(())
            }
            Self::Postgres(store) => store.consume_mock_kyc_challenge(challenge_id).await,
        }
    }

    async fn find_user_by_wallet(&self, wallet: &str) -> Result<Option<IssuerUser>, String> {
        match self {
            Self::Memory(store) => Ok(store
                .read()
                .expect("lock")
                .users
                .iter()
                .find(|user| user.wallet == wallet)
                .cloned()),
            Self::Postgres(store) => store.find_user_by_wallet(wallet).await,
        }
    }

    async fn find_credential_for_user(
        &self,
        user_id: i64,
    ) -> Result<Option<IssuerCredentialRecord>, String> {
        match self {
            Self::Memory(store) => Ok(store
                .read()
                .expect("lock")
                .credentials
                .iter()
                .find(|credential| credential.user_id == user_id)
                .cloned()),
            Self::Postgres(store) => store.find_credential_for_user(user_id).await,
        }
    }

    async fn upsert_mock_kyc_user(
        &self,
        wallet_hex: &str,
        jurisdiction: &str,
        jurisdiction_code: u32,
        credential_expiry: u64,
        sanctions_clear: bool,
        enabled: bool,
        provider: &str,
        provider_ref: &str,
        metadata: Value,
        create_credential: bool,
    ) -> Result<IssuerUser, String> {
        match self {
            Self::Memory(store) => {
                let mut store = store.write().expect("lock");
                if let Some(existing) = store
                    .users
                    .iter()
                    .find(|user| user.wallet == wallet_hex)
                    .cloned()
                {
                    if existing.enabled
                        && existing.sanctions_clear
                        && existing.provider.as_deref() == Some("mock")
                        && create_credential
                    {
                        return Ok(existing);
                    }
                }

                let user = if let Some(index) =
                    store.users.iter().position(|u| u.wallet == wallet_hex)
                {
                    let user = &mut store.users[index];
                    user.jurisdiction = jurisdiction.to_string();
                    user.jurisdiction_code = jurisdiction_code;
                    user.credential_expiry = credential_expiry;
                    user.sanctions_clear = sanctions_clear;
                    user.enabled = enabled;
                    user.provider = Some(provider.to_string());
                    user.provider_ref = Some(provider_ref.to_string());
                    user.metadata = metadata;
                    user.clone()
                } else {
                    store.next_user_id += 1;
                    let user = IssuerUser {
                        id: store.next_user_id,
                        wallet: wallet_hex.to_string(),
                        jurisdiction: jurisdiction.to_string(),
                        jurisdiction_code,
                        credential_expiry,
                        sanctions_clear,
                        enabled,
                        provider: Some(provider.to_string()),
                        provider_ref: Some(provider_ref.to_string()),
                        metadata,
                    };
                    store.users.push(user.clone());
                    user
                };

                if create_credential {
                    if let Some(credential) = store
                        .credentials
                        .iter_mut()
                        .find(|credential| credential.user_id == user.id)
                    {
                        credential.enabled = true;
                    } else {
                        store.next_credential_id += 1;
                        let credential_id = store.next_credential_id;
                        store.credentials.push(IssuerCredentialRecord {
                            id: credential_id,
                            user_id: user.id,
                            credential_secret: MOCK_CREDENTIAL_SECRET.to_string(),
                            enabled: true,
                        });
                    }
                }

                Ok(user)
            }
            Self::Postgres(store) => {
                store
                    .upsert_mock_kyc_user(
                        wallet_hex,
                        jurisdiction,
                        jurisdiction_code,
                        credential_expiry,
                        sanctions_clear,
                        enabled,
                        provider,
                        provider_ref,
                        metadata,
                        create_credential,
                    )
                    .await
            }
        }
    }
}

fn futures_for_destinations(
    repo: &Repository,
    corridor_id: u32,
) -> Vec<CorridorDestinationRecord> {
    match repo {
        Repository::Memory(store) => store
            .read()
            .expect("lock")
            .destinations
            .iter()
            .filter(|item| item.corridor_id == corridor_id && item.enabled)
            .cloned()
            .collect(),
        Repository::Postgres(_) => Vec::new(),
    }
}

impl PostgresStore {
    async fn connect(db_url: &str) -> Result<Self, String> {
        let (client, connection) = tokio_postgres::connect(db_url, NoTls)
            .await
            .map_err(|err| err.to_string())?;
        tokio::spawn(async move {
            if let Err(err) = connection.await {
                tracing::error!("supabase postgres connection error: {err}");
            }
        });
        Ok(Self { client })
    }

    async fn user_count(&self) -> Result<usize, String> {
        let row = self
            .client
            .query_one("select count(*) from issuer_users", &[])
            .await
            .map_err(|err| err.to_string())?;
        Ok(row.get::<_, i64>(0) as usize)
    }

    async fn corridor_count(&self) -> Result<usize, String> {
        let row = self
            .client
            .query_one("select count(*) from corridors", &[])
            .await
            .map_err(|err| err.to_string())?;
        Ok(row.get::<_, i64>(0) as usize)
    }

    async fn seed_demo_data(
        &self,
        users_fixture: &DemoUsersFixture,
        transfer: Option<&DemoTransferFixture>,
    ) -> Result<(), String> {
        let fallback_asset = transfer
            .map(|item| item.asset_hex.clone())
            .unwrap_or_else(default_asset_hex);
        let issuer = transfer.and_then(|item| item.issuer_strkey.clone());
        for corridor in corridor_options(users_fixture) {
            self.client
                .execute(
                    "insert into corridors (
                        id, name, source_country, dest_country, enabled, asset_hex, issuer_strkey, travel_rule_threshold
                     ) values ($1,$2,$3,$4,$5,$6,$7,'0')
                     on conflict (id) do update
                     set name = excluded.name,
                         source_country = excluded.source_country,
                         dest_country = excluded.dest_country,
                         enabled = excluded.enabled,
                         asset_hex = excluded.asset_hex,
                         issuer_strkey = excluded.issuer_strkey",
                    &[
                        &(corridor.id as i32),
                        &corridor.name,
                        &corridor.source_country,
                        &corridor.dest_country,
                        &corridor.enabled,
                        &fallback_asset,
                        &issuer,
                    ],
                )
                .await
                .map_err(|err| err.to_string())?;
        }
        for corridor in &users_fixture.corridors {
            for address in &corridor.allowed_destinations_hex {
                self.ensure_corridor_destination(corridor.id, address).await?;
            }
        }
        if let Some(transfer) = transfer {
            self.ensure_corridor_destination(transfer.corridor_id, &transfer.recipient_hex)
                .await?;
        }
        Ok(())
    }

    async fn ensure_corridor_destination(
        &self,
        corridor_id: u32,
        address: &str,
    ) -> Result<(), String> {
        self.client
            .execute(
                "insert into corridor_destinations (corridor_id, address, enabled, metadata)
                 values ($1,$2,true,'{}'::jsonb)
                 on conflict (corridor_id, address) do update set enabled = true",
                &[&(corridor_id as i32), &address],
            )
            .await
            .map_err(|err| err.to_string())?;
        Ok(())
    }

    async fn get_user_credential(&self, wallet: &str) -> Result<Option<Credential>, String> {
        let row = self
            .client
            .query_opt(
                "select wallet, jurisdiction, credential_expiry, sanctions_clear, metadata
                 from issuer_users
                 where wallet = $1 and enabled = true",
                &[&wallet],
            )
            .await
            .map_err(|err| err.to_string())?;
        Ok(row.map(|row| Credential {
            wallet: row.get(0),
            jurisdiction: row.get(1),
            credential_expiry: row.get::<_, i64>(2) as u64,
            sanctions_clear: row.get(3),
            corridor_eligibility: corridor_eligibility(&row.get::<_, Value>(4)),
            credential_commitment: None,
        }))
    }

    async fn get_corridor(&self, id: u32) -> Result<Option<CorridorRecord>, String> {
        let row = self
            .client
            .query_opt(
                "select id, name, source_country, dest_country, enabled, asset_hex, issuer_strkey, travel_rule_threshold
                 from corridors where id = $1",
                &[&(id as i32)],
            )
            .await
            .map_err(|err| err.to_string())?;
        Ok(row.map(parse_corridor_row))
    }

    async fn list_users(&self) -> Result<Vec<IssuerUser>, String> {
        let rows = self
            .client
            .query(
                "select id, wallet, jurisdiction, jurisdiction_code, credential_expiry, sanctions_clear,
                        enabled, provider, provider_ref, metadata
                 from issuer_users
                 order by id asc",
                &[],
            )
            .await
            .map_err(|err| err.to_string())?;
        Ok(rows.into_iter().map(parse_user_row).collect())
    }

    async fn update_user(&self, id: i64, patch: UserPatch) -> Result<IssuerUser, String> {
        let current = self
            .client
            .query_opt(
                "select id, wallet, jurisdiction, jurisdiction_code, credential_expiry, sanctions_clear,
                        enabled, provider, provider_ref, metadata
                 from issuer_users where id = $1",
                &[&id],
            )
            .await
            .map_err(|err| err.to_string())?
            .ok_or_else(|| format!("unknown user id: {id}"))?;
        let mut user = parse_user_row(current);
        if let Some(value) = patch.enabled {
            user.enabled = value;
        }
        if let Some(value) = patch.sanctions_clear {
            user.sanctions_clear = value;
        }
        if let Some(value) = patch.credential_expiry {
            user.credential_expiry = value;
        }
        if let Some(value) = patch.jurisdiction {
            user.jurisdiction = value;
        }
        if let Some(value) = patch.jurisdiction_code {
            user.jurisdiction_code = value;
        }
        if let Some(value) = patch.wallet {
            user.wallet = value;
        }
        let row = self
            .client
            .query_one(
                "update issuer_users
                 set wallet = $2, jurisdiction = $3, jurisdiction_code = $4,
                     credential_expiry = $5, sanctions_clear = $6, enabled = $7
                 where id = $1
                 returning id, wallet, jurisdiction, jurisdiction_code, credential_expiry,
                           sanctions_clear, enabled, provider, provider_ref, metadata",
                &[
                    &id,
                    &user.wallet,
                    &user.jurisdiction,
                    &(user.jurisdiction_code as i32),
                    &(user.credential_expiry as i64),
                    &user.sanctions_clear,
                    &user.enabled,
                ],
            )
            .await
            .map_err(|err| err.to_string())?;
        Ok(parse_user_row(row))
    }

    async fn list_corridors(&self) -> Result<Vec<CorridorRecord>, String> {
        let rows = self
            .client
            .query(
                "select id, name, source_country, dest_country, enabled, asset_hex, issuer_strkey, travel_rule_threshold
                 from corridors
                 order by id asc",
                &[],
            )
            .await
            .map_err(|err| err.to_string())?;
        Ok(rows.into_iter().map(parse_corridor_row).collect())
    }

    async fn update_corridor(&self, id: u32, patch: CorridorPatch) -> Result<CorridorRecord, String> {
        let current = self
            .get_corridor(id)
            .await?
            .ok_or_else(|| format!("unknown corridor id: {id}"))?;
        let corridor = CorridorRecord {
            id,
            name: patch.name.unwrap_or(current.name),
            source_country: patch.source_country.unwrap_or(current.source_country),
            dest_country: patch.dest_country.unwrap_or(current.dest_country),
            enabled: patch.enabled.unwrap_or(current.enabled),
            asset_hex: patch.asset_hex.unwrap_or(current.asset_hex),
            issuer_strkey: patch.issuer_strkey.or(current.issuer_strkey),
            travel_rule_threshold: patch
                .travel_rule_threshold
                .unwrap_or(current.travel_rule_threshold),
        };
        let row = self
            .client
            .query_one(
                "update corridors
                 set name = $2, source_country = $3, dest_country = $4, enabled = $5,
                     asset_hex = $6, issuer_strkey = $7, travel_rule_threshold = $8
                 where id = $1
                 returning id, name, source_country, dest_country, enabled, asset_hex, issuer_strkey, travel_rule_threshold",
                &[
                    &(id as i32),
                    &corridor.name,
                    &corridor.source_country,
                    &corridor.dest_country,
                    &corridor.enabled,
                    &corridor.asset_hex,
                    &corridor.issuer_strkey,
                    &corridor.travel_rule_threshold,
                ],
            )
            .await
            .map_err(|err| err.to_string())?;
        Ok(parse_corridor_row(row))
    }

    async fn add_destination(
        &self,
        corridor_id: u32,
        request: DestinationCreate,
    ) -> Result<CorridorDestinationRecord, String> {
        let row = self
            .client
            .query_one(
                "insert into corridor_destinations (corridor_id, address, enabled, metadata)
                 values ($1,$2,$3,$4)
                 on conflict (corridor_id, address) do update
                 set enabled = excluded.enabled, metadata = excluded.metadata
                 returning id, corridor_id, address, enabled, metadata",
                &[
                    &(corridor_id as i32),
                    &request.address,
                    &request.enabled,
                    &request.metadata,
                ],
            )
            .await
            .map_err(|err| err.to_string())?;
        Ok(parse_destination_row(row))
    }

    async fn list_enabled_destinations(
        &self,
        corridor_id: u32,
    ) -> Result<Vec<CorridorDestinationRecord>, String> {
        let rows = self
            .client
            .query(
                "select id, corridor_id, address, enabled, metadata
                 from corridor_destinations
                 where corridor_id = $1 and enabled = true
                 order by address asc",
                &[&(corridor_id as i32)],
            )
            .await
            .map_err(|err| err.to_string())?;
        Ok(rows.into_iter().map(parse_destination_row).collect())
    }

    async fn find_destination(
        &self,
        corridor_id: u32,
        address: &str,
    ) -> Result<Option<CorridorDestinationRecord>, String> {
        let row = self
            .client
            .query_opt(
                "select id, corridor_id, address, enabled, metadata
                 from corridor_destinations
                 where corridor_id = $1 and address = $2",
                &[&(corridor_id as i32), &address],
            )
            .await
            .map_err(|err| err.to_string())?;
        Ok(row.map(parse_destination_row))
    }

    async fn find_active_user_by_wallet(&self, wallet: &str) -> Result<Option<IssuerUser>, String> {
        let row = self
            .client
            .query_opt(
                "select id, wallet, jurisdiction, jurisdiction_code, credential_expiry, sanctions_clear,
                        enabled, provider, provider_ref, metadata
                 from issuer_users
                 where wallet = $1 and enabled = true",
                &[&wallet],
            )
            .await
            .map_err(|err| err.to_string())?;
        Ok(row.map(parse_user_row))
    }

    async fn find_active_credential(
        &self,
        user_id: i64,
    ) -> Result<Option<IssuerCredentialRecord>, String> {
        let row = self
            .client
            .query_opt(
                "select id, user_id, credential_secret, enabled
                 from issuer_credentials
                 where user_id = $1 and enabled = true",
                &[&user_id],
            )
            .await
            .map_err(|err| err.to_string())?;
        Ok(row.map(parse_credential_row))
    }

    async fn create_pending_root_snapshot(
        &self,
        corridor_id: u32,
        roots: &Roots,
    ) -> Result<RootSnapshotRecord, String> {
        let row = self
            .client
            .query_one(
                "insert into root_snapshots (
                    corridor_id, merkle_root, sanctions_root, jurisdiction_root,
                    source_jurisdiction_root, dest_address_root, corridor_config_hash,
                    publish_status, created_at
                 ) values ($1,$2,$3,$4,$5,$6,$7,'pending',$8)
                 returning id, corridor_id, merkle_root, sanctions_root, jurisdiction_root,
                           source_jurisdiction_root, dest_address_root, corridor_config_hash,
                           publish_status, publish_message, created_at, activated_at",
                &[
                    &(corridor_id as i32),
                    &roots.merkle_root,
                    &roots.sanctions_root,
                    &roots.jurisdiction_root,
                    &roots.source_jurisdiction_root,
                    &roots.dest_address_root,
                    &roots.corridor_config_hash,
                    &now_unix(),
                ],
            )
            .await
            .map_err(|err| err.to_string())?;
        Ok(parse_snapshot_row(row))
    }

    async fn activate_root_snapshot(&self, id: i64, message: String) -> Result<(), String> {
        let corridor_row = self
            .client
            .query_one(
                "update root_snapshots
                 set publish_status = 'active', publish_message = $2, activated_at = $3
                 where id = $1
                 returning corridor_id",
                &[&id, &message, &now_unix()],
            )
            .await
            .map_err(|err| err.to_string())?;
        let corridor_id = corridor_row.get::<_, i32>(0);
        self.client
            .execute(
                "update root_snapshots
                 set publish_status = 'superseded'
                 where corridor_id = $1 and id <> $2 and publish_status = 'active'",
                &[&corridor_id, &id],
            )
            .await
            .map_err(|err| err.to_string())?;
        Ok(())
    }

    async fn fail_root_snapshot(&self, id: i64, message: String) -> Result<(), String> {
        self.client
            .execute(
                "update root_snapshots
                 set publish_status = 'failed', publish_message = $2
                 where id = $1",
                &[&id, &message],
            )
            .await
            .map_err(|err| err.to_string())?;
        Ok(())
    }

    async fn latest_root_snapshot(
        &self,
        corridor_id: Option<u32>,
    ) -> Result<Option<RootSnapshotRecord>, String> {
        let row = if let Some(corridor_id) = corridor_id {
            self.client
                .query_opt(
                    "select id, corridor_id, merkle_root, sanctions_root, jurisdiction_root,
                            source_jurisdiction_root, dest_address_root, corridor_config_hash,
                            publish_status, publish_message, created_at, activated_at
                     from root_snapshots
                     where corridor_id = $1
                     order by id desc
                     limit 1",
                    &[&(corridor_id as i32)],
                )
                .await
        } else {
            self.client
                .query_opt(
                    "select id, corridor_id, merkle_root, sanctions_root, jurisdiction_root,
                            source_jurisdiction_root, dest_address_root, corridor_config_hash,
                            publish_status, publish_message, created_at, activated_at
                     from root_snapshots
                     order by id desc
                     limit 1",
                    &[],
                )
                .await
        }
        .map_err(|err| err.to_string())?;
        Ok(row.map(parse_snapshot_row))
    }

    async fn store_webhook(
        &self,
        provider: &str,
        event_key: &str,
        payload: Value,
    ) -> Result<(WebhookEventRecord, bool), String> {
        let row = self
            .client
            .query_one(
                "insert into webhook_events (provider, event_key, payload, processed, created_at)
                 values ($1,$2,$3,true,$4)
                 on conflict (provider, event_key) do update set provider = excluded.provider
                 returning id, provider, event_key, payload, processed, (xmax <> 0) as existed",
                &[&provider, &event_key, &payload, &now_unix()],
            )
            .await
            .map_err(|err| err.to_string())?;
        let existed = row.get::<_, bool>(5);
        Ok((
            WebhookEventRecord {
                id: row.get(0),
                provider: row.get(1),
                event_key: row.get(2),
                payload: row.get(3),
                processed: row.get(4),
            },
            existed,
        ))
    }

    async fn apply_normalized_event(
        &self,
        event: NormalizedProviderEvent,
    ) -> Result<IssuerUser, String> {
        let user_row = self
            .client
            .query_one(
                "insert into issuer_users (
                    wallet, jurisdiction, jurisdiction_code, credential_expiry, sanctions_clear,
                    enabled, provider, provider_ref, metadata
                 ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                 on conflict (wallet) do update
                 set jurisdiction = excluded.jurisdiction,
                     jurisdiction_code = excluded.jurisdiction_code,
                     credential_expiry = excluded.credential_expiry,
                     sanctions_clear = excluded.sanctions_clear,
                     enabled = excluded.enabled,
                     provider = excluded.provider,
                     provider_ref = excluded.provider_ref,
                     metadata = excluded.metadata
                 returning id, wallet, jurisdiction, jurisdiction_code, credential_expiry,
                           sanctions_clear, enabled, provider, provider_ref, metadata",
                &[
                    &event.wallet,
                    &event.jurisdiction,
                    &(event.jurisdiction_code as i32),
                    &(event.credential_expiry as i64),
                    &event.sanctions_clear,
                    &event.enabled,
                    &event.provider,
                    &event.provider_ref,
                    &event.metadata,
                ],
            )
            .await
            .map_err(|err| err.to_string())?;
        let user = parse_user_row(user_row);
        self.client
            .execute(
                "insert into issuer_credentials (user_id, credential_secret, enabled)
                 values ($1,$2,$3)
                 on conflict (user_id) do update
                 set credential_secret = excluded.credential_secret,
                     enabled = excluded.enabled",
                &[&user.id, &event.credential_secret, &event.enabled],
            )
            .await
            .map_err(|err| err.to_string())?;
        Ok(user)
    }

    async fn throttle_mock_kyc_wallet(&self, wallet_hex: &str, min_secs: i64) -> Result<(), String> {
        let row = self
            .client
            .query_opt(
                "select exists(
                    select 1 from mock_kyc_challenges
                    where wallet_hex = $1 and created_at > now() - make_interval(secs => $2)
                 )",
                &[&wallet_hex, &(min_secs as f64)],
            )
            .await
            .map_err(|err| err.to_string())?;
        if row.map(|r| r.get::<_, bool>(0)).unwrap_or(false) {
            return Err("rate limited".into());
        }
        Ok(())
    }

    async fn insert_mock_kyc_challenge(
        &self,
        record: crate::mock_kyc::MockKycChallengeRecord,
    ) -> Result<(), String> {
        self.client
            .execute(
                "insert into mock_kyc_challenges (id, wallet_hex, challenge_xdr, nonce, expires_at)
                 values ($1::uuid, $2, $3, $4, to_timestamp($5))",
                &[
                    &record.id,
                    &record.wallet_hex,
                    &record.challenge_xdr,
                    &record.nonce,
                    &(record.expires_at as f64),
                ],
            )
            .await
            .map_err(|err| err.to_string())?;
        Ok(())
    }

    async fn get_mock_kyc_challenge(
        &self,
        wallet_hex: &str,
        challenge_id: &str,
    ) -> Result<Option<crate::mock_kyc::MockKycChallengeRecord>, String> {
        self.get_mock_kyc_challenge_by_id(challenge_id)
            .await
            .map(|record| record.filter(|item| item.wallet_hex == wallet_hex))
    }

    async fn get_mock_kyc_challenge_by_id(
        &self,
        challenge_id: &str,
    ) -> Result<Option<crate::mock_kyc::MockKycChallengeRecord>, String> {
        let row = self
            .client
            .query_opt(
                "select id::text, wallet_hex, challenge_xdr, nonce,
                        extract(epoch from expires_at)::bigint,
                        extract(epoch from consumed_at)
                 from mock_kyc_challenges where id = $1::uuid",
                &[&challenge_id],
            )
            .await
            .map_err(|err| err.to_string())?;
        Ok(row.map(parse_mock_kyc_challenge_row))
    }

    async fn consume_mock_kyc_challenge(&self, challenge_id: &str) -> Result<(), String> {
        let updated = self
            .client
            .execute(
                "update mock_kyc_challenges
                 set consumed_at = now()
                 where id = $1::uuid and consumed_at is null",
                &[&challenge_id],
            )
            .await
            .map_err(|err| err.to_string())?;
        if updated == 0 {
            return Err("challenge already consumed".into());
        }
        Ok(())
    }

    async fn find_user_by_wallet(&self, wallet: &str) -> Result<Option<IssuerUser>, String> {
        let row = self
            .client
            .query_opt(
                "select id, wallet, jurisdiction, jurisdiction_code, credential_expiry,
                        sanctions_clear, enabled, provider, provider_ref, metadata
                 from issuer_users where wallet = $1",
                &[&wallet],
            )
            .await
            .map_err(|err| err.to_string())?;
        Ok(row.map(parse_user_row))
    }

    async fn find_credential_for_user(
        &self,
        user_id: i64,
    ) -> Result<Option<IssuerCredentialRecord>, String> {
        let row = self
            .client
            .query_opt(
                "select id, user_id, credential_secret, enabled
                 from issuer_credentials where user_id = $1",
                &[&user_id],
            )
            .await
            .map_err(|err| err.to_string())?;
        Ok(row.map(|row| IssuerCredentialRecord {
            id: row.get(0),
            user_id: row.get(1),
            credential_secret: row.get(2),
            enabled: row.get(3),
        }))
    }

    async fn upsert_mock_kyc_user(
        &self,
        wallet_hex: &str,
        jurisdiction: &str,
        jurisdiction_code: u32,
        credential_expiry: u64,
        sanctions_clear: bool,
        enabled: bool,
        provider: &str,
        provider_ref: &str,
        metadata: Value,
        create_credential: bool,
    ) -> Result<IssuerUser, String> {
        if let Some(existing) = self.find_user_by_wallet(wallet_hex).await? {
            if existing.enabled
                && existing.sanctions_clear
                && existing.provider.as_deref() == Some("mock")
                && create_credential
            {
                return Ok(existing);
            }
        }

        let user_row = self
            .client
            .query_one(
                "insert into issuer_users (
                    wallet, jurisdiction, jurisdiction_code, credential_expiry, sanctions_clear,
                    enabled, provider, provider_ref, metadata
                 ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                 on conflict (wallet) do update
                 set jurisdiction = excluded.jurisdiction,
                     jurisdiction_code = excluded.jurisdiction_code,
                     credential_expiry = excluded.credential_expiry,
                     sanctions_clear = excluded.sanctions_clear,
                     enabled = excluded.enabled,
                     provider = excluded.provider,
                     provider_ref = excluded.provider_ref,
                     metadata = excluded.metadata
                 returning id, wallet, jurisdiction, jurisdiction_code, credential_expiry,
                           sanctions_clear, enabled, provider, provider_ref, metadata",
                &[
                    &wallet_hex,
                    &jurisdiction,
                    &(jurisdiction_code as i32),
                    &(credential_expiry as i64),
                    &sanctions_clear,
                    &enabled,
                    &provider,
                    &provider_ref,
                    &metadata,
                ],
            )
            .await
            .map_err(|err| err.to_string())?;
        let user = parse_user_row(user_row);

        if create_credential {
            self.client
                .execute(
                    "insert into issuer_credentials (user_id, credential_secret, enabled)
                     values ($1,$2,true)
                     on conflict (user_id) do update set enabled = true",
                    &[&user.id, &crate::mock_kyc::MOCK_CREDENTIAL_SECRET],
                )
                .await
                .map_err(|err| err.to_string())?;
        }

        Ok(user)
    }
}

fn parse_mock_kyc_challenge_row(row: Row) -> crate::mock_kyc::MockKycChallengeRecord {
    crate::mock_kyc::MockKycChallengeRecord {
        id: row.get(0),
        wallet_hex: row.get(1),
        challenge_xdr: row.get(2),
        nonce: row.get(3),
        expires_at: row.get::<_, i64>(4),
        consumed_at: row.get::<_, Option<i64>>(5),
        wallet_strkey: wallet_strkey_from_row_hex(row.get(1)),
    }
}

fn wallet_strkey_from_row_hex(wallet_hex: String) -> String {
    crate::mock_kyc::wallet_strkey_from_hex(&wallet_hex).unwrap_or(wallet_hex)
}

fn parse_user_row(row: Row) -> IssuerUser {
    IssuerUser {
        id: row.get(0),
        wallet: row.get(1),
        jurisdiction: row.get(2),
        jurisdiction_code: row.get::<_, i32>(3) as u32,
        credential_expiry: row.get::<_, i64>(4) as u64,
        sanctions_clear: row.get(5),
        enabled: row.get(6),
        provider: row.get(7),
        provider_ref: row.get(8),
        metadata: row.get(9),
    }
}

fn parse_corridor_row(row: Row) -> CorridorRecord {
    CorridorRecord {
        id: row.get::<_, i32>(0) as u32,
        name: row.get(1),
        source_country: row.get(2),
        dest_country: row.get(3),
        enabled: row.get(4),
        asset_hex: row.get(5),
        issuer_strkey: row.get(6),
        travel_rule_threshold: row.get(7),
    }
}

fn parse_destination_row(row: Row) -> CorridorDestinationRecord {
    CorridorDestinationRecord {
        id: row.get(0),
        corridor_id: row.get::<_, i32>(1) as u32,
        address: row.get(2),
        enabled: row.get(3),
        metadata: row.get(4),
    }
}

fn parse_credential_row(row: Row) -> IssuerCredentialRecord {
    IssuerCredentialRecord {
        id: row.get(0),
        user_id: row.get(1),
        credential_secret: row.get(2),
        enabled: row.get(3),
    }
}

fn parse_snapshot_row(row: Row) -> RootSnapshotRecord {
    RootSnapshotRecord {
        id: row.get(0),
        corridor_id: row.get::<_, i32>(1) as u32,
        merkle_root: row.get(2),
        sanctions_root: row.get(3),
        jurisdiction_root: row.get(4),
        source_jurisdiction_root: row.get(5),
        dest_address_root: row.get(6),
        corridor_config_hash: row.get(7),
        publish_status: row.get(8),
        publish_message: row.get(9),
        created_at: row.get(10),
        activated_at: row.get(11),
    }
}

fn load_demo_transfer(cfg: &Config) -> Option<DemoTransferFixture> {
    let filename = cfg.demo_transfer_filename();
    let path = Path::new(&cfg.fixtures_dir).join(filename);
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn load_demo_users(cfg: &Config) -> Option<DemoUsersFixture> {
    let path = Path::new(&cfg.fixtures_dir).join("demo-users.json");
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn load_demo_transfer_fixture_template() -> DemoTransferFixture {
    DemoTransferFixture {
        demo_only: false,
        credential_secret: "424242".into(),
        corridor_id: 1,
        sender_hex: "00112233445566778899aabbccddeeff1032547698badcfeefcdab8967452301".into(),
        recipient_hex: "102132435465768798a9babbdcedfe0f0f1e2d3c4b5a69788796a5b4c3d2e1f0".into(),
        asset_hex: default_asset_hex(),
        amount: "10000000".into(),
        epoch: "0".into(),
        jurisdiction: "840".into(),
        credential_expiry: "2000000000".into(),
        sender_strkey: None,
        recipient_strkey: None,
        asset_strkey: None,
        issuer_strkey: None,
        source_country: Some("US".into()),
        dest_country: Some("MX".into()),
    }
}

fn default_asset_hex() -> String {
    "ffeeddccbbaa998877665544332211000123456789abcdeffedcba9876543210".into()
}

fn corridor_eligibility(metadata: &Value) -> Vec<u32> {
    metadata
        .get("corridor_eligibility")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_u64)
                .map(|value| value as u32)
                .collect()
        })
        .unwrap_or_default()
}

fn hash_to_u64(s: &str) -> u64 {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut h = DefaultHasher::new();
    s.hash(&mut h);
    h.finish()
}

pub(crate) fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time before unix epoch")
        .as_secs() as i64
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::Config;

    fn test_cfg() -> Config {
        Config {
            listen_addr: "127.0.0.1:3000".into(),
            state_path: None,
            api_token: Some("test-token".into()),
            webhook_secrets: vec![("persona".into(), "shh".into())],
            supabase_url: None,
            supabase_service_role_key: None,
            supabase_db_url: None,
            rpc_url: String::new(),
            network_passphrase: String::new(),
            compliance_id: None,
            issuer_public_key: None,
            admin_public_key: None,
            admin_secret_key: None,
            issuer_secret_key: None,
            publish_source_account: None,
            fixtures_dir: concat!(env!("CARGO_MANIFEST_DIR"), "/../../../bindings/fixtures").into(),
            fixture_profile: "local".into(),
        }
    }

    #[tokio::test]
    async fn seed_and_generate_proof_package() {
        let cfg = test_cfg();
        let state = AppState::load(&cfg).await;
        state
            .apply_webhook_event(
                "fixture",
                "demo-user",
                json!({
                    "wallet_hex": "00112233445566778899aabbccddeeff1032547698badcfeefcdab8967452301",
                    "jurisdiction": "US",
                    "jurisdiction_code": 840,
                    "credential_expiry": 2000000000u64,
                    "sanctions_clear": true,
                    "enabled": true,
                    "credential_secret": "424242",
                }),
            )
            .await
            .expect("seed user");
        let req = state.bootstrap_request(&cfg).await.expect("bootstrap request");
        let proof = state.create_proof_package(&req).await.expect("proof");
        assert_eq!(proof.transfer.corridor_id, 1);
        assert_eq!(proof.transfer.sender, req.sender_wallet);
    }

    #[tokio::test]
    async fn webhook_replay_is_idempotent() {
        let cfg = test_cfg();
        let state = AppState::load(&cfg).await;
        let payload = json!({
            "id": "evt_123",
            "wallet": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "jurisdiction": "US",
            "jurisdiction_code": 840,
            "credential_expiry": 2000000000u64,
            "sanctions_clear": true,
            "enabled": true,
            "credential_secret": "555",
        });
        let (_, existed1) = state
            .store_webhook("persona", "evt_123", payload.clone())
            .await
            .expect("store");
        let (_, existed2) = state
            .store_webhook("persona", "evt_123", payload)
            .await
            .expect("store replay");
        assert!(!existed1);
        assert!(existed2);
    }
}
