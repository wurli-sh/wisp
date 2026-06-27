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

use crate::auth::require_token;
use crate::config::Config;
use crate::issuance::{
    ActivateCredentialRequest, ActivateCredentialResponse, ActivationChallengeRequest,
    ChallengeResponse, ProofPackageChallengeRequest, ProofPackageDraft, SignedProofPackageRequest,
};
use crate::mock_kyc::{MockKycChallengeRequest, MockKycSubmitRequest};
use crate::state::{AppState, CorridorPatch, DestinationCreate, PublishRootsRequest, UserPatch};

pub fn router(cfg: Config, state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let public = Router::new()
        .route("/health", get(health))
        .route("/.well-known/wisp-issuer.json", get(well_known_issuer))
        .route("/credentials/{wallet}", get(get_credential))
        .route("/corridors/{id}", get(get_corridor))
        .route("/corridors", get(list_corridors))
        .route(
            "/credentials/activation-challenges",
            post(create_activation_challenge),
        )
        .route("/credentials/activate", post(activate_credential))
        .route(
            "/proof-packages/challenges",
            post(create_proof_package_challenge),
        )
        .route("/proof-packages", post(create_proof_package));

    let provider = if cfg.is_production() {
        Router::new()
            .route(
                "/provider/webhooks/{provider}",
                post(security_upgrade_required),
            )
            .route("/auth", get(security_upgrade_required))
    } else {
        Router::new()
            .route("/provider/webhooks/{provider}", post(provider_webhook))
            .route("/auth", get(sep10_auth))
    };

    let demo = if cfg.is_production() {
        Router::new()
    } else {
        Router::new()
            .route("/mock-kyc/challenge", post(mock_kyc_challenge))
            .route("/mock-kyc/submit", post(mock_kyc_submit))
            .route("/mock-kyc/status/{wallet}", get(mock_kyc_status))
    };

    let protected = Router::new()
        .route("/admin/users", get(list_users))
        .route("/admin/users/{id}", patch(patch_user))
        .route("/admin/corridors", get(list_admin_corridors))
        .route("/admin/corridors/{id}", patch(patch_corridor))
        .route("/admin/corridors/{id}/destinations", post(add_destination))
        .route("/admin/roots/publish", post(publish_roots_handler))
        .route("/admin/roots/latest", get(latest_root))
        .route("/admin/roots/computed", get(computed_roots))
        .layer(axum::middleware::from_fn(require_token));

    Router::new()
        .merge(public)
        .merge(provider)
        .merge(demo)
        .merge(protected)
        .layer(cors)
        .layer(axum::Extension(cfg))
        .with_state(state)
}

async fn security_upgrade_required() -> impl IntoResponse {
    (
        StatusCode::SERVICE_UNAVAILABLE,
        Json(json!({
            "error": "security_upgrade_required",
            "message": "This integration is disabled in production."
        })),
    )
}

async fn health(State(state): State<AppState>) -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "store": state.store_label(),
        "roots_hash": state.roots_hash().await,
    }))
}

async fn well_known_issuer(axum::Extension(cfg): axum::Extension<Config>) -> impl IntoResponse {
    Json(json!({
        "issuer_mode": cfg.issuer_mode,
        "issuance_available": true,
        "issuer_stellar_address": cfg.issuer_public_key,
        "metadata_uri": cfg.metadata_uri(),
        "service_url": cfg.public_base_url,
        "compliance_contract_id": cfg.compliance_id,
        "verifier_contract_id": cfg.verifier_id,
        "circuit_vk_hash": cfg.expected_vk_hash,
        "network_passphrase": cfg.network_passphrase,
    }))
}

async fn create_activation_challenge(
    State(state): State<AppState>,
    Json(req): Json<ActivationChallengeRequest>,
) -> Result<Json<ChallengeResponse>, (StatusCode, String)> {
    state
        .create_activation_challenge(&req)
        .await
        .map(Json)
        .map_err(|err| issuance_error_status(&err))
}

async fn activate_credential(
    axum::Extension(cfg): axum::Extension<Config>,
    State(state): State<AppState>,
    Json(req): Json<ActivateCredentialRequest>,
) -> Result<Json<ActivateCredentialResponse>, (StatusCode, String)> {
    state
        .activate_credential(&cfg, &req)
        .await
        .map(Json)
        .map_err(|err| issuance_error_status(&err))
}

