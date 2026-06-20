use std::fs;
use std::ops::{Deref, DerefMut};
use std::path::Path;
use std::sync::{Arc, RwLock, RwLockWriteGuard};

use crate::state::MemoryStore;

#[derive(Clone)]
pub(crate) struct PersistedMemory {
    pub store: Arc<RwLock<MemoryStore>>,
    state_path: Option<String>,
}

#[derive(Debug)]
pub(crate) enum SnapshotLoad {
    Missing,
    Loaded(MemoryStore),
    Corrupt,
}

impl PersistedMemory {
    pub fn new(store: MemoryStore, state_path: Option<String>) -> Self {
        Self {
            store: Arc::new(RwLock::new(store)),
            state_path,
        }
    }

    pub fn has_state_path(&self) -> bool {
        self.state_path.is_some()
    }

    pub fn write_guard(&self) -> PersistedMemoryWriteGuard<'_> {
        PersistedMemoryWriteGuard {
            guard: self.store.write().expect("memory store lock poisoned"),
            memory: self,
            dirty: false,
        }
    }

    pub fn persist(&self) {
        let guard = self.store.read().expect("memory store lock poisoned");
        self.persist_store(&guard);
    }

    fn persist_store(&self, store: &MemoryStore) {
        let Some(path) = self.state_path.as_deref() else {
            return;
        };
        if let Err(err) = save_memory_snapshot(path, store) {
            tracing::warn!(path, error = %err, "failed to persist issuer memory state");
        }
    }
}

pub(crate) struct PersistedMemoryWriteGuard<'a> {
    guard: RwLockWriteGuard<'a, MemoryStore>,
    memory: &'a PersistedMemory,
    dirty: bool,
}

impl Deref for PersistedMemoryWriteGuard<'_> {
    type Target = MemoryStore;

    fn deref(&self) -> &Self::Target {
        &self.guard
    }
}

impl DerefMut for PersistedMemoryWriteGuard<'_> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.dirty = true;
        &mut self.guard
    }
}

impl Drop for PersistedMemoryWriteGuard<'_> {
    fn drop(&mut self) {
        if self.dirty {
            self.memory.persist_store(&self.guard);
        }
    }
}

pub(crate) fn try_load_memory_snapshot(path: &str) -> SnapshotLoad {
    match fs::read(path) {
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => SnapshotLoad::Missing,
        Err(err) => {
            tracing::warn!(path, error = %err, "issuer memory snapshot unreadable; starting fresh");
            SnapshotLoad::Corrupt
        }
        Ok(bytes) => match serde_json::from_slice::<MemoryStore>(&bytes) {
            Ok(store) => SnapshotLoad::Loaded(store),
            Err(err) => {
                tracing::warn!(path, error = %err, "issuer memory snapshot corrupt; starting fresh");
                SnapshotLoad::Corrupt
            }
        },
    }
}

pub(crate) fn load_memory_snapshot(path: &str) -> Option<MemoryStore> {
    match try_load_memory_snapshot(path) {
        SnapshotLoad::Loaded(store) => Some(store),
        SnapshotLoad::Missing | SnapshotLoad::Corrupt => None,
    }
}

