use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, patch, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use tower_http::cors::{Any, CorsLayer};

use amoeba_types::{DemoTransferRequest, ProofPackage};

use crate::auth::require_token;
use crate::config::Config;
use crate::mock_kyc::{MockKycChallengeRequest, MockKycSubmitRequest};
use crate::state::{
    AppState, CorridorPatch, DestinationCreate, ProofPackageRequest, PublishRootsRequest, UserPatch,
};

pub fn router(cfg: Config, state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let public = Router::new()
        .route("/health", get(health))
        .route("/v1/credential/{wallet}", get(get_credential))
        .route("/v1/merkle-path/{wallet}", get(merkle_path))
        .route("/v1/jurisdiction-path/{jurisdiction}", get(jurisdiction_path))
        .route("/v1/sanctions-path/{wallet}", get(sanctions_path))
        .route("/v1/dest-path/{corridor_id}/{address}", get(dest_path))
        .route("/v1/corridor/{id}", get(get_corridor))
        .route("/v1/corridors", get(list_corridors))
        .route("/v1/proof-packages", post(create_proof_package))
        .route("/v1/provider/webhooks/{provider}", post(provider_webhook))
        .route("/v1/fixtures/demo-transfer", get(demo_transfer))
        .route("/v1/fixtures/demo-transfer", post(create_demo_transfer))
        .route("/v1/mock-kyc/challenge", post(mock_kyc_challenge))
        .route("/v1/mock-kyc/submit", post(mock_kyc_submit))
        .route("/v1/mock-kyc/status/{wallet}", get(mock_kyc_status));

    let protected = Router::new()
        .route("/v1/admin/users", get(list_users))
        .route("/v1/admin/users/{id}", patch(patch_user))
        .route("/v1/admin/corridors", get(list_admin_corridors))
        .route("/v1/admin/corridors/{id}", patch(patch_corridor))
        .route(
            "/v1/admin/corridors/{id}/destinations",
            post(add_destination),
        )
        .route("/v1/admin/roots/publish", post(publish_roots_handler))
        .route("/v1/admin/roots/latest", get(latest_root))
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
        "roots_hash": state.roots_hash().await,
    }))
}

async fn demo_transfer(State(state): State<AppState>) -> Result<Json<ProofPackage>, StatusCode> {
    state.proof_package().await.map(Json).ok_or(StatusCode::NOT_FOUND)
}

async fn create_demo_transfer(
    State(state): State<AppState>,
    Json(req): Json<DemoTransferRequest>,
) -> Result<Json<ProofPackage>, (StatusCode, String)> {
    let (_, proof_package) = state
        .create_demo_transfer(&req)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, e))?;
    Ok(Json(proof_package))
}

async fn create_proof_package(
    State(state): State<AppState>,
    Json(req): Json<ProofPackageRequest>,
) -> Result<Json<ProofPackage>, (StatusCode, String)> {
    state
        .create_proof_package(&req)
        .await
        .map(Json)
        .map_err(|err| (StatusCode::BAD_REQUEST, err))
}

async fn mock_kyc_challenge(
    axum::Extension(cfg): axum::Extension<Config>,
    State(state): State<AppState>,
    Json(req): Json<MockKycChallengeRequest>,
) -> Result<Json<crate::mock_kyc::MockKycChallengeResponse>, (StatusCode, String)> {
    state
        .create_mock_kyc_challenge(&cfg, &req.wallet)
        .await
        .map(Json)
        .map_err(|err| mock_kyc_error_status(&err, StatusCode::BAD_REQUEST))
}

async fn mock_kyc_submit(
    axum::Extension(cfg): axum::Extension<Config>,
    State(state): State<AppState>,
    Json(req): Json<MockKycSubmitRequest>,
) -> Result<Json<crate::mock_kyc::MockKycSubmitResponse>, (StatusCode, String)> {
    state
        .submit_mock_kyc(&cfg, &req)
        .await
        .map(Json)
        .map_err(|err| mock_kyc_error_status(&err, StatusCode::BAD_REQUEST))
}

async fn mock_kyc_status(
    State(state): State<AppState>,
    Path(wallet): Path<String>,
) -> Result<Json<crate::mock_kyc::MockKycStatusResponse>, (StatusCode, String)> {
    state
        .mock_kyc_status(&wallet)
        .await
        .map(Json)
        .map_err(|err| mock_kyc_error_status(&err, StatusCode::BAD_REQUEST))
}

