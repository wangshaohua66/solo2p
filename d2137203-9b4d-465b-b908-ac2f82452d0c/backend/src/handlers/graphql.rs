use axum::{
    extract::State,
    response::{Html, IntoResponse},
    Json,
    Extension,
};
use std::sync::Arc;
use juniper::http::GraphQLRequest;
use juniper::RootNode;

use crate::AppState;
use crate::schema::query::Query;
use crate::schema::mutation::Mutation;

pub type Schema = RootNode<'static, Query, Mutation>;

pub fn create_schema() -> Schema {
    Schema::new(Query, Mutation)
}

pub async fn graphql_handler(
    State(state): State<Arc<AppState>>,
    Json(request): Json<GraphQLRequest>,
) -> Json<serde_json::Value> {
    let schema = create_schema();
    
    let response = request.execute(&schema, &state).await;
    
    Json(serde_json::json!({
        "data": response.data,
        "errors": response.errors
    }))
}

pub async fn playground_handler() -> impl IntoResponse {
    let html = r#"
<!DOCTYPE html>
<html>
<head>
    <title>GraphQL Playground</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/graphql-playground-react/build/static/css/index.css" />
    <script src="https://cdn.jsdelivr.net/npm/graphql-playground-react/build/static/js/middleware.js"></script>
</head>
<body>
    <div id="root"></div>
    <script>
        window.addEventListener('load', function () {
            GraphQLPlayground.init(document.getElementById('root'), {
                endpoint: '/api/graphql'
            });
        });
    </script>
</body>
</html>
    "#;
    
    Html(html)
}
