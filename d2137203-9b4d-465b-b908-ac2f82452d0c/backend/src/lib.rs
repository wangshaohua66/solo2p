pub mod handlers;
pub mod models;
pub mod middleware;
pub mod services;
pub mod schema;

use sqlx::PgPool;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub jwt_secret: String,
}

pub type SharedState = Arc<AppState>;