fn mock_kyc_error_status(err: &str, fallback: StatusCode) -> (StatusCode, String) {
    let status = if err.contains("invalid signature")
        || err.contains("wallet mismatch")
        || err.contains("challenge expired")
        || err.contains("missing signature")
    {
        StatusCode::UNAUTHORIZED
    } else if err.contains("already consumed") || err.contains("rate limited") {
        StatusCode::CONFLICT
    } else if err.contains("wallet revoked") {
        StatusCode::FORBIDDEN
    } else if err.contains("invalid stellar wallet") || err.contains("wallet is required") {
        StatusCode::BAD_REQUEST
    } else {
        fallback
    };
    (status, err.to_string())
}

async fn get_credential(
    State(state): State<AppState>,
    Path(wallet): Path<String>,
) -> Result<Json<amoeba_types::Credential>, StatusCode> {
    state
        .wallet_credential(&wallet)
        .await
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

async fn merkle_path(
    State(state): State<AppState>,
    Path(wallet): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let pkg = state.proof_package().await.ok_or(StatusCode::NOT_FOUND)?;
    if wallet != pkg.transfer.sender {
        return Err(StatusCode::NOT_FOUND);
    }
    Ok(Json(json!({
        "path": pkg.paths.membership,
        "path_indices": pkg.paths.membership_indices,
    })))
}

async fn jurisdiction_path(
    State(state): State<AppState>,
    Path(_jurisdiction): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let pkg = state.proof_package().await.ok_or(StatusCode::NOT_FOUND)?;
    Ok(Json(json!({
        "path": pkg.paths.jurisdiction,
        "path_indices": pkg.paths.jurisdiction_indices,
    })))
}

async fn sanctions_path(
    State(state): State<AppState>,
    Path(wallet): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let pkg = state.proof_package().await.ok_or(StatusCode::NOT_FOUND)?;
    if wallet != pkg.transfer.sender {
        return Err(StatusCode::NOT_FOUND);
    }
    Ok(Json(json!({
        "path": pkg.paths.sanctions,
        "path_indices": pkg.paths.sanctions_indices,
    })))
}

async fn dest_path(
    State(state): State<AppState>,
    Path((_corridor_id, address)): Path<(u32, String)>,
) -> Result<Json<Value>, StatusCode> {
    let pkg = state.proof_package().await.ok_or(StatusCode::NOT_FOUND)?;
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
) -> Result<Json<Value>, StatusCode> {
    let corridor = state.get_corridor(id).await.ok_or(StatusCode::NOT_FOUND)?;
    let roots = state.latest_root_snapshot(Some(id)).await;
    Ok(Json(json!({
        "corridor_id": corridor.id,
        "name": corridor.name,
        "source_country": corridor.source_country,
        "dest_country": corridor.dest_country,
        "enabled": corridor.enabled,
        "asset_hex": corridor.asset_hex,
        "latest_root_snapshot": roots,
    })))
}

async fn list_corridors(State(state): State<AppState>) -> Json<Vec<amoeba_types::CorridorOption>> {
    Json(state.available_corridors().await)
}

async fn list_users(State(state): State<AppState>) -> Json<Vec<crate::state::IssuerUser>> {
    Json(state.list_users().await)
}

async fn patch_user(
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(req): Json<UserPatch>,
) -> Result<Json<crate::state::IssuerUser>, (StatusCode, String)> {
    state
        .update_user(id, req)
        .await
        .map(Json)
        .map_err(|err| (StatusCode::BAD_REQUEST, err))
}

async fn list_admin_corridors(
    State(state): State<AppState>,
) -> Json<Vec<crate::state::CorridorRecord>> {
    Json(state.list_admin_corridors().await)
}

async fn patch_corridor(
    State(state): State<AppState>,
    Path(id): Path<u32>,
    Json(req): Json<CorridorPatch>,
) -> Result<Json<crate::state::CorridorRecord>, (StatusCode, String)> {
    state
        .update_corridor(id, req)
        .await
        .map(Json)
        .map_err(|err| (StatusCode::BAD_REQUEST, err))
}

async fn add_destination(
    State(state): State<AppState>,
    Path(id): Path<u32>,
    Json(req): Json<DestinationCreate>,
) -> Result<Json<crate::state::CorridorDestinationRecord>, (StatusCode, String)> {
    state
        .add_destination(id, req)
        .await
        .map(Json)
        .map_err(|err| (StatusCode::BAD_REQUEST, err))
}

async fn publish_roots_handler(
    axum::Extension(cfg): axum::Extension<Config>,
    State(state): State<AppState>,
    Json(req): Json<PublishRootsRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let results = state
        .publish_roots(&cfg, req)
        .await
        .map_err(|err| (StatusCode::BAD_GATEWAY, err))?;
    Ok(Json(json!({
        "status": "ok",
        "results": results,
    })))
}

#[derive(Deserialize)]
struct LatestRootQuery {
    corridor_id: Option<u32>,
}

async fn latest_root(
    State(state): State<AppState>,
    Query(query): Query<LatestRootQuery>,
) -> Result<Json<crate::state::RootSnapshotRecord>, StatusCode> {
    state
        .latest_root_snapshot(query.corridor_id)
        .await
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

async fn provider_webhook(
    axum::Extension(cfg): axum::Extension<Config>,
    State(state): State<AppState>,
    Path(provider): Path<String>,
    headers: HeaderMap,
    Json(payload): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
    validate_webhook_secret(&cfg, &provider, &headers)?;
    let event_key = provider_event_key(&headers, &payload);
    let (_, existed) = state
        .store_webhook(&provider, &event_key, payload.clone())
        .await
        .map_err(|err| (StatusCode::BAD_REQUEST, err))?;
    if existed {
        return Ok(Json(json!({
            "status": "duplicate",
            "provider": provider,
            "event_key": event_key,
        })));
    }
    let user = state
        .apply_webhook_event(&provider, &event_key, payload)
        .await
        .map_err(|err| (StatusCode::BAD_REQUEST, err))?;
    Ok(Json(json!({
        "status": "ok",
        "provider": provider,
        "event_key": event_key,
        "user": user,
    })))
}

fn validate_webhook_secret(
    cfg: &Config,
    provider: &str,
    headers: &HeaderMap,
) -> Result<(), (StatusCode, String)> {
    let Some(expected) = cfg.webhook_secret_for(provider) else {
        return Err((StatusCode::UNAUTHORIZED, format!("webhook secret not configured for {provider}")));
    };
    let provided = headers
        .get("x-webhook-secret")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");
    if provided == expected {
        Ok(())
    } else {
        Err((StatusCode::UNAUTHORIZED, "invalid webhook secret".into()))
    }
}

fn provider_event_key(headers: &HeaderMap, payload: &Value) -> String {
    headers
        .get("x-provider-event-id")
        .and_then(|value| value.to_str().ok())
        .map(str::to_string)
        .or_else(|| payload.get("id").and_then(Value::as_str).map(str::to_string))
        .unwrap_or_else(|| format!("anonymous-{}", payload))
}

#[cfg(test)]
mod tests {
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use tower::ServiceExt;

    use serde_json::json;

    use super::*;
    use crate::config::Config;

    async fn seed_demo_user(state: &AppState) {
        state
            .apply_webhook_event(
                "fixture",
                "demo-user",
                json!({
                    "wallet_hex": "00112233445566778899aabbccddeeff1032547698badcfeefcdab8967452301",
                    "jurisdiction": "US",
                    "jurisdiction_code": 840,
                    "credential_expiry": 2000000000u64,
                    "sanctions_clear": true,
                    "enabled": true,
                    "credential_secret": "424242",
                }),
            )
            .await
            .expect("seed demo user");
    }

    async fn test_app() -> Router {
        let mut cfg = Config::from_env();
        cfg.api_token = Some("test-token".into());
        cfg.webhook_secrets = vec![("persona".into(), "shh".into())];
        cfg.fixtures_dir =
            concat!(env!("CARGO_MANIFEST_DIR"), "/../../../bindings/fixtures").into();
        let state = AppState::load(&cfg).await;
        router(cfg, state)
    }

    #[tokio::test]
    async fn demo_transfer_returns_package() {
        let mut cfg = Config::from_env();
        cfg.api_token = Some("test-token".into());
        cfg.webhook_secrets = vec![("persona".into(), "shh".into())];
        cfg.fixtures_dir =
            concat!(env!("CARGO_MANIFEST_DIR"), "/../../../bindings/fixtures").into();
        let state = AppState::load(&cfg).await;
        seed_demo_user(&state).await;
        let _ = state
            .create_proof_package(&state.bootstrap_request(&cfg).await.expect("bootstrap"))
            .await
            .expect("bootstrap package");
        let app = router(cfg, state);
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
        let app = test_app().await;
        let res = app
            .oneshot(
                Request::post("/v1/admin/roots/publish")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn webhook_requires_secret() {
        let app = test_app().await;
        let res = app
            .oneshot(
                Request::post("/v1/provider/webhooks/persona")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"id":"evt_1"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
    }
}
