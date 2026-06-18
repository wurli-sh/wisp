mod auth;
mod config;
mod log_util;
mod memory_snapshot;
mod mock_kyc;
mod routes;
mod state;
mod stellar;
mod trees;

use std::net::SocketAddr;

use config::Config;
use state::AppState;
use tokio::signal;
use tracing_subscriber::EnvFilter;

async fn shutdown_signal(state: AppState) {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    state.flush_memory_snapshot();
    tracing::info!("issuer memory snapshot flushed");
}

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
    let state = AppState::load(&cfg).await;
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
        store = state.store_label(),
        state_path = cfg.state_path.as_deref().unwrap_or("unset"),
        "issuer-service starting"
    );
    let shutdown_state = state.clone();
    let app = routes::router(cfg.clone(), state);

    let addr: SocketAddr = cfg.listen_addr.parse().expect("invalid ISSUER_LISTEN_ADDR");
    let listener = tokio::net::TcpListener::bind(addr).await.expect("bind");
    tracing::info!("issuer-service listening on {}", listener.local_addr().expect("local_addr"));
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal(shutdown_state))
        .await
        .expect("serve");
}
