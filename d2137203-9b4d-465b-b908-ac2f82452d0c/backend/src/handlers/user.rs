use axum::{
    extract::{State, Path, Query},
    Json,
    Extension,
};
use std::sync::Arc;
use sqlx::PgPool;
use bcrypt::{hash, DEFAULT_COST};

use crate::AppState;
use crate::models::user::{User, CreateUser, UpdateUser, UserQuery, UserListResponse, Claims};
use crate::models::common::ApiResponse;

pub async fn list_users(
    State(state): State<Arc<AppState>>,
    Query(query): Query<UserQuery>,
) -> Json<ApiResponse<UserListResponse>> {
    let page = query.page.unwrap_or(1).max(1);
    let page_size = query.page_size.unwrap_or(20).min(100);
    let offset = (page - 1) * page_size;

    let mut sql = "SELECT id, username, real_name, email, phone, role, unit_id, area, status, created_at, updated_at FROM users WHERE 1=1".to_string();
    let mut count_sql = "SELECT COUNT(*) FROM users WHERE 1=1".to_string();
    let mut params: Vec<String> = Vec::new();
    let mut param_idx = 1;

    if let Some(role) = &query.role {
        sql.push_str(&format!(" AND role = ${}", param_idx));
        count_sql.push_str(&format!(" AND role = ${}", param_idx));
        params.push(role.clone());
        param_idx += 1;
    }

    if let Some(status) = &query.status {
        sql.push_str(&format!(" AND status = ${}", param_idx));
        count_sql.push_str(&format!(" AND status = ${}", param_idx));
        params.push(status.clone());
        param_idx += 1;
    }

    if let Some(keyword) = &query.keyword {
        let like = format!("%{}%", keyword);
        sql.push_str(&format!(" AND (username LIKE ${} OR real_name LIKE ${})", param_idx, param_idx));
        count_sql.push_str(&format!(" AND (username LIKE ${} OR real_name LIKE ${})", param_idx, param_idx));
        params.push(like);
        param_idx += 1;
    }

    sql.push_str(" ORDER BY created_at DESC");
    sql.push_str(&format!(" LIMIT {} OFFSET {}", page_size, offset));

    let items: Vec<User> = sqlx::query_as(&sql)
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();

    let total: i64 = sqlx::query_scalar(&count_sql)
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);

    Json(ApiResponse::success(UserListResponse {
        items,
        total,
        page,
        page_size,
    }))
}

pub async fn get_user(
    State(state): State<Arc<AppState>>,
    Path(id): Path<uuid::Uuid>,
) -> Json<ApiResponse<User>> {
    let result = sqlx::query_as!(
        User,
        r#"
        SELECT id, username, real_name, email, phone, role, unit_id, area, status, created_at, updated_at
        FROM users WHERE id = $1
        "#,
        id
    )
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(user) => Json(ApiResponse::success(user)),
        Err(_) => Json(ApiResponse::error("用户不存在")),
    }
}

pub async fn create_user(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateUser>,
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
        Err(e) => Json(ApiResponse::error(&format!("创建用户失败: {}", e))),
    }
}

pub async fn update_user(
    State(state): State<Arc<AppState>>,
    Path(id): Path<uuid::Uuid>,
    Json(payload): Json<UpdateUser>,
) -> Json<ApiResponse<User>> {
    let mut sets = Vec::new();
    let mut params: Vec<&dyn sqlx::postgres::PgHasArrayType> = Vec::new();
    
    let mut idx = 1;

    if let Some(real_name) = &payload.real_name {
        sets.push(format!("real_name = ${}", idx));
        idx += 1;
    }
    if let Some(email) = &payload.email {
        sets.push(format!("email = ${}", idx));
        idx += 1;
    }
    if let Some(phone) = &payload.phone {
        sets.push(format!("phone = ${}", idx));
        idx += 1;
    }
    if let Some(role) = &payload.role {
        sets.push(format!("role = ${}", idx));
        idx += 1;
    }
    if let Some(unit_id) = &payload.unit_id {
        sets.push(format!("unit_id = ${}", idx));
        idx += 1;
    }
    if let Some(area) = &payload.area {
        sets.push(format!("area = ${}", idx));
        idx += 1;
    }
    if let Some(status) = &payload.status {
        sets.push(format!("status = ${}", idx));
        idx += 1;
    }

    let password_hash = if let Some(password) = &payload.password {
        match hash(password, DEFAULT_COST) {
            Ok(h) => Some(h),
            Err(_) => return Json(ApiResponse::error("密码加密失败")),
        }
    } else {
        None
    };

    if password_hash.is_some() {
        sets.push(format!("password_hash = ${}", idx));
        idx += 1;
    }

    sets.push(format!("updated_at = CURRENT_TIMESTAMP"));

    let sql = format!(
        "UPDATE users SET {} WHERE id = ${} RETURNING id, username, real_name, email, phone, role, unit_id, area, status, created_at, updated_at",
        sets.join(", "),
        idx
    );

    let result = sqlx::query_as::<_, User>(&sql)
        .bind(&payload.real_name)
        .bind(&payload.email)
        .bind(&payload.phone)
        .bind(&payload.role)
        .bind(&payload.unit_id)
        .bind(&payload.area)
        .bind(&payload.status)
        .bind(&password_hash)
        .bind(id)
        .fetch_one(&state.db)
        .await;

    match result {
        Ok(user) => Json(ApiResponse::success(user)),
        Err(e) => Json(ApiResponse::error(&format!("更新用户失败: {}", e))),
    }
}

pub async fn delete_user(
    State(state): State<Arc<AppState>>,
    Path(id): Path<uuid::Uuid>,
) -> Json<ApiResponse<String>> {
    let result = sqlx::query!("DELETE FROM users WHERE id = $1", id)
        .execute(&state.db)
        .await;

    match result {
        Ok(_) => Json(ApiResponse::success("删除成功".to_string())),
        Err(e) => Json(ApiResponse::error(&format!("删除失败: {}", e))),
    }
}
