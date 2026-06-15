use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde_json::json;
use tower_http::cors::{Any, CorsLayer};

use crate::auth::require_token;
use crate::config::Config;
use crate::state::AppState;
use crate::stellar::publish_roots;

pub fn router(cfg: Config, state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let public = Router::new()
        .route("/health", get(health))
        .route("/v1/credential/{wallet}", get(get_credential))
        .route("/v1/merkle-path/{wallet}", get(merkle_path))
        .route(
            "/v1/jurisdiction-path/{jurisdiction}",
            get(jurisdiction_path),
        )
        .route("/v1/sanctions-path/{wallet}", get(sanctions_path))
        .route("/v1/dest-path/{corridor_id}/{address}", get(dest_path))
        .route("/v1/corridor/{id}", get(get_corridor))
        .route("/v1/fixtures/demo-transfer", get(demo_transfer));

    let protected = Router::new()
        .route("/v1/credentials", post(issue_credential))
        .route("/v1/roots/publish", post(publish_roots_handler))
        .layer(axum::middleware::from_fn(require_token));

    Router::new()
        .merge(public)
        .merge(protected)
        .layer(cors)
        .layer(axum::Extension(cfg))
        .with_state(state)
}

async fn health(State(state): State<AppState>) -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "roots_hash": state.roots_hash(),
    }))
}

async fn demo_transfer(State(state): State<AppState>) -> impl IntoResponse {
    Json(state.proof_package())
}

async fn get_credential(
    State(state): State<AppState>,
    Path(wallet): Path<String>,
) -> Result<Json<amoeba_types::Credential>, StatusCode> {
    state
        .wallet_credential(&wallet)
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

fn require_sender_wallet(state: &AppState, wallet: &str) -> Result<(), StatusCode> {
    if wallet == state.demo_sender_hex() {
        Ok(())
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

async fn merkle_path(
    State(state): State<AppState>,
    Path(wallet): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    require_sender_wallet(&state, &wallet)?;
    let pkg = state.proof_package();
    Ok(Json(json!({
        "path": pkg.paths.membership,
        "path_indices": pkg.paths.membership_indices,
    })))
}

async fn jurisdiction_path(
    State(state): State<AppState>,
    Path(_jurisdiction): Path<String>,
) -> Json<serde_json::Value> {
    let pkg = state.proof_package();
    Json(json!({
        "path": pkg.paths.jurisdiction,
        "path_indices": pkg.paths.jurisdiction_indices,
    }))
}

async fn sanctions_path(
    State(state): State<AppState>,
    Path(wallet): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    require_sender_wallet(&state, &wallet)?;
    let pkg = state.proof_package();
    Ok(Json(json!({
        "path": pkg.paths.sanctions,
        "path_indices": pkg.paths.sanctions_indices,
    })))
}

async fn dest_path(
    State(state): State<AppState>,
    Path((_corridor_id, address)): Path<(u32, String)>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pkg = state.proof_package();
    if address != pkg.transfer.recipient {
        return Err(StatusCode::NOT_FOUND);
    }
    Ok(Json(json!({
        "path": pkg.paths.dest_address,
        "path_indices": pkg.paths.dest_address_indices,
    })))
}

async fn get_corridor(
    State(state): State<AppState>,
    Path(id): Path<u32>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if id != state.corridor_id() {
        return Err(StatusCode::NOT_FOUND);
    }
    let roots = state.roots();
    Ok(Json(json!({
        "corridor_id": id,
        "enabled": true,
        "roots": roots,
    })))
}

async fn issue_credential(
    State(state): State<AppState>,
) -> Result<Json<amoeba_types::Credential>, StatusCode> {
    state
        .wallet_credential(&state.demo_sender_hex())
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

async fn publish_roots_handler(
    axum::Extension(cfg): axum::Extension<Config>,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let roots = state.roots();
    let corridor_id = state.corridor_id();
    match publish_roots(&cfg, &roots, corridor_id) {
        Ok(msg) => Ok(Json(json!({ "status": "ok", "message": msg }))),
        Err(e) => Err((StatusCode::BAD_GATEWAY, e)),
    }
}

#[cfg(test)]
mod tests {
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use tower::ServiceExt;

    use super::*;
    use crate::config::Config;

    fn test_app() -> Router {
        let mut cfg = Config::from_env();
        cfg.api_token = Some("test-token".into());
        cfg.fixtures_dir =
            concat!(env!("CARGO_MANIFEST_DIR"), "/../../../bindings/fixtures").into();
        let state = AppState::load(&cfg);
        router(cfg, state)
    }

    #[tokio::test]
    async fn demo_transfer_returns_package() {
        let app = test_app();
        let res = app
            .oneshot(
                Request::get("/v1/fixtures/demo-transfer")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn publish_requires_auth() {
        let app = test_app();
        let res = app
            .oneshot(
                Request::post("/v1/roots/publish")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
    }
}
