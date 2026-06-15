use axum::{
    extract::Request,
    http::{header, StatusCode},
    middleware::Next,
    response::Response,
};

use crate::config::Config;

pub async fn require_token(
    axum::Extension(cfg): axum::Extension<Config>,
    req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let Some(expected) = cfg.api_token.as_ref() else {
        return Err(StatusCode::UNAUTHORIZED);
    };
    let auth = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let token = auth.strip_prefix("Bearer ").unwrap_or("");
    if token == expected {
        Ok(next.run(req).await)
    } else {
        Err(StatusCode::UNAUTHORIZED)
    }
}
