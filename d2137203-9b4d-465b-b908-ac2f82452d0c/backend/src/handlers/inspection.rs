use axum::{
    extract::{State, Path, Query},
    Json,
};
use std::sync::Arc;
use uuid::Uuid;
use chrono::{NaiveDate, Duration};

use crate::AppState;
use crate::models::inspection::{
    Inspection, CreateInspection, UpdateInspection, InspectionQuery, 
    InspectionListResponse, NextDateCalculation, NextDateResponse, WarningDate
};
use crate::models::common::ApiResponse;
use crate::services::scheduler::calculate_next_inspection_date;

pub async fn list_inspections(
    State(state): State<Arc<AppState>>,
    Query(query): Query<InspectionQuery>,
) -> Json<ApiResponse<InspectionListResponse>> {
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

    if let Some(inspector_id) = &query.inspector_id {
        sql_conditions.push(format!("inspector_id = ${}", param_idx));
        params.push(inspector_id.to_string());
        param_idx += 1;
    }

    if let Some(status) = &query.status {
        sql_conditions.push(format!("status = ${}", param_idx));
        params.push(status.clone());
        param_idx += 1;
    }

    if let Some(inspection_type) = &query.inspection_type {
        sql_conditions.push(format!("inspection_type = ${}", param_idx));
        params.push(inspection_type.clone());
        param_idx += 1;
    }

    let where_clause = if sql_conditions.is_empty() {
        String::from("")
    } else {
        format!("WHERE {}", sql_conditions.join(" AND "))
    };

    let sql = format!(
        "SELECT * FROM inspections {} ORDER BY created_at DESC LIMIT {} OFFSET {}",
        where_clause, page_size, offset
    );

    let count_sql = format!(
        "SELECT COUNT(*) FROM inspections {}",
        where_clause
    );

    let items: Vec<Inspection> = sqlx::query_as(&sql)
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();

    let total: i64 = sqlx::query_scalar(&count_sql)
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);

    Json(ApiResponse::success(InspectionListResponse {
        items,
        total,
        page,
        page_size,
    }))
}

pub async fn get_inspection(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Json<ApiResponse<Inspection>> {
    let result = sqlx::query_as!(
        Inspection,
        r#"
        SELECT * FROM inspections WHERE id = $1
        "#,
        id
    )
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(inspection) => Json(ApiResponse::success(inspection)),
        Err(_) => Json(ApiResponse::error("检验记录不存在")),
    }
}

pub async fn create_inspection(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateInspection>,
) -> Json<ApiResponse<Inspection>> {
    let result = sqlx::query_as!(
        Inspection,
        r#"
        INSERT INTO inspections (device_id, inspection_type, inspector_id, plan_date, status)
        VALUES ($1, $2, $3, $4, 'pending')
        RETURNING *
        "#,
        payload.device_id,
        payload.inspection_type,
        payload.inspector_id,
        payload.plan_date
    )
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(inspection) => Json(ApiResponse::success(inspection)),
        Err(e) => Json(ApiResponse::error(&format!("创建检验任务失败: {}", e))),
    }
}

pub async fn update_inspection(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateInspection>,
) -> Json<ApiResponse<Inspection>> {
    let result = sqlx::query_as!(
        Inspection,
        r#"
        UPDATE inspections SET
            inspector_id = COALESCE($1, inspector_id),
            plan_date = COALESCE($2, plan_date),
            actual_date = COALESCE($3, actual_date),
            status = COALESCE($4, status),
            conclusion = COALESCE($5, conclusion),
            safety_level = COALESCE($6, safety_level),
            report_number = COALESCE($7, report_number),
            report_url = COALESCE($8, report_url),
            findings = COALESCE($9, findings),
            next_inspection_date = COALESCE($10, next_inspection_date),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $11
        RETURNING *
        "#,
        payload.inspector_id,
        payload.plan_date,
        payload.actual_date,
        payload.status,
        payload.conclusion,
        payload.safety_level,
        payload.report_number,
        payload.report_url,
        payload.findings,
        payload.next_inspection_date,
        id
    )
    .fetch_one(&state.db)
    .await;

    if let Ok(ref insp) = result {
        if insp.status == "completed" && insp.next_inspection_date.is_some() {
            let _ = sqlx::query!(
                r#"
                UPDATE devices 
                SET last_inspection_date = $1, 
                    next_inspection_date = $2,
                    safety_level = COALESCE($3, safety_level),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $4
                "#,
                insp.actual_date,
                insp.next_inspection_date,
                insp.safety_level,
                insp.device_id
            )
            .execute(&state.db)
            .await;
        }
    }

    match result {
        Ok(inspection) => Json(ApiResponse::success(inspection)),
        Err(e) => Json(ApiResponse::error(&format!("更新检验记录失败: {}", e))),
    }
}

pub async fn generate_report(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Json<ApiResponse<String>> {
    let result = sqlx::query_as!(
        Inspection,
        "SELECT * FROM inspections WHERE id = $1",
        id
    )
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(_) => {
            Json(ApiResponse::success("报告生成功能开发中".to_string()))
        }
        Err(_) => Json(ApiResponse::error("检验记录不存在")),
    }
}

pub async fn calculate_next_date(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<NextDateCalculation>,
) -> Json<ApiResponse<NextDateResponse>> {
    let (next_date, cycle_months) = calculate_next_inspection_date(
        &payload.device_type,
        payload.last_inspection_date,
        payload.conclusion.as_deref(),
        payload.custom_cycle_months,
    );

    let warning_days_1 = 30;
    let warning_days_2 = 7;

    let warning_dates = vec![
        WarningDate {
            warning_type: "level_1".to_string(),
            warning_date: next_date - Duration::days(warning_days_1),
            days_remaining: warning_days_1,
        },
        WarningDate {
            warning_type: "level_2".to_string(),
            warning_date: next_date - Duration::days(warning_days_2),
            days_remaining: warning_days_2,
        },
    ];

    Json(ApiResponse::success(NextDateResponse {
        next_inspection_date: next_date,
        cycle_months,
        warning_dates,
    }))
}