async fn create_proof_package_challenge(
    State(state): State<AppState>,
    Json(req): Json<ProofPackageChallengeRequest>,
) -> Result<Json<ChallengeResponse>, (StatusCode, String)> {
    state
        .create_proof_package_challenge(&req)
        .await
        .map(Json)
        .map_err(|err| issuance_error_status(&err))
}

async fn create_proof_package(
    axum::Extension(cfg): axum::Extension<Config>,
    State(state): State<AppState>,
    Json(req): Json<SignedProofPackageRequest>,
) -> Result<Json<ProofPackageDraft>, (StatusCode, String)> {
    state
        .create_proof_package_draft(&cfg, &req)
        .await
        .map(Json)
        .map_err(|err| issuance_error_status(&err))
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
    axum::Extension(cfg): axum::Extension<Config>,
    State(state): State<AppState>,
    Path(wallet): Path<String>,
    Query(query): Query<MockKycStatusQuery>,
) -> Result<Json<crate::mock_kyc::MockKycStatusResponse>, (StatusCode, String)> {
    state
        .mock_kyc_status(&cfg, &wallet, query.corridor_id, query.recipient.as_deref())
        .await
        .map(Json)
        .map_err(|err| mock_kyc_error_status(&err, StatusCode::BAD_REQUEST))
}

#[derive(Deserialize)]
struct MockKycStatusQuery {
    corridor_id: Option<u32>,
    recipient: Option<String>,
}

#[derive(Deserialize)]
struct Sep10AuthQuery {
    account: String,
}

