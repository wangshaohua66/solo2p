mod handlers;
mod models;
mod middleware;
mod services;
mod schema;

use axum::{
    routing::{get, post, put, delete},
    Router,
    http::Method,
};
use tower_http::cors::{CorsLayer, Any};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use sqlx::PgPool;
use std::sync::Arc;
use dotenv::dotenv;
use std::env;

use special_equipment_inspection::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenv().ok();
    
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "special_equipment_inspection=debug,tower_http=debug,axum=trace".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let jwt_secret = env::var("JWT_SECRET").expect("JWT_SECRET must be set");
    let port: u16 = env::var("PORT").unwrap_or_else(|_| "8080".to_string()).parse().expect("PORT must be a number");
    let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());

    let db_pool = PgPool::connect(&database_url)
        .await
        .expect("Failed to create pool");

    sqlx::migrate!("./migrations")
        .run(&db_pool)
        .await
        .expect("Failed to run migrations");

    let app_state = Arc::new(AppState {
        db: db_pool.clone(),
        jwt_secret,
    });

    let app = Router::new()
        .route("/api/auth/login", post(handlers::auth::login))
        .route("/api/auth/register", post(handlers::auth::register))
        .route("/api/auth/me", get(handlers::auth::me))
        
        .route("/api/devices", get(handlers::device::list_devices))
        .route("/api/devices/:id", get(handlers::device::get_device))
        .route("/api/devices", post(handlers::device::create_device))
        .route("/api/devices/:id", put(handlers::device::update_device))
        .route("/api/devices/:id", delete(handlers::device::delete_device))
        .route("/api/devices/import", post(handlers::device::import_devices))
        .route("/api/devices/export", get(handlers::device::export_devices))
        .route("/api/devices/:id/timeline", get(handlers::device::get_device_timeline))
        
        .route("/api/inspections", get(handlers::inspection::list_inspections))
        .route("/api/inspections/:id", get(handlers::inspection::get_inspection))
        .route("/api/inspections", post(handlers::inspection::create_inspection))
        .route("/api/inspections/:id", put(handlers::inspection::update_inspection))
        .route("/api/inspections/:id/report", get(handlers::inspection::generate_report))
        .route("/api/inspections/next-date", post(handlers::inspection::calculate_next_date))
        
        .route("/api/hazards", get(handlers::hazard::list_hazards))
        .route("/api/hazards/:id", get(handlers::hazard::get_hazard))
        .route("/api/hazards", post(handlers::hazard::create_hazard))
        .route("/api/hazards/:id", put(handlers::hazard::update_hazard))
        .route("/api/hazards/:id/review", post(handlers::hazard::review_hazard))
        
        .route("/api/graphql", post(handlers::graphql::graphql_handler))
        .route("/api/graphql/playground", get(handlers::graphql::playground_handler))
        
        .route("/api/users", get(handlers::user::list_users))
        .route("/api/users/:id", get(handlers::user::get_user))
        .route("/api/users", post(handlers::user::create_user))
        .route("/api/users/:id", put(handlers::user::update_user))
        .route("/api/users/:id", delete(handlers::user::delete_user))
        
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS])
                .allow_headers(Any),
        )
        .with_state(app_state);

    let listener = tokio::net::TcpListener::bind(format!("{}:{}", host, port)).await?;
    tracing::info!("Server running on http://{}:{}", host, port);
    
    axum::serve(listener, app).await?;

    Ok(())
}
