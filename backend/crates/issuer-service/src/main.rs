mod auth;
mod config;
mod log_util;
mod mock_kyc;
mod routes;
mod state;
mod stellar;
mod trees;

use std::net::SocketAddr;

use config::Config;
use state::AppState;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::from_default_env()
                .add_directive("issuer_service=debug".parse().unwrap())
                .add_directive("tower_http=info".parse().unwrap()),
        )
        .init();

    let cfg = Config::from_env();
    let store = if cfg.supabase_db_url.is_some() {
        "postgres"
    } else {
        "memory"
    };
    tracing::info!(
        listen = %cfg.listen_addr,
        compliance = cfg.compliance_id.as_deref().unwrap_or("unset"),
        issuer = cfg
            .issuer_public_key
            .as_deref()
            .map(log_util::short_key)
            .unwrap_or_else(|| "unset".into()),
        publish_source = cfg.publish_source_account.as_deref().unwrap_or("unset"),
        fixture = %cfg.fixture_profile,
        kyc = %cfg.kyc_mode,
        store,
        "issuer-service starting"
    );
    let state = AppState::load(&cfg).await;
    let app = routes::router(cfg.clone(), state);

    let addr: SocketAddr = cfg.listen_addr.parse().expect("invalid ISSUER_LISTEN_ADDR");
    let listener = tokio::net::TcpListener::bind(addr).await.expect("bind");
    tracing::info!("issuer-service listening on {}", listener.local_addr().expect("local_addr"));
    axum::serve(listener, app).await.expect("serve");
}
