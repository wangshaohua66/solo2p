use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub real_name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub role: String,
    pub unit_id: Option<Uuid>,
    pub area: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateUser {
    pub username: String,
    pub password: String,
    pub real_name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub role: String,
    pub unit_id: Option<Uuid>,
    pub area: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUser {
    pub real_name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub role: Option<String>,
    pub unit_id: Option<Uuid>,
    pub area: Option<String>,
    pub status: Option<String>,
    pub password: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: User,
    pub expires_in: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub username: String,
    pub role: String,
    pub exp: usize,
}

#[derive(Debug, Deserialize)]
pub struct UserQuery {
    pub page: Option<u32>,
    pub page_size: Option<u32>,
    pub role: Option<String>,
    pub status: Option<String>,
    pub keyword: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UserListResponse {
    pub items: Vec<User>,
    pub total: i64,
    pub page: u32,
    pub page_size: u32,
}
