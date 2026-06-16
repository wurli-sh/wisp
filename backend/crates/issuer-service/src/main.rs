mod auth;
mod config;
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
    let state = AppState::load(&cfg).await;
    let app = routes::router(cfg.clone(), state);

    let addr: SocketAddr = cfg.listen_addr.parse().expect("invalid ISSUER_LISTEN_ADDR");
    let listener = tokio::net::TcpListener::bind(addr).await.expect("bind");
    tracing::info!("issuer-service listening on {}", listener.local_addr().expect("local_addr"));
    axum::serve(listener, app).await.expect("serve");
}
