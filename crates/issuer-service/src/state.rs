use std::fs;
use std::path::Path;
use std::sync::{Arc, RwLock};

use amoeba_types::{DemoTransferFixture, DemoUsersFixture, ProofPackage, Roots};
use serde::{Deserialize, Serialize};

use crate::config::Config;
use crate::trees::build_demo_proof_package;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PersistedState {
    pub demo_transfer: DemoTransferFixture,
    pub roots: Roots,
    pub corridor_id: u32,
}

#[derive(Clone)]
pub struct AppState {
    inner: Arc<RwLock<InnerState>>,
}

struct InnerState {
    demo_transfer: DemoTransferFixture,
    demo_users: DemoUsersFixture,
    proof_package: ProofPackage,
    corridor_id: u32,
}

impl AppState {
    pub fn load(cfg: &Config) -> Self {
        if let Some(path) = cfg.state_path.as_ref() {
            if Path::new(path).exists() {
                if let Ok(raw) = fs::read_to_string(path) {
                    if let Ok(persisted) = serde_json::from_str::<PersistedState>(&raw) {
                        let proof_package = build_demo_proof_package(&persisted.demo_transfer);
                        return Self {
                            inner: Arc::new(RwLock::new(InnerState {
                                demo_transfer: persisted.demo_transfer,
                                demo_users: load_demo_users(cfg),
                                proof_package,
                                corridor_id: persisted.corridor_id,
                            })),
                        };
                    }
                }
            }
        }

        let demo_transfer = load_demo_transfer(cfg);
        let demo_users = load_demo_users(cfg);
        let proof_package = build_demo_proof_package(&demo_transfer);
        let corridor_id = demo_transfer.corridor_id;
        let state = Self {
            inner: Arc::new(RwLock::new(InnerState {
                demo_transfer: demo_transfer.clone(),
                demo_users,
                proof_package,
                corridor_id,
            })),
        };
        state.persist(cfg);
        state
    }

    pub fn persist(&self, cfg: &Config) {
        let Some(path) = cfg.state_path.as_ref() else {
            tracing::info!("in-memory demo mode (ISSUER_STATE_PATH unset)");
            return;
        };
        let inner = self.inner.read().expect("lock");
        let persisted = PersistedState {
            demo_transfer: inner.demo_transfer.clone(),
            roots: inner.proof_package.roots.clone(),
            corridor_id: inner.corridor_id,
        };
        if let Some(parent) = Path::new(path).parent() {
            let _ = fs::create_dir_all(parent);
        }
        let _ = fs::write(
            path,
            serde_json::to_string_pretty(&persisted).expect("serialize"),
        );
    }

    pub fn proof_package(&self) -> ProofPackage {
        self.inner.read().expect("lock").proof_package.clone()
    }

    pub fn roots(&self) -> Roots {
        self.inner.read().expect("lock").proof_package.roots.clone()
    }

    pub fn corridor_id(&self) -> u32 {
        self.inner.read().expect("lock").corridor_id
    }

    pub fn roots_hash(&self) -> String {
        let roots = self.roots();
        format!(
            "{:x}",
            md5_hash(&format!(
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

    pub fn wallet_credential(&self, wallet_hex: &str) -> Option<amoeba_types::Credential> {
        let inner = self.inner.read().expect("lock");
        inner
            .demo_users
            .users
            .iter()
            .find(|u| u.wallet_hex == wallet_hex)
            .map(|u| amoeba_types::Credential {
                wallet: u.wallet_hex.clone(),
                jurisdiction: u.jurisdiction.clone(),
                credential_expiry: u.credential_expiry,
                sanctions_clear: u.sanctions_clear,
                corridor_eligibility: u.corridor_eligibility.clone(),
                credential_commitment: None,
            })
    }

    pub fn demo_sender_hex(&self) -> String {
        self.inner
            .read()
            .expect("lock")
            .demo_transfer
            .sender_hex
            .clone()
    }
}

fn load_demo_transfer(cfg: &Config) -> DemoTransferFixture {
    let path = Path::new(&cfg.fixtures_dir).join("demo-transfer.json");
    let raw = fs::read_to_string(path).expect("demo-transfer.json");
    serde_json::from_str(&raw).expect("parse demo-transfer")
}

fn load_demo_users(cfg: &Config) -> DemoUsersFixture {
    let path = Path::new(&cfg.fixtures_dir).join("demo-users.json");
    let raw = fs::read_to_string(path).expect("demo-users.json");
    serde_json::from_str(&raw).expect("parse demo-users")
}

fn md5_hash(s: &str) -> u64 {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut h = DefaultHasher::new();
    s.hash(&mut h);
    h.finish()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::Config;

    #[test]
    fn state_round_trip_preserves_roots() {
        let dir = std::env::temp_dir().join(format!("amoeba-issuer-{}", std::process::id()));
        let _ = fs::create_dir_all(&dir);
        let path = dir.join("state.json");
        let mut cfg = Config::from_env();
        cfg.state_path = Some(path.to_string_lossy().into());
        cfg.fixtures_dir = concat!(env!("CARGO_MANIFEST_DIR"), "/../../bindings/fixtures").into();

        let s1 = AppState::load(&cfg);
        let roots1 = s1.roots();
        drop(s1);

        let s2 = AppState::load(&cfg);
        let roots2 = s2.roots();
        assert_eq!(roots1.merkle_root, roots2.merkle_root);
        let _ = fs::remove_dir_all(dir);
    }
}
