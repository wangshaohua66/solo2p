use axum::{
    extract::State,
    Json,
    Extension,
};
use serde_json::json;
use std::sync::Arc;
use sqlx::PgPool;
use bcrypt::{hash, verify, DEFAULT_COST};

use crate::AppState;
use crate::models::user::{LoginRequest, LoginResponse, User, Claims};
use crate::middleware::auth::create_jwt;
use crate::models::common::ApiResponse;

pub async fn login(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<LoginRequest>,
) -> Json<ApiResponse<LoginResponse>> {
    let user: Result<User, _> = sqlx::query_as!(
        User,
        r#"
        SELECT id, username, real_name, email, phone, role, unit_id, area, status, created_at, updated_at
        FROM users
        WHERE username = $1 AND status = 'active'
        "#,
        payload.username
    )
    .fetch_one(&state.db)
    .await;

    let user = match user {
        Ok(u) => u,
        Err(_) => {
            return Json(ApiResponse::error("用户名或密码错误"));
        }
    };

    let password_hash: String = match sqlx::query_scalar!(
        "SELECT password_hash FROM users WHERE id = $1",
        user.id
    )
    .fetch_one(&state.db)
    .await
    {
        Ok(h) => h,
        Err(_) => {
            return Json(ApiResponse::error("系统错误"));
        }
    };

    match verify(&payload.password, &password_hash) {
        Ok(valid) if valid => {
            let expiration_hours = 24;
            let token = create_jwt(
                user.id,
                &user.username,
                &user.role,
                &state.jwt_secret,
                expiration_hours,
            )
            .unwrap_or_default();

            Json(ApiResponse::success(LoginResponse {
                token,
                user,
                expires_in: expiration_hours * 3600,
            }))
        }
        _ => Json(ApiResponse::error("用户名或密码错误")),
    }
}

pub async fn register(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateUserRequest>,
) -> Json<ApiResponse<User>> {
    let password_hash = match hash(&payload.password, DEFAULT_COST) {
        Ok(h) => h,
        Err(_) => return Json(ApiResponse::error("密码加密失败")),
    };

    let result = sqlx::query_as!(
        User,
        r#"
        INSERT INTO users (username, password_hash, real_name, email, phone, role, unit_id, area)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, username, real_name, email, phone, role, unit_id, area, status, created_at, updated_at
        "#,
        payload.username,
        password_hash,
        payload.real_name,
        payload.email,
        payload.phone,
        payload.role,
        payload.unit_id,
        payload.area
    )
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(user) => Json(ApiResponse::success(user)),
        Err(e) => Json(ApiResponse::error(&format!("注册失败: {}", e))),
    }
}

#[derive(serde::Deserialize)]
pub struct CreateUserRequest {
    pub username: String,
    pub password: String,
    pub real_name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub role: String,
    pub unit_id: Option<uuid::Uuid>,
    pub area: Option<String>,
}

pub async fn me(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
) -> Json<ApiResponse<User>> {
    let result = sqlx::query_as!(
        User,
        r#"
        SELECT id, username, real_name, email, phone, role, unit_id, area, status, created_at, updated_at
        FROM users
        WHERE id = $1
        "#,
        claims.sub
    )
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(user) => Json(ApiResponse::success(user)),
        Err(e) => Json(ApiResponse::error(&format!("获取用户信息失败: {}", e))),
    }
}
