use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc, NaiveDate};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Inspection {
    pub id: Uuid,
    pub device_id: Uuid,
    pub inspection_type: String,
    pub inspector_id: Option<Uuid>,
    pub plan_date: Option<NaiveDate>,
    pub actual_date: Option<NaiveDate>,
    pub status: String,
    pub conclusion: Option<String>,
    pub safety_level: Option<String>,
    pub report_number: Option<String>,
    pub report_url: Option<String>,
    pub findings: Option<String>,
    pub next_inspection_date: Option<NaiveDate>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateInspection {
    pub device_id: Uuid,
    pub inspection_type: String,
    pub inspector_id: Option<Uuid>,
    pub plan_date: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateInspection {
    pub inspector_id: Option<Uuid>,
    pub plan_date: Option<NaiveDate>,
    pub actual_date: Option<NaiveDate>,
    pub status: Option<String>,
    pub conclusion: Option<String>,
    pub safety_level: Option<String>,
    pub report_number: Option<String>,
    pub report_url: Option<String>,
    pub findings: Option<String>,
    pub next_inspection_date: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct InspectionQuery {
    pub page: Option<u32>,
    pub page_size: Option<u32>,
    pub device_id: Option<Uuid>,
    pub inspector_id: Option<Uuid>,
    pub status: Option<String>,
    pub inspection_type: Option<String>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
}

#[derive(Debug, Serialize)]
pub struct InspectionListResponse {
    pub items: Vec<Inspection>,
    pub total: i64,
    pub page: u32,
    pub page_size: u32,
}

#[derive(Debug, Deserialize)]
pub struct NextDateCalculation {
    pub device_type: String,
    pub last_inspection_date: NaiveDate,
    pub conclusion: Option<String>,
    pub custom_cycle_months: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct NextDateResponse {
    pub next_inspection_date: NaiveDate,
    pub cycle_months: i32,
    pub warning_dates: Vec<WarningDate>,
}

#[derive(Debug, Serialize)]
pub struct WarningDate {
    pub warning_type: String,
    pub warning_date: NaiveDate,
    pub days_remaining: i32,
}
