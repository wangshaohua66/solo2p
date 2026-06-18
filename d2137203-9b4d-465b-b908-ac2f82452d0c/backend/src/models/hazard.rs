use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc, NaiveDate};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Hazard {
    pub id: Uuid,
    pub device_id: Uuid,
    pub inspection_id: Option<Uuid>,
    pub hazard_type: String,
    pub description: String,
    pub severity: String,
    pub status: String,
    pub inspector_id: Option<Uuid>,
    pub unit_contact_id: Option<Uuid>,
    pub deadline: Option<NaiveDate>,
    pub rectification_description: Option<String>,
    pub rectification_files: Option<serde_json::Value>,
    pub review_date: Option<NaiveDate>,
    pub review_result: Option<String>,
    pub reviewer_id: Option<Uuid>,
    pub supervision_level: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateHazard {
    pub device_id: Uuid,
    pub inspection_id: Option<Uuid>,
    pub hazard_type: String,
    pub description: String,
    pub severity: String,
    pub inspector_id: Option<Uuid>,
    pub unit_contact_id: Option<Uuid>,
    pub deadline: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateHazard {
    pub hazard_type: Option<String>,
    pub description: Option<String>,
    pub severity: Option<String>,
    pub status: Option<String>,
    pub deadline: Option<NaiveDate>,
    pub rectification_description: Option<String>,
    pub rectification_files: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct ReviewHazard {
    pub review_result: String,
    pub reviewer_id: Uuid,
    pub review_date: NaiveDate,
    pub review_comment: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct HazardQuery {
    pub page: Option<u32>,
    pub page_size: Option<u32>,
    pub device_id: Option<Uuid>,
    pub inspection_id: Option<Uuid>,
    pub status: Option<String>,
    pub severity: Option<String>,
    pub hazard_type: Option<String>,
    pub supervision_level: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct HazardListResponse {
    pub items: Vec<Hazard>,
    pub total: i64,
    pub page: u32,
    pub page_size: u32,
}
