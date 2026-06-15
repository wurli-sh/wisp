use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub listen_addr: String,
    pub state_path: Option<String>,
    pub api_token: Option<String>,
    #[allow(dead_code)]
    pub rpc_url: String,
    pub network_passphrase: String,
    pub compliance_id: Option<String>,
    pub issuer_public_key: Option<String>,
    pub admin_public_key: Option<String>,
    pub admin_secret_key: Option<String>,
    pub issuer_secret_key: Option<String>,
    /// Stellar CLI `--source-account`: identity name (e.g. amoeba-admin) or S-key secret.
    pub publish_source_account: Option<String>,
    pub fixtures_dir: String,
    pub fixture_profile: String,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            listen_addr: env::var("ISSUER_LISTEN_ADDR").unwrap_or_else(|_| "127.0.0.1:3000".into()),
            state_path: env::var("ISSUER_STATE_PATH").ok().filter(|s| !s.is_empty()),
            api_token: env::var("ISSUER_API_TOKEN").ok().filter(|s| !s.is_empty()),
            rpc_url: env::var("STELLAR_RPC_URL")
                .unwrap_or_else(|_| "https://soroban-testnet.stellar.org".into()),
            network_passphrase: env::var("NETWORK_PASSPHRASE")
                .unwrap_or_else(|_| "Test SDF Network ; September 2015".into()),
            compliance_id: env::var("COMPLIANCE_CONTRACT_ID")
                .ok()
                .filter(|s| !s.is_empty())
                .or_else(|| env::var("COMPLIANCE_ID").ok().filter(|s| !s.is_empty())),
            issuer_public_key: env::var("ISSUER_PUBLIC_KEY").ok().filter(|s| !s.is_empty()),
            admin_public_key: env::var("ADMIN_PUBLIC_KEY").ok().filter(|s| !s.is_empty()),
            admin_secret_key: env::var("ADMIN_SECRET_KEY").ok().filter(|s| !s.is_empty()),
            issuer_secret_key: env::var("ISSUER_SECRET_KEY").ok().filter(|s| !s.is_empty()),
            publish_source_account: env::var("PUBLISH_SOURCE_ACCOUNT")
                .ok()
                .filter(|s| !s.is_empty())
                .or_else(|| env::var("SOURCE").ok().filter(|s| !s.is_empty())),
            fixtures_dir: env::var("AMOEBA_FIXTURES_DIR").unwrap_or_else(|_| {
                concat!(env!("CARGO_MANIFEST_DIR"), "/../../../bindings/fixtures").into()
            }),
            fixture_profile: env::var("AMOEBA_FIXTURE_PROFILE").unwrap_or_else(|_| "local".into()),
        }
    }

    /// Account that signs root publish invokes (`stellar contract invoke --source-account`).
    /// Prefers `PUBLISH_SOURCE_ACCOUNT` / `SOURCE` (identity name), then raw secrets.
    pub fn publish_source_account(&self) -> Option<String> {
        self.publish_source_account
            .clone()
            .or_else(|| self.admin_secret_key.clone())
            .or_else(|| self.issuer_secret_key.clone())
    }

    /// True when the signing account is the compliance admin (not the registered issuer).
    pub fn admin_signs_publish(&self) -> bool {
        let Some(source) = self.publish_source_account() else {
            return false;
        };
        if self
            .issuer_secret_key
            .as_ref()
            .is_some_and(|k| k == &source)
        {
            return false;
        }
        if source == "amoeba-issuer" {
            return false;
        }
        if self.admin_secret_key.is_some() {
            return true;
        }
        if source.starts_with('S') && source.len() > 50 {
            return self.issuer_secret_key.as_ref() != Some(&source);
        }
        true
    }

    /// Stellar address that must authorize `update_issuer_root` (must match signer).
    pub fn publish_auth_key(&self) -> Option<String> {
        if self.admin_signs_publish() {
            self.admin_public_key.clone()
        } else {
            self.issuer_public_key.clone()
        }
    }

    pub fn demo_transfer_filename(&self) -> &'static str {
        if self.fixture_profile == "testnet" {
            "demo-transfer-testnet.json"
        } else {
            "demo-transfer.json"
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_cfg() -> Config {
        Config {
            listen_addr: "127.0.0.1:3000".into(),
            state_path: None,
            api_token: None,
            rpc_url: String::new(),
            network_passphrase: String::new(),
            compliance_id: None,
            issuer_public_key: Some("GISSUER".into()),
            admin_public_key: Some("GADMIN".into()),
            admin_secret_key: None,
            issuer_secret_key: None,
            publish_source_account: None,
            fixtures_dir: String::new(),
            fixture_profile: "local".into(),
        }
    }

    #[test]
    fn publish_auth_uses_admin_public_when_admin_identity_source() {
        let mut cfg = test_cfg();
        cfg.publish_source_account = Some("amoeba-admin".into());
        assert!(cfg.admin_signs_publish());
        assert_eq!(cfg.publish_auth_key().as_deref(), Some("GADMIN"));
    }

    #[test]
    fn publish_auth_uses_issuer_when_issuer_secret_signs() {
        let mut cfg = test_cfg();
        cfg.issuer_secret_key = Some("SISSUER".into());
        cfg.publish_source_account = Some("SISSUER".into());
        assert!(!cfg.admin_signs_publish());
        assert_eq!(cfg.publish_auth_key().as_deref(), Some("GISSUER"));
    }

    #[test]
    fn publish_auth_requires_admin_public_not_issuer_fallback() {
        let mut cfg = test_cfg();
        cfg.admin_secret_key = Some("SADMIN".into());
        cfg.admin_public_key = None;
        assert!(cfg.admin_signs_publish());
        assert_eq!(cfg.publish_auth_key(), None);
    }

    #[test]
    fn demo_transfer_filename_follows_profile() {
        let mut cfg = Config::from_env();
        cfg.fixture_profile = "testnet".into();
        assert_eq!(cfg.demo_transfer_filename(), "demo-transfer-testnet.json");
        cfg.fixture_profile = "local".into();
        assert_eq!(cfg.demo_transfer_filename(), "demo-transfer.json");
    }
}
