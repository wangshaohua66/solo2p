use juniper::{graphql_object, FieldResult, Context};
use uuid::Uuid;
use chrono::{NaiveDate, DateTime, Utc};
use std::sync::Arc;
use crate::AppState;

impl Context for AppState {}

pub struct Query;

#[graphql_object(context = AppState)]
impl Query {
    fn api_version() -> &'static str {
        "1.0.0"
    }

    async fn device_stats(context: &AppState) -> FieldResult<DeviceStats> {
        let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM devices")
            .fetch_one(&context.db)
            .await
            .unwrap_or(0);

        let by_type: Vec<(String, i64)> = sqlx::query_as(
            "SELECT device_type, COUNT(*) as count FROM devices GROUP BY device_type"
        )
        .fetch_all(&context.db)
        .await
        .unwrap_or_default();

        let expired: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM devices WHERE next_inspection_date < CURRENT_DATE"
        )
        .fetch_one(&context.db)
        .await
        .unwrap_or(0);

        let warning: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM devices WHERE next_inspection_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'"
        )
        .fetch_one(&context.db)
        .await
        .unwrap_or(0);

        Ok(DeviceStats {
            total,
            by_type: by_type.into_iter().map(|(t, c)| TypeCount { device_type: t, count: c }).collect(),
            expired,
            warning,
            normal: total - expired - warning,
        })
    }

    async fn inspection_stats(context: &AppState) -> FieldResult<InspectionStats> {
        let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM inspections")
            .fetch_one(&context.db)
            .await
            .unwrap_or(0);

        let completed: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM inspections WHERE status = 'completed'"
        )
        .fetch_one(&context.db)
        .await
        .unwrap_or(0);

        let pending: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM inspections WHERE status = 'pending'"
        )
        .fetch_one(&context.db)
        .await
        .unwrap_or(0);

        let in_progress: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM inspections WHERE status = 'in_progress'"
        )
        .fetch_one(&context.db)
        .await
        .unwrap_or(0);

        Ok(InspectionStats {
            total,
            completed,
            pending,
            in_progress,
            completion_rate: if total > 0 {
                completed as f64 / total as f64
            } else {
                0.0
            },
        })
    }

    async fn hazard_stats(context: &AppState) -> FieldResult<HazardStats> {
        let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM hazards")
            .fetch_one(&context.db)
            .await
            .unwrap_or(0);

        let by_severity: Vec<(String, i64)> = sqlx::query_as(
            "SELECT severity, COUNT(*) as count FROM hazards GROUP BY severity"
        )
        .fetch_all(&context.db)
        .await
        .unwrap_or_default();

        let by_status: Vec<(String, i64)> = sqlx::query_as(
            "SELECT status, COUNT(*) as count FROM hazards GROUP BY status"
        )
        .fetch_all(&context.db)
        .await
        .unwrap_or_default();

        let pending: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM hazards WHERE status = 'pending'"
        )
        .fetch_one(&context.db)
        .await
        .unwrap_or(0);

        let rectifying: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM hazards WHERE status = 'rectifying'"
        )
        .fetch_one(&context.db)
        .await
        .unwrap_or(0);

        let closed: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM hazards WHERE status = 'closed'"
        )
        .fetch_one(&context.db)
        .await
        .unwrap_or(0);

        Ok(HazardStats {
            total,
            by_severity: by_severity.into_iter().map(|(s, c)| SeverityCount { severity: s, count: c }).collect(),
            by_status: by_status.into_iter().map(|(s, c)| StatusCount { status: s, count: c }).collect(),
            pending,
            rectifying,
            closed,
        })
    }

    async fn devices(
        context: &AppState,
        page: Option<i32>,
        page_size: Option<i32>,
        device_type: Option<String>,
        area: Option<String>,
    ) -> FieldResult<DeviceList> {
        let page = page.unwrap_or(1).max(1);
        let page_size = page_size.unwrap_or(20).min(100);
        let offset = (page - 1) * page_size;

        let items: Vec<Device> = sqlx::query_as::<_, Device>(
            "SELECT * FROM devices ORDER BY created_at DESC LIMIT $1 OFFSET $2"
        )
        .bind(page_size)
        .bind(offset)
        .fetch_all(&context.db)
        .await
        .unwrap_or_default();

        let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM devices")
            .fetch_one(&context.db)
            .await
            .unwrap_or(0);

        Ok(DeviceList {
            items,
            total,
            page,
            page_size,
        })
    }

    async fn area_stats(context: &AppState) -> FieldResult<Vec<AreaStats>> {
        let stats: Vec<AreaStats> = sqlx::query_as::<_, AreaStats>(
            r#"
            SELECT 
                area,
                COUNT(*) as device_count,
                SUM(CASE WHEN next_inspection_date < CURRENT_DATE THEN 1 ELSE 0 END) as expired_count
            FROM devices 
            WHERE area IS NOT NULL 
            GROUP BY area 
            ORDER BY expired_count DESC
            "#
        )
        .fetch_all(&context.db)
        .await
        .unwrap_or_default();

        Ok(stats)
    }
}

