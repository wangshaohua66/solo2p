use axum::{
    extract::{State, Path, Query},
    Json,
    Extension,
    body::Bytes,
};
use std::sync::Arc;
use uuid::Uuid;
use chrono::NaiveDate;
use calamine::{Reader, open_workbook_from_rs, Xlsx};

use crate::AppState;
use crate::models::device::{Device, CreateDevice, UpdateDevice, DeviceQuery, DeviceListResponse, TimelineEvent, ImportResult, ImportError};
use crate::models::common::ApiResponse;
use crate::models::user::Claims;

pub async fn list_devices(
    State(state): State<Arc<AppState>>,
    Query(query): Query<DeviceQuery>,
    Extension(claims): Extension<Claims>,
) -> Json<ApiResponse<DeviceListResponse>> {
    let page = query.page.unwrap_or(1).max(1);
    let page_size = query.page_size.unwrap_or(20).min(100);
    let offset = (page - 1) * page_size;

    let mut sql_conditions: Vec<String> = Vec::new();
    let mut params: Vec<String> = Vec::new();
    let mut param_idx = 1;

    if let Some(device_type) = &query.device_type {
        sql_conditions.push(format!("d.device_type = ${}", param_idx));
        params.push(device_type.clone());
        param_idx += 1;
    }

    if let Some(unit_id) = &query.unit_id {
        sql_conditions.push(format!("d.unit_id = ${}", param_idx));
        params.push(unit_id.to_string());
        param_idx += 1;
    }

    if let Some(area) = &query.area {
        sql_conditions.push(format!("d.area = ${}", param_idx));
        params.push(area.clone());
        param_idx += 1;
    }

    if let Some(status) = &query.status {
        sql_conditions.push(format!("d.status = ${}", param_idx));
        params.push(status.clone());
        param_idx += 1;
    }

    if let Some(registration_code) = &query.registration_code {
        sql_conditions.push(format!("d.registration_code LIKE ${}", param_idx));
        params.push(format!("%{}%", registration_code));
        param_idx += 1;
    }

    if let Some(keyword) = &query.keyword {
        let like = format!("%{}%", keyword);
        sql_conditions.push(format!("(d.device_name LIKE ${} OR d.registration_code LIKE ${})", param_idx, param_idx));
        params.push(like);
        param_idx += 1;
    }

    if let Some(inspection_status) = &query.inspection_status {
        match inspection_status.as_str() {
            "expired" => {
                sql_conditions.push("d.next_inspection_date < CURRENT_DATE".to_string());
            }
            "warning" => {
                sql_conditions.push("d.next_inspection_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'".to_string());
            }
            "normal" => {
                sql_conditions.push("d.next_inspection_date > CURRENT_DATE + INTERVAL '30 days'".to_string());
            }
            _ => {}
        }
    }

    if claims.role == "unit_contact" {
        sql_conditions.push(format!("d.unit_id = (SELECT unit_id FROM users WHERE id = ${})", param_idx));
        params.push(claims.sub.to_string());
        param_idx += 1;
    }

    let where_clause = if sql_conditions.is_empty() {
        String::from("")
    } else {
        format!("WHERE {}", sql_conditions.join(" AND "))
    };

    let sort_by = query.sort_by.unwrap_or_else(|| "created_at".to_string());
    let sort_order = query.sort_order.unwrap_or_else(|| "DESC".to_string());

    let sql = format!(
        "SELECT d.* FROM devices d {} ORDER BY d.{} {} LIMIT {} OFFSET {}",
        where_clause,
        sort_by,
        sort_order,
        page_size,
        offset
    );

    let count_sql = format!(
        "SELECT COUNT(*) FROM devices d {}",
        where_clause
    );

    let items: Vec<Device> = sqlx::query_as(&sql)
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();

    let total: i64 = sqlx::query_scalar(&count_sql)
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);

    Json(ApiResponse::success(DeviceListResponse {
        items,
        total,
        page,
        page_size,
    }))
}

pub async fn get_device(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Json<ApiResponse<Device>> {
    let result = sqlx::query_as!(
        Device,
        r#"
        SELECT * FROM devices WHERE id = $1
        "#,
        id
    )
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(device) => Json(ApiResponse::success(device)),
        Err(_) => Json(ApiResponse::error("设备不存在")),
    }
}

pub async fn create_device(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateDevice>,
) -> Json<ApiResponse<Device>> {
    let result = sqlx::query_as!(
        Device,
        r#"
        INSERT INTO devices (
            registration_code, device_type, device_name, model, manufacturer,
            manufacture_date, installation_date, acceptance_date, unit_id,
            location, area, custom_cycle_months
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
        "#,
        payload.registration_code,
        payload.device_type,
        payload.device_name,
        payload.model,
        payload.manufacturer,
        payload.manufacture_date,
        payload.installation_date,
        payload.acceptance_date,
        payload.unit_id,
        payload.location,
        payload.area,
        payload.custom_cycle_months
    )
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(device) => Json(ApiResponse::success(device)),
        Err(e) => Json(ApiResponse::error(&format!("创建设备失败: {}", e))),
    }
}

