use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc, NaiveDate};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Device {
    pub id: Uuid,
    pub registration_code: String,
    pub device_type: String,
    pub device_name: String,
    pub model: Option<String>,
    pub manufacturer: Option<String>,
    pub manufacture_date: Option<NaiveDate>,
    pub installation_date: Option<NaiveDate>,
    pub acceptance_date: Option<NaiveDate>,
    pub unit_id: Uuid,
    pub location: Option<String>,
    pub area: Option<String>,
    pub safety_level: Option<String>,
    pub status: String,
    pub last_inspection_date: Option<NaiveDate>,
    pub next_inspection_date: Option<NaiveDate>,
    pub inspection_cycle_months: Option<i32>,
    pub custom_cycle_months: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDevice {
    pub registration_code: String,
    pub device_type: String,
    pub device_name: String,
    pub model: Option<String>,
    pub manufacturer: Option<String>,
    pub manufacture_date: Option<NaiveDate>,
    pub installation_date: Option<NaiveDate>,
    pub acceptance_date: Option<NaiveDate>,
    pub unit_id: Uuid,
    pub location: Option<String>,
    pub area: Option<String>,
    pub custom_cycle_months: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDevice {
    pub device_name: Option<String>,
    pub model: Option<String>,
    pub manufacturer: Option<String>,
    pub manufacture_date: Option<NaiveDate>,
    pub installation_date: Option<NaiveDate>,
    pub acceptance_date: Option<NaiveDate>,
    pub location: Option<String>,
    pub area: Option<String>,
    pub status: Option<String>,
    pub safety_level: Option<String>,
    pub custom_cycle_months: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct DeviceQuery {
    pub page: Option<u32>,
    pub page_size: Option<u32>,
    pub device_type: Option<String>,
    pub unit_id: Option<Uuid>,
    pub area: Option<String>,
    pub status: Option<String>,
    pub registration_code: Option<String>,
    pub keyword: Option<String>,
    pub inspection_status: Option<String>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DeviceListResponse {
    pub items: Vec<Device>,
    pub total: i64,
    pub page: u32,
    pub page_size: u32,
}

#[derive(Debug, Serialize)]
pub struct TimelineEvent {
    pub id: Uuid,
    pub event_type: String,
    pub event_date: NaiveDate,
    pub title: String,
    pub description: String,
    pub operator: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct ImportResult {
    pub total: usize,
    pub success: usize,
    pub failed: usize,
    pub errors: Vec<ImportError>,
}

#[derive(Debug, Serialize)]
pub struct ImportError {
    pub row: usize,
    pub field: String,
    pub message: String,
}
