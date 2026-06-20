use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub listen_addr: String,
    pub state_path: Option<String>,
    pub api_token: Option<String>,
    pub public_base_url: String,
    pub webhook_secrets: Vec<(String, String)>,
    #[allow(dead_code)]
    pub supabase_url: Option<String>,
    #[allow(dead_code)]
    pub supabase_service_role_key: Option<String>,
    pub supabase_db_url: Option<String>,
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
    pub web_auth_domain: String,
    pub horizon_url: String,
    pub kyc_mode: String,
    pub verifier_id: Option<String>,
    pub expected_vk_hash: Option<String>,
    pub require_db: bool,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            listen_addr: env::var("ISSUER_LISTEN_ADDR").unwrap_or_else(|_| "127.0.0.1:3000".into()),
            state_path: env::var("ISSUER_STATE_PATH").ok().filter(|s| !s.is_empty()),
            api_token: env::var("ISSUER_API_TOKEN").ok().filter(|s| !s.is_empty()),
            public_base_url: env::var("ISSUER_PUBLIC_URL")
                .or_else(|_| env::var("ISSUER_URL"))
                .unwrap_or_else(|_| "http://127.0.0.1:3000".into())
                .trim_end_matches('/')
                .to_string(),
            webhook_secrets: parse_provider_secrets(
                &env::var("PROVIDER_WEBHOOK_SECRETS").unwrap_or_default(),
            ),
            supabase_url: env::var("SUPABASE_URL").ok().filter(|s| !s.is_empty()),
            supabase_service_role_key: env::var("SUPABASE_SERVICE_ROLE_KEY")
                .ok()
                .filter(|s| !s.is_empty()),
            supabase_db_url: env::var("SUPABASE_DB_URL")
                .ok()
                .filter(|s| !s.is_empty())
                .or_else(|| env::var("DATABASE_URL").ok().filter(|s| !s.is_empty())),
            rpc_url: env::var("STELLAR_RPC_URL")
                .unwrap_or_else(|_| "https://soroban-testnet.stellar.org".into()),
            network_passphrase: env::var("NETWORK_PASSPHRASE")
                .or_else(|_| env::var("STELLAR_NETWORK_PASSPHRASE"))
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
            fixtures_dir: env::var("WISP_FIXTURES_DIR").unwrap_or_else(|_| {
                concat!(env!("CARGO_MANIFEST_DIR"), "/../../../bindings/fixtures").into()
            }),
            fixture_profile: env::var("WISP_FIXTURE_PROFILE").unwrap_or_else(|_| "local".into()),
            web_auth_domain: env::var("WEB_AUTH_DOMAIN").unwrap_or_else(|_| "localhost".into()),
            horizon_url: env::var("HORIZON_URL")
                .unwrap_or_else(|_| "https://horizon-testnet.stellar.org".into()),
            kyc_mode: env::var("KYC_MODE").unwrap_or_else(|_| "sep10".into()),
            verifier_id: env::var("VERIFIER_CONTRACT_ID")
                .ok()
                .filter(|s| !s.is_empty())
                .or_else(|| env::var("VERIFIER_ID").ok().filter(|s| !s.is_empty())),
            expected_vk_hash: env::var("EXPECTED_VK_HASH").ok().filter(|s| !s.is_empty()),
            require_db: env_truthy("ISSUER_REQUIRE_DB")
                || env::var("WISP_ENV")
                    .map(|value| value.eq_ignore_ascii_case("production"))
                    .unwrap_or(false),
        }
    }

    /// Account that signs root publish invokes (`stellar contract invoke --source-account`).
    /// Prefers `PUBLISH_SOURCE_ACCOUNT` / `SOURCE` (identity name), then raw secrets.
    pub fn publish_source_account(&self) -> Option<String> {
        self.publish_source_account
            .clone()
            .or_else(|| self.issuer_secret_key.clone())
            .or_else(|| self.admin_secret_key.clone())
    }

    pub fn metadata_uri(&self) -> String {
        format!("{}/.well-known/wisp-issuer.json", self.public_base_url)
    }

    pub fn demo_transfer_filename(&self) -> &'static str {
        if self.fixture_profile == "testnet" {
            "demo-transfer-testnet.json"
        } else {
            "demo-transfer.json"
        }
    }

    pub fn webhook_secret_for(&self, provider: &str) -> Option<&str> {
        self.webhook_secrets
            .iter()
            .find(|(name, _)| name == provider)
            .map(|(_, secret)| secret.as_str())
    }
}

fn env_truthy(key: &str) -> bool {
    env::var(key)
        .map(|value| matches!(value.as_str(), "1" | "true" | "TRUE" | "yes" | "YES"))
        .unwrap_or(false)
}

fn parse_provider_secrets(raw: &str) -> Vec<(String, String)> {
    raw.split(',')
        .filter_map(|part| {
            let (provider, secret) = part.split_once('=')?;
            let provider = provider.trim();
            let secret = secret.trim();
            if provider.is_empty() || secret.is_empty() {
                return None;
            }
            Some((provider.to_string(), secret.to_string()))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_cfg() -> Config {
        Config {
            listen_addr: "127.0.0.1:3000".into(),
            state_path: None,
            api_token: None,
            public_base_url: "http://127.0.0.1:3000".into(),
            webhook_secrets: Vec::new(),
            supabase_url: None,
            supabase_service_role_key: None,
            supabase_db_url: None,
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
            web_auth_domain: "localhost".into(),
            horizon_url: "https://horizon-testnet.stellar.org".into(),
            kyc_mode: "sep10".into(),
            verifier_id: None,
            expected_vk_hash: None,
            require_db: false,
        }
    }

    #[test]
    fn publish_source_prefers_issuer_secret_when_available() {
        let mut cfg = test_cfg();
        cfg.issuer_secret_key = Some("SISSUER".into());
        assert_eq!(cfg.publish_source_account().as_deref(), Some("SISSUER"));
    }

    #[test]
    fn metadata_uri_uses_public_base_url() {
        let cfg = test_cfg();
        assert_eq!(
            cfg.metadata_uri(),
            "http://127.0.0.1:3000/.well-known/wisp-issuer.json"
        );
    }

    #[test]
    fn demo_transfer_filename_follows_profile() {
        let mut cfg = Config::from_env();
        cfg.fixture_profile = "testnet".into();
        assert_eq!(cfg.demo_transfer_filename(), "demo-transfer-testnet.json");
        cfg.fixture_profile = "local".into();
        assert_eq!(cfg.demo_transfer_filename(), "demo-transfer.json");
    }

    #[test]
    fn parses_provider_webhook_secrets() {
        let parsed = parse_provider_secrets("persona=abc, sumsub = def ");
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0], ("persona".into(), "abc".into()));
        assert_eq!(parsed[1], ("sumsub".into(), "def".into()));
    }
}
