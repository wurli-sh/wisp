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
    pub admin_secret_key: Option<String>,
    pub issuer_secret_key: Option<String>,
    pub fixtures_dir: String,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            listen_addr: env::var("ISSUER_LISTEN_ADDR").unwrap_or_else(|_| "127.0.0.1:3000".into()),
            state_path: env::var("ISSUER_STATE_PATH").ok().filter(|s| !s.is_empty()),
            api_token: env::var("ISSUER_API_TOKEN").ok().filter(|s| !s.is_empty()),
            rpc_url: env::var("STELLAR_RPC_URL")
                .unwrap_or_else(|_| "https://rpc-testnet.stellar.org".into()),
            network_passphrase: env::var("NETWORK_PASSPHRASE")
                .unwrap_or_else(|_| "Test SDF Network ; September 2015".into()),
            compliance_id: env::var("COMPLIANCE_CONTRACT_ID")
                .ok()
                .filter(|s| !s.is_empty()),
            issuer_public_key: env::var("ISSUER_PUBLIC_KEY").ok().filter(|s| !s.is_empty()),
            admin_secret_key: env::var("ADMIN_SECRET_KEY").ok().filter(|s| !s.is_empty()),
            issuer_secret_key: env::var("ISSUER_SECRET_KEY").ok().filter(|s| !s.is_empty()),
            fixtures_dir: env::var("AMOEBA_FIXTURES_DIR").unwrap_or_else(|_| {
                concat!(env!("CARGO_MANIFEST_DIR"), "/../../bindings/fixtures").into()
            }),
        }
    }

    pub fn publish_source_key(&self) -> Option<String> {
        self.admin_secret_key
            .clone()
            .or_else(|| self.issuer_secret_key.clone())
    }
}
