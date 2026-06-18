use axum::{
    extract::{State, Path, Query},
    Json,
};
use std::sync::Arc;
use uuid::Uuid;

use crate::AppState;
use crate::models::hazard::{
    Hazard, CreateHazard, UpdateHazard, HazardQuery, 
    HazardListResponse, ReviewHazard
};
use crate::models::common::ApiResponse;

pub async fn list_hazards(
    State(state): State<Arc<AppState>>,
    Query(query): Query<HazardQuery>,
) -> Json<ApiResponse<HazardListResponse>> {
    let page = query.page.unwrap_or(1).max(1);
    let page_size = query.page_size.unwrap_or(20).min(100);
    let offset = (page - 1) * page_size;

    let mut sql_conditions: Vec<String> = Vec::new();
    let mut params: Vec<String> = Vec::new();
    let mut param_idx = 1;

    if let Some(device_id) = &query.device_id {
        sql_conditions.push(format!("device_id = ${}", param_idx));
        params.push(device_id.to_string());
        param_idx += 1;
    }

    if let Some(inspection_id) = &query.inspection_id {
        sql_conditions.push(format!("inspection_id = ${}", param_idx));
        params.push(inspection_id.to_string());
        param_idx += 1;
    }

    if let Some(status) = &query.status {
        sql_conditions.push(format!("status = ${}", param_idx));
        params.push(status.clone());
        param_idx += 1;
    }

    if let Some(severity) = &query.severity {
        sql_conditions.push(format!("severity = ${}", param_idx));
        params.push(severity.clone());
        param_idx += 1;
    }

    if let Some(hazard_type) = &query.hazard_type {
        sql_conditions.push(format!("hazard_type = ${}", param_idx));
        params.push(hazard_type.clone());
        param_idx += 1;
    }

    if let Some(supervision_level) = &query.supervision_level {
        sql_conditions.push(format!("supervision_level = ${}", param_idx));
        params.push(supervision_level.clone());
        param_idx += 1;
    }

    let where_clause = if sql_conditions.is_empty() {
        String::from("")
    } else {
        format!("WHERE {}", sql_conditions.join(" AND "))
    };

    let sql = format!(
        "SELECT * FROM hazards {} ORDER BY created_at DESC LIMIT {} OFFSET {}",
        where_clause, page_size, offset
    );

    let count_sql = format!(
        "SELECT COUNT(*) FROM hazards {}",
        where_clause
    );

    let items: Vec<Hazard> = sqlx::query_as(&sql)
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();

    let total: i64 = sqlx::query_scalar(&count_sql)
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);

    Json(ApiResponse::success(HazardListResponse {
        items,
        total,
        page,
        page_size,
    }))
}

pub async fn get_hazard(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Json<ApiResponse<Hazard>> {
    let result = sqlx::query_as!(
        Hazard,
        r#"
        SELECT * FROM hazards WHERE id = $1
        "#,
        id
    )
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(hazard) => Json(ApiResponse::success(hazard)),
        Err(_) => Json(ApiResponse::error("隐患记录不存在")),
    }
}

pub async fn create_hazard(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateHazard>,
) -> Json<ApiResponse<Hazard>> {
    let result = sqlx::query_as!(
        Hazard,
        r#"
        INSERT INTO hazards (
            device_id, inspection_id, hazard_type, description, 
            severity, inspector_id, unit_contact_id, deadline
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        "#,
        payload.device_id,
        payload.inspection_id,
        payload.hazard_type,
        payload.description,
        payload.severity,
        payload.inspector_id,
        payload.unit_contact_id,
        payload.deadline
    )
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(hazard) => Json(ApiResponse::success(hazard)),
        Err(e) => Json(ApiResponse::error(&format!("创建隐患记录失败: {}", e))),
    }
}

pub async fn update_hazard(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateHazard>,
) -> Json<ApiResponse<Hazard>> {
    let result = sqlx::query_as!(
        Hazard,
        r#"
        UPDATE hazards SET
            hazard_type = COALESCE($1, hazard_type),
            description = COALESCE($2, description),
            severity = COALESCE($3, severity),
            status = COALESCE($4, status),
            deadline = COALESCE($5, deadline),
            rectification_description = COALESCE($6, rectification_description),
            rectification_files = COALESCE($7, rectification_files),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $8
        RETURNING *
        "#,
        payload.hazard_type,
        payload.description,
        payload.severity,
        payload.status,
        payload.deadline,
        payload.rectification_description,
        payload.rectification_files,
        id
    )
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(hazard) => Json(ApiResponse::success(hazard)),
        Err(e) => Json(ApiResponse::error(&format!("更新隐患记录失败: {}", e))),
    }
}

pub async fn review_hazard(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
    Json(payload): Json<ReviewHazard>,
) -> Json<ApiResponse<Hazard>> {
    let new_status = if payload.review_result == "pass" {
        "closed"
    } else {
        "rectifying"
    };

    let result = sqlx::query_as!(
        Hazard,
        r#"
        UPDATE hazards SET
            review_date = $1,
            review_result = $2,
            reviewer_id = $3,
            status = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING *
        "#,
        payload.review_date,
        payload.review_result,
        payload.reviewer_id,
        new_status,
        id
    )
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(hazard) => Json(ApiResponse::success(hazard)),
        Err(e) => Json(ApiResponse::error(&format!("复查失败: {}", e))),
    }
}