async fn sep10_auth(
    axum::Extension(cfg): axum::Extension<Config>,
    State(state): State<AppState>,
    Query(query): Query<Sep10AuthQuery>,
) -> Result<Json<crate::mock_kyc::MockKycChallengeResponse>, (StatusCode, String)> {
    state
        .create_mock_kyc_challenge(&cfg, &query.account)
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

fn issuance_error_status(err: &str) -> (StatusCode, String) {
    let status = if err.contains("invalid signature")
        || err.contains("challenge expired")
        || err.contains("challenge purpose mismatch")
    {
        StatusCode::UNAUTHORIZED
    } else if err.contains("already consumed") {
        StatusCode::CONFLICT
    } else if err.contains("not approved")
        || err.contains("activation required")
        || err.contains("sanctions clear")
    {
        StatusCode::FORBIDDEN
    } else if err.contains("unknown corridor")
        || err.contains("invalid")
        || err.contains("recipient not approved")
    {
        StatusCode::BAD_REQUEST
    } else {
        StatusCode::BAD_REQUEST
    };
    (status, err.to_string())
}

async fn get_credential(
    State(state): State<AppState>,
    Path(wallet): Path<String>,
) -> Result<Json<wisp_types::Credential>, StatusCode> {
    state
        .wallet_credential(&wallet)
        .await
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
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

async fn list_corridors(State(state): State<AppState>) -> Json<Vec<wisp_types::CorridorOption>> {
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

#[derive(Deserialize)]
struct ComputedRootsQuery {
    corridor_id: u32,
}

async fn computed_roots(
    axum::Extension(cfg): axum::Extension<Config>,
    State(state): State<AppState>,
    Query(query): Query<ComputedRootsQuery>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let roots = state
        .computed_roots_for_corridor(&cfg, query.corridor_id)
        .await
        .map_err(|err| (StatusCode::BAD_REQUEST, err))?;
    let snapshot = state.latest_root_snapshot(Some(query.corridor_id)).await;
    Ok(Json(json!({
        "corridor_id": query.corridor_id,
        "computed_roots": roots,
        "latest_root_snapshot": snapshot,
    })))
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
        return Err((
            StatusCode::UNAUTHORIZED,
            format!("webhook secret not configured for {provider}"),
        ));
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
        .or_else(|| {
            payload
                .get("id")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
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
        // Unit tests should not depend on on-chain events being available.
        cfg.compliance_id = None;
        let state = AppState::load(&cfg).await;
        router(cfg, state)
    }

    #[tokio::test]
    async fn publish_requires_auth() {
        let app = test_app().await;
        let res = app
            .oneshot(
                Request::post("/admin/roots/publish")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn computed_roots_requires_auth() {
        let app = test_app().await;
        let res = app
            .oneshot(
                Request::get("/admin/roots/computed?corridor_id=1")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn computed_roots_requires_activated_credentials() {
        let mut cfg = Config::from_env();
        cfg.api_token = Some("test-token".into());
        cfg.webhook_secrets = vec![("persona".into(), "shh".into())];
        cfg.fixtures_dir =
            concat!(env!("CARGO_MANIFEST_DIR"), "/../../../bindings/fixtures").into();
        let state = AppState::load(&cfg).await;
        seed_demo_user(&state).await;
        let app = router(cfg, state);
        let res = app
            .oneshot(
                Request::get("/admin/roots/computed?corridor_id=1")
                    .header("authorization", "Bearer test-token")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::BAD_REQUEST);
        let body = axum::body::to_bytes(res.into_body(), usize::MAX)
            .await
            .unwrap();
        let error = String::from_utf8(body.to_vec()).unwrap();
        assert!(error.contains("activated credentials"));
    }

    #[tokio::test]
    async fn well_known_issuer_returns_metadata() {
        let mut cfg = Config::from_env();
        cfg.api_token = Some("test-token".into());
        cfg.webhook_secrets = vec![("persona".into(), "shh".into())];
        cfg.fixtures_dir =
            concat!(env!("CARGO_MANIFEST_DIR"), "/../../../bindings/fixtures").into();
        cfg.issuer_public_key = Some("GISSUER".into());
        cfg.compliance_id = Some("CCOMPLIANCE".into());
        cfg.verifier_id = Some("CVERIFIER".into());
        cfg.expected_vk_hash = Some("deadbeef".into());
        let state = AppState::load(&cfg).await;
        let app = router(cfg.clone(), state);
        let res = app
            .oneshot(
                Request::get("/.well-known/wisp-issuer.json")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        let body = axum::body::to_bytes(res.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: Value = serde_json::from_slice(&body).unwrap();
        assert!(json.get("api_version").is_none());
        assert!(json.get("protocol_version").is_none());
        assert_eq!(json["issuer_stellar_address"], "GISSUER");
        assert_eq!(
            json["metadata_uri"],
            "http://127.0.0.1:3000/.well-known/wisp-issuer.json"
        );
        assert_eq!(json["service_url"], "http://127.0.0.1:3000");
        assert_eq!(json["compliance_contract_id"], "CCOMPLIANCE");
        assert_eq!(json["verifier_contract_id"], "CVERIFIER");
        assert_eq!(json["circuit_vk_hash"], "deadbeef");
        assert!(json.get("proof_package_schema").is_none());
        assert_eq!(json["network_passphrase"], cfg.network_passphrase);
    }

    #[tokio::test]
    async fn production_exposes_only_canonical_issuance_endpoints() {
        let mut cfg = Config::from_env();
        cfg.issuer_mode = "production".into();
        cfg.kyc_mode = "provider".into();
        cfg.fixture_profile = "disabled".into();
        cfg.issuer_public_key =
            Some("GACQZG6QDR7NI5QQ3YYLMX3UO5HJW7JSG2PE4BQZXM4RXXRPX4NT5H3Q".into());
        let state = AppState::load(&cfg).await;
        let app = router(cfg, state);

        let obsolete = app
            .clone()
            .oneshot(
                Request::post("/versioned/proof-packages")
                    .header("content-type", "application/json")
                    .body(Body::from("{}"))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert!(matches!(
            obsolete.status(),
            StatusCode::NOT_FOUND | StatusCode::UNAUTHORIZED
        ));

        let canonical = app
            .oneshot(
                Request::post("/credentials/activation-challenges")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{"wallet":"GACQZG6QDR7NI5QQ3YYLMX3UO5HJW7JSG2PE4BQZXM4RXXRPX4NT5H3Q","credential_commitment":"1"}"#,
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_ne!(canonical.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn webhook_requires_secret() {
        let app = test_app().await;
        let res = app
            .oneshot(
                Request::post("/provider/webhooks/persona")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"id":"evt_1"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn production_does_not_mount_demo_routes() {
        let mut cfg = Config::from_env();
        cfg.issuer_mode = "production".into();
        cfg.fixture_profile = "disabled".into();
        cfg.compliance_id = None;
        let state = AppState::load(&cfg).await;
        let app = router(cfg, state);

        let demo = app
            .oneshot(
                Request::post("/mock-kyc/challenge")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert!(
            matches!(
                demo.status(),
                StatusCode::NOT_FOUND | StatusCode::UNAUTHORIZED
            ),
            "demo route must not execute in production"
        );
    }
}