pub async fn update_device(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateDevice>,
) -> Json<ApiResponse<Device>> {
    let result = sqlx::query_as!(
        Device,
        r#"
        UPDATE devices SET
            device_name = COALESCE($1, device_name),
            model = COALESCE($2, model),
            manufacturer = COALESCE($3, manufacturer),
            manufacture_date = COALESCE($4, manufacture_date),
            installation_date = COALESCE($5, installation_date),
            acceptance_date = COALESCE($6, acceptance_date),
            location = COALESCE($7, location),
            area = COALESCE($8, area),
            status = COALESCE($9, status),
            safety_level = COALESCE($10, safety_level),
            custom_cycle_months = COALESCE($11, custom_cycle_months),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $12
        RETURNING *
        "#,
        payload.device_name,
        payload.model,
        payload.manufacturer,
        payload.manufacture_date,
        payload.installation_date,
        payload.acceptance_date,
        payload.location,
        payload.area,
        payload.status,
        payload.safety_level,
        payload.custom_cycle_months,
        id
    )
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(device) => Json(ApiResponse::success(device)),
        Err(e) => Json(ApiResponse::error(&format!("更新设备失败: {}", e))),
    }
}

pub async fn delete_device(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Json<ApiResponse<String>> {
    let result = sqlx::query!("DELETE FROM devices WHERE id = $1", id)
        .execute(&state.db)
        .await;

    match result {
        Ok(_) => Json(ApiResponse::success("删除成功".to_string())),
        Err(e) => Json(ApiResponse::error(&format!("删除失败: {}", e))),
    }
}

pub async fn get_device_timeline(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Json<ApiResponse<Vec<TimelineEvent>>> {
    let mut events: Vec<TimelineEvent> = Vec::new();

    let inspections = sqlx::query!(
        r#"
        SELECT id, 'inspection' as event_type, actual_date as event_date,
               CONCAT('检验 - ', conclusion) as title,
               findings as description,
               created_at
        FROM inspections
        WHERE device_id = $1 AND status = 'completed'
        ORDER BY actual_date DESC
        "#,
        id
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    for insp in inspections {
        events.push(TimelineEvent {
            id: insp.id,
            event_type: "inspection".to_string(),
            event_date: insp.event_date.unwrap_or_default(),
            title: insp.title.unwrap_or_else(|| "检验记录".to_string()),
            description: insp.description.unwrap_or_default(),
            operator: None,
            created_at: insp.created_at,
        });
    }

    let hazards = sqlx::query!(
        r#"
        SELECT id, 'hazard' as event_type, created_at::date as event_date,
               CONCAT('隐患 - ', hazard_type) as title,
               description,
               created_at
        FROM hazards
        WHERE device_id = $1
        ORDER BY created_at DESC
        "#,
        id
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    for h in hazards {
        events.push(TimelineEvent {
            id: h.id,
            event_type: "hazard".to_string(),
            event_date: h.event_date,
            title: h.title.unwrap_or_else(|| "隐患记录".to_string()),
            description: h.description,
            operator: None,
            created_at: h.created_at,
        });
    }

    events.sort_by(|a, b| b.event_date.cmp(&a.event_date));

    Json(ApiResponse::success(events))
}

pub async fn import_devices(
    State(state): State<Arc<AppState>>,
    bytes: Bytes,
) -> Json<ApiResponse<ImportResult>> {
    let mut result = ImportResult {
        total: 0,
        success: 0,
        failed: 0,
        errors: Vec::new(),
    };

    let cursor = std::io::Cursor::new(bytes);
    
    let mut workbook: Xlsx<_> = match open_workbook_from_rs(cursor) {
        Ok(wb) => wb,
        Err(e) => {
            return Json(ApiResponse::error(&format!("无法打开Excel文件: {}", e)));
        }
    };

    let sheet = match workbook.worksheet_range("Sheet1") {
        Some(Ok(s)) => s,
        _ => {
            return Json(ApiResponse::error("无法读取工作表 Sheet1"));
        }
    };

    result.total = sheet.rows().count().saturating_sub(1);

    for (row_idx, row) in sheet.rows().enumerate().skip(1) {
        if row.is_empty() {
            continue;
        }

        let registration_code = row.get(0).and_then(|c| c.get_string()).unwrap_or("").to_string();
        let device_type = row.get(1).and_then(|c| c.get_string()).unwrap_or("").to_string();
        let device_name = row.get(2).and_then(|c| c.get_string()).unwrap_or("").to_string();

        if registration_code.is_empty() {
            result.failed += 1;
            result.errors.push(ImportError {
                row: row_idx + 1,
                field: "registration_code".to_string(),
                message: "注册代码不能为空".to_string(),
            });
            continue;
        }

        if device_type.is_empty() {
            result.failed += 1;
            result.errors.push(ImportError {
                row: row_idx + 1,
                field: "device_type".to_string(),
                message: "设备类型不能为空".to_string(),
            });
            continue;
        }

        result.success += 1;
    }

    Json(ApiResponse::success(result))
}

pub async fn export_devices(
    State(state): State<Arc<AppState>>,
    Query(query): Query<DeviceQuery>,
) -> Json<ApiResponse<Vec<Device>>> {
    let devices: Vec<Device> = sqlx::query_as!(
        Device,
        "SELECT * FROM devices ORDER BY created_at DESC LIMIT 1000"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    Json(ApiResponse::success(devices))
}
