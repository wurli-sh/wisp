use std::sync::RwLock;

use async_trait::async_trait;
use serde_json::Value;
use wisp_types::Roots;

use crate::model::*;
use crate::ports::IssuerRepository;
#[derive(Debug, Default)]
pub struct InMemoryIssuerRepository {
    inner: RwLock<InMemoryStore>,
}

#[derive(Debug, Default)]
struct InMemoryStore {
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
}

impl InMemoryIssuerRepository {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn seed_corridor(&self, corridor: CorridorRecord) {
        self.inner.write().expect("lock").corridors.push(corridor);
    }

    pub fn seed_destination(&self, corridor_id: u32, address: &str) {
        let mut store = self.inner.write().expect("lock");
        store.next_destination_id += 1;
        let id = store.next_destination_id;
        store.destinations.push(CorridorDestinationRecord {
            id,
            corridor_id,
            address: address.to_string(),
            enabled: true,
            metadata: Value::Null,
        });
    }
}

#[async_trait]
impl IssuerRepository for InMemoryIssuerRepository {
    async fn list_users(&self) -> Result<Vec<IssuerUser>, String> {
        Ok(self.inner.read().expect("lock").users.clone())
    }

    async fn list_corridors(&self) -> Result<Vec<CorridorRecord>, String> {
        Ok(self.inner.read().expect("lock").corridors.clone())
    }

    async fn get_corridor(&self, id: u32) -> Result<Option<CorridorRecord>, String> {
        Ok(self
            .inner
            .read()
            .expect("lock")
            .corridors
            .iter()
            .find(|corridor| corridor.id == id)
            .cloned())
    }

    async fn find_active_user_by_wallet(&self, wallet: &str) -> Result<Option<IssuerUser>, String> {
        Ok(self
            .inner
            .read()
            .expect("lock")
            .users
            .iter()
            .find(|user| user.wallet == wallet && user.enabled)
            .cloned())
    }

    async fn find_active_credential(
        &self,
        user_id: i64,
    ) -> Result<Option<IssuerCredentialRecord>, String> {
        Ok(self
            .inner
            .read()
            .expect("lock")
            .credentials
            .iter()
            .find(|credential| credential.user_id == user_id && credential.enabled)
            .cloned())
    }

    async fn list_enabled_destinations(
        &self,
        corridor_id: u32,
    ) -> Result<Vec<CorridorDestinationRecord>, String> {
        Ok(self
            .inner
            .read()
            .expect("lock")
            .destinations
            .iter()
            .filter(|item| item.corridor_id == corridor_id && item.enabled)
            .cloned()
            .collect())
    }

    async fn find_destination(
        &self,
        corridor_id: u32,
        address: &str,
    ) -> Result<Option<CorridorDestinationRecord>, String> {
        Ok(self
            .inner
            .read()
            .expect("lock")
            .destinations
            .iter()
            .find(|item| item.corridor_id == corridor_id && item.address == address)
            .cloned())
    }

    async fn latest_root_snapshot(
        &self,
        corridor_id: Option<u32>,
    ) -> Result<Option<RootSnapshotRecord>, String> {
        Ok(self
            .inner
            .read()
            .expect("lock")
            .root_snapshots
            .iter()
            .filter(|snapshot| corridor_id.is_none_or(|id| snapshot.corridor_id == id))
            .max_by_key(|snapshot| snapshot.id)
            .cloned())
    }

    async fn create_pending_root_snapshot(
        &self,
        corridor_id: u32,
        roots: &Roots,
        now: i64,
    ) -> Result<RootSnapshotRecord, String> {
        let mut store = self.inner.write().expect("lock");
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
            compliance_contract_id: None,
            created_at: now,
            activated_at: None,
        };
        store.root_snapshots.push(record.clone());
        Ok(record)
    }

    async fn activate_root_snapshot(
        &self,
        id: i64,
        message: String,
        compliance_contract_id: Option<String>,
        now: i64,
    ) -> Result<(), String> {
        let mut store = self.inner.write().expect("lock");
        let corridor_id = {
            let snapshot = store
                .root_snapshots
                .iter_mut()
                .find(|snapshot| snapshot.id == id)
                .ok_or_else(|| format!("unknown snapshot id: {id}"))?;
            snapshot.publish_status = "active".into();
            snapshot.publish_message = Some(message);
            snapshot.compliance_contract_id = compliance_contract_id;
            snapshot.activated_at = Some(now);
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

    async fn fail_root_snapshot(&self, id: i64, message: String) -> Result<(), String> {
        let mut store = self.inner.write().expect("lock");
        let snapshot = store
            .root_snapshots
            .iter_mut()
            .find(|snapshot| snapshot.id == id)
            .ok_or_else(|| format!("unknown snapshot id: {id}"))?;
        snapshot.publish_status = "failed".into();
        snapshot.publish_message = Some(message);
        Ok(())
    }

    async fn upsert_approval(&self, decision: KycDecision) -> Result<IssuerUser, String> {
        let mut store = self.inner.write().expect("lock");
        let user_index = store
            .users
            .iter()
            .position(|user| user.wallet == decision.subject.wallet);
        let user_id = if let Some(index) = user_index {
            let user = &mut store.users[index];
            user.wallet = decision.subject.wallet.clone();
            user.jurisdiction = decision.subject.jurisdiction.clone();
            user.jurisdiction_code = decision.subject.jurisdiction_code;
            user.credential_expiry = decision.credential.credential_expiry;
            user.sanctions_clear = decision.credential.sanctions_clear;
            user.enabled = decision.enabled;
            user.provider = Some(decision.provider.clone());
            user.provider_ref = Some(decision.provider_ref.clone());
            user.metadata = decision.subject.metadata.clone();
            user.id
        } else {
            store.next_user_id += 1;
            let user_id = store.next_user_id;
            store.users.push(IssuerUser {
                id: user_id,
                wallet: decision.subject.wallet.clone(),
                jurisdiction: decision.subject.jurisdiction.clone(),
                jurisdiction_code: decision.subject.jurisdiction_code,
                credential_expiry: decision.credential.credential_expiry,
                sanctions_clear: decision.credential.sanctions_clear,
                enabled: decision.enabled,
                provider: Some(decision.provider.clone()),
                provider_ref: Some(decision.provider_ref.clone()),
                metadata: decision.subject.metadata.clone(),
            });
            user_id
        };
        if let Some(existing) = store
            .credentials
            .iter_mut()
            .find(|credential| credential.user_id == user_id)
        {
            existing.credential_secret = decision.credential.credential_secret.clone();
            existing.enabled = decision.credential.enabled;
        } else {
            store.next_credential_id += 1;
            let id = store.next_credential_id;
            store.credentials.push(IssuerCredentialRecord {
                id,
                user_id,
                credential_secret: decision.credential.credential_secret,
                enabled: decision.credential.enabled,
            });
        }
        store
            .users
            .iter()
            .find(|user| user.id == user_id)
            .cloned()
            .ok_or_else(|| "failed to persist user".to_string())
    }

    async fn store_webhook(
        &self,
        provider: &str,
        event_key: &str,
        payload: Value,
    ) -> Result<(WebhookEventRecord, bool), String> {
        let mut store = self.inner.write().expect("lock");
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
}
