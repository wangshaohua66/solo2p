use axum::{
    extract::State,
    http::{Request, StatusCode},
    middleware::Next,
    response::Response,
    RequestPartsExt,
    Json,
};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde_json::json;
use crate::models::user::Claims;
use crate::AppState;
use std::sync::Arc;
use uuid::Uuid;

pub async fn auth_middleware<B>(
    State(state): State<Arc<AppState>>,
    mut request: Request<B>,
    next: Next<B>,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    let auth_header = request
        .headers()
        .get("Authorization")
        .and_then(|header| header.to_str().ok())
        .and_then(|header| header.strip_prefix("Bearer "))
        .ok_or_else(|| {
            (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "code": -1, "message": "未提供认证令牌" })),
            )
        })?;

    let token_data = decode::<Claims>(
        auth_header,
        &DecodingKey::from_secret(state.jwt_secret.as_ref()),
        &Validation::new(Algorithm::HS256),
    )
    .map_err(|e| {
        let message = match e.kind() {
            jsonwebtoken::errors::ErrorKind::ExpiredSignature => "令牌已过期",
            jsonwebtoken::errors::ErrorKind::InvalidToken => "无效的令牌",
            _ => "认证失败",
        };
        (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "code": -1, "message": message })),
        )
    })?;

    request.extensions_mut().insert(token_data.claims);

    Ok(next.run(request).await)
}

pub fn create_jwt(
    user_id: Uuid,
    username: &str,
    role: &str,
    secret: &str,
    expiration_hours: u64,
) -> Result<String, jsonwebtoken::errors::Error> {
    use jsonwebtoken::{encode, EncodingKey, Header};
    use std::time::{SystemTime, UNIX_EPOCH};

    let expiration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as usize
        + (expiration_hours * 3600) as usize;

    let claims = Claims {
        sub: user_id,
        username: username.to_string(),
        role: role.to_string(),
        exp: expiration,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_ref()),
    )
}

pub async fn require_role(
    required_role: &str,
    claims: &Claims,
) -> Result<(), (StatusCode, Json<serde_json::Value>)> {
    let allowed_roles = match required_role {
        "admin" => vec!["admin"],
        "inspector" => vec!["admin", "inspector"],
        "inspector_user" => vec!["admin", "inspector", "inspector_user"],
        "unit_contact" => vec!["admin", "inspector", "unit_contact"],
        _ => vec![required_role],
    };

    if !allowed_roles.contains(&claims.role.as_str()) {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "code": -1, "message": "权限不足" })),
        ));
    }

    Ok(())
}