pub(crate) fn save_memory_snapshot(path: &str, store: &MemoryStore) -> Result<(), String> {
    let parent = Path::new(path).parent();
    if let Some(dir) = parent.filter(|p| !p.as_os_str().is_empty()) {
        fs::create_dir_all(dir).map_err(|err| err.to_string())?;
    }
    let json = serde_json::to_vec_pretty(store).map_err(|err| err.to_string())?;
    let tmp = format!("{path}.tmp");
    fs::write(&tmp, json).map_err(|err| err.to_string())?;
    fs::rename(&tmp, path).map_err(|err| err.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mock_kyc::MockKycLifecycleStatus;
    use crate::state::{
        CorridorDestinationRecord, CorridorRecord, IssuerCredentialRecord, IssuerUser,
        RootSnapshotRecord,
    };
    use serde_json::{json, Value};

    fn sample_store() -> MemoryStore {
        let mut store = MemoryStore::default();
        store.next_user_id = 1;
        store.next_credential_id = 1;
        store.next_destination_id = 1;
        store.next_snapshot_id = 1;
        store.users.push(IssuerUser {
            id: 1,
            wallet: "1bb92559f99a7ae045bff1bbcc687e536f3cec8d17fa0c143b21f2a28f1a8250".into(),
            jurisdiction: "US".into(),
            jurisdiction_code: 840,
            credential_expiry: 2_000_000_000,
            sanctions_clear: true,
            enabled: true,
            provider: Some("mock".into()),
            provider_ref: Some("challenge-1".into()),
            metadata: json!({
                "kyc_status": "approved",
                "corridor_eligibility": [1]
            }),
        });
        store.credentials.push(IssuerCredentialRecord {
            id: 1,
            user_id: 1,
            credential_secret: crate::mock_kyc::MOCK_CREDENTIAL_SECRET.into(),
            enabled: true,
        });
        store.corridors.push(CorridorRecord {
            id: 1,
            name: "US-MX".into(),
            source_country: "US".into(),
            dest_country: "MX".into(),
            enabled: true,
            asset_hex: "5045cd5ec0729a768fd5ad02505852df4f028dce830e5ac52209ba48483b2f01".into(),
            issuer_strkey: None,
            travel_rule_threshold: "0".into(),
        });
        store.destinations.push(CorridorDestinationRecord {
            id: 1,
            corridor_id: 1,
            address: "30312bd65c9db111c8682975bd0aff6bccfbb33c3ff98630b4968b11cc0712ca".into(),
            enabled: true,
            metadata: Value::Null,
        });
        store.root_snapshots.push(RootSnapshotRecord {
            id: 1,
            corridor_id: 1,
            merkle_root: "1".into(),
            sanctions_root: "2".into(),
            jurisdiction_root: "3".into(),
            source_jurisdiction_root: "4".into(),
            dest_address_root: "5".into(),
            corridor_config_hash: "6".into(),
            publish_status: "active".into(),
            publish_message: None,
            compliance_contract_id: Some("CONTRACT".into()),
            created_at: 0,
            activated_at: Some(0),
        });
        store
    }

    #[test]
    fn snapshot_roundtrip_preserves_mock_kyc_user() {
        let dir = std::env::temp_dir().join(format!(
            "wisp-issuer-snapshot-{}",
            std::process::id()
        ));
        let _ = fs::create_dir_all(&dir);
        let path = dir.join("issuer-state.json");
        let _ = fs::remove_file(&path);

        let original = sample_store();
        save_memory_snapshot(path.to_str().expect("utf8 path"), &original).expect("save");

        let loaded = load_memory_snapshot(path.to_str().expect("utf8 path")).expect("load");
        let user = loaded.users.first().expect("user");
        assert_eq!(user.provider.as_deref(), Some("mock"));
        assert!(user.enabled);
        assert!(user.sanctions_clear);
        assert_eq!(
            user.metadata.get("kyc_status").and_then(Value::as_str),
            Some("approved")
        );
        let credential = loaded.credentials.first().expect("credential");
        assert!(credential.enabled);
        let snapshot = loaded.root_snapshots.first().expect("snapshot");
        assert_eq!(snapshot.publish_status, "active");

        let _ = fs::remove_file(&path);
        let _ = fs::remove_dir(&dir);
    }

    #[test]
    fn mock_kyc_status_approved_after_reload() {
        use crate::config::Config;
        use crate::state::AppState;

        let dir = std::env::temp_dir().join(format!(
            "wisp-issuer-kyc-status-{}",
            std::process::id()
        ));
        let _ = fs::create_dir_all(&dir);
        let path = dir.join("issuer-state.json");
        let path_str = path.to_str().expect("utf8 path").to_string();
        let _ = fs::remove_file(&path);

        save_memory_snapshot(&path_str, &sample_store()).expect("save");
        let loaded = load_memory_snapshot(&path_str).expect("load");
        let state = AppState::from_persisted_memory(PersistedMemory::new(
            loaded,
            Some(path_str.clone()),
        ));

        let cfg = Config {
            listen_addr: "127.0.0.1:3000".into(),
            state_path: Some(path_str.clone()),
            api_token: None,
            public_base_url: "http://127.0.0.1:3000".into(),
            webhook_secrets: Vec::new(),
            supabase_url: None,
            supabase_service_role_key: None,
            supabase_db_url: None,
            rpc_url: String::new(),
            network_passphrase: "Test SDF Network ; September 2015".into(),
            compliance_id: Some("CONTRACT".into()),
            issuer_public_key: None,
            admin_public_key: None,
            admin_secret_key: None,
            issuer_secret_key: None,
            publish_source_account: None,
            fixtures_dir: concat!(env!("CARGO_MANIFEST_DIR"), "/../../../bindings/fixtures").into(),
            fixture_profile: "testnet".into(),
            web_auth_domain: "localhost".into(),
            horizon_url: "https://horizon-testnet.stellar.org".into(),
            kyc_mode: "sep10".into(),
            verifier_id: None,
            expected_vk_hash: None,
            require_db: false,
        };

        let rt = tokio::runtime::Runtime::new().expect("runtime");
        let wallet = "GAN3SJKZ7GNHVYCFX7Y3XTDIPZJW6PHMRUL7UDAUHMQ7FIUPDKBFARBC";
        let status = rt
            .block_on(async { state.mock_kyc_status(&cfg, wallet, Some(1), None).await })
            .expect("status");

        assert_eq!(status.kyc_status, MockKycLifecycleStatus::Approved);

        let _ = fs::remove_file(&path);
        let _ = fs::remove_dir(&dir);
    }

    #[test]
    fn write_guard_persist_does_not_deadlock() {
        let dir = std::env::temp_dir().join(format!(
            "wisp-issuer-deadlock-{}",
            std::process::id()
        ));
        let _ = fs::create_dir_all(&dir);
        let path = dir.join("issuer-state.json");
        let path_str = path.to_str().expect("utf8 path").to_string();
        let _ = fs::remove_file(&path);

        let memory = PersistedMemory::new(MemoryStore::default(), Some(path_str));
        {
            let mut store = memory.write_guard();
            store.corridors.push(CorridorRecord {
                id: 1,
                name: "US-MX".into(),
                source_country: "US".into(),
                dest_country: "MX".into(),
                enabled: true,
                asset_hex: "00".into(),
                issuer_strkey: None,
                travel_rule_threshold: "0".into(),
            });
        }

        let loaded = load_memory_snapshot(path.to_str().expect("utf8 path")).expect("load");
        assert_eq!(loaded.corridors.len(), 1);

        let _ = fs::remove_file(&path);
        let _ = fs::remove_dir(&dir);
    }

    #[test]
    fn corrupt_snapshot_returns_empty_store() {
        let dir = std::env::temp_dir().join(format!(
            "wisp-issuer-corrupt-{}",
            std::process::id()
        ));
        let _ = fs::create_dir_all(&dir);
        let path = dir.join("issuer-state.json");
        fs::write(&path, b"{not-json").expect("write corrupt");

        match try_load_memory_snapshot(path.to_str().expect("utf8 path")) {
            SnapshotLoad::Corrupt => {}
            other => panic!("expected corrupt snapshot, got {other:?}"),
        }
        assert!(load_memory_snapshot(path.to_str().expect("utf8 path")).is_none());

        let _ = fs::remove_file(&path);
        let _ = fs::remove_dir(&dir);
    }
}