#[derive(juniper::GraphQLObject)]
pub struct DeviceStats {
    pub total: i64,
    pub by_type: Vec<TypeCount>,
    pub expired: i64,
    pub warning: i64,
    pub normal: i64,
}

#[derive(juniper::GraphQLObject)]
pub struct TypeCount {
    pub device_type: String,
    pub count: i64,
}

#[derive(juniper::GraphQLObject)]
pub struct InspectionStats {
    pub total: i64,
    pub completed: i64,
    pub pending: i64,
    pub in_progress: i64,
    pub completion_rate: f64,
}

#[derive(juniper::GraphQLObject)]
pub struct HazardStats {
    pub total: i64,
    pub by_severity: Vec<SeverityCount>,
    pub by_status: Vec<StatusCount>,
    pub pending: i64,
    pub rectifying: i64,
    pub closed: i64,
}

#[derive(juniper::GraphQLObject)]
pub struct SeverityCount {
    pub severity: String,
    pub count: i64,
}

#[derive(juniper::GraphQLObject)]
pub struct StatusCount {
    pub status: String,
    pub count: i64,
}

#[derive(juniper::GraphQLObject)]
pub struct DeviceList {
    pub items: Vec<Device>,
    pub total: i64,
    pub page: i32,
    pub page_size: i32,
}

#[derive(juniper::GraphQLObject, Debug, Clone)]
pub struct Device {
    pub id: Uuid,
    pub registration_code: String,
    pub device_type: String,
    pub device_name: String,
    pub model: Option<String>,
    pub manufacturer: Option<String>,
    pub unit_id: Uuid,
    pub area: Option<String>,
    pub status: String,
    pub safety_level: Option<String>,
    pub last_inspection_date: Option<NaiveDate>,
    pub next_inspection_date: Option<NaiveDate>,
    pub created_at: DateTime<Utc>,
}

impl<'r> sqlx::FromRow<'r, sqlx::postgres::PgRow> for Device {
    fn from_row(row: &'r sqlx::postgres::PgRow) -> Result<Self, sqlx::Error> {
        use sqlx::Row;
        Ok(Device {
            id: row.try_get("id")?,
            registration_code: row.try_get("registration_code")?,
            device_type: row.try_get("device_type")?,
            device_name: row.try_get("device_name")?,
            model: row.try_get("model")?,
            manufacturer: row.try_get("manufacturer")?,
            unit_id: row.try_get("unit_id")?,
            area: row.try_get("area")?,
            status: row.try_get("status")?,
            safety_level: row.try_get("safety_level")?,
            last_inspection_date: row.try_get("last_inspection_date")?,
            next_inspection_date: row.try_get("next_inspection_date")?,
            created_at: row.try_get("created_at")?,
        })
    }
}

#[derive(juniper::GraphQLObject)]
pub struct AreaStats {
    pub area: String,
    pub device_count: i64,
    pub expired_count: i64,
}

impl<'r> sqlx::FromRow<'r, sqlx::postgres::PgRow> for AreaStats {
    fn from_row(row: &'r sqlx::postgres::PgRow) -> Result<Self, sqlx::Error> {
        use sqlx::Row;
        Ok(AreaStats {
            area: row.try_get("area")?,
            device_count: row.try_get("device_count")?,
            expired_count: row.try_get("expired_count")?,
        })
    }
}
