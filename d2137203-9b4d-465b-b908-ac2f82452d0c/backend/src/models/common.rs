use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub code: i32,
    pub message: String,
    pub data: Option<T>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        ApiResponse {
            code: 0,
            message: "success".to_string(),
            data: Some(data),
        }
    }

    pub fn error(message: &str) -> Self {
        ApiResponse {
            code: -1,
            message: message.to_string(),
            data: None,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct PaginatedQuery {
    pub page: Option<u32>,
    pub page_size: Option<u32>,
}
