use axum::routing::{Router, delete, get, post, put};
use tower_http::{
    cors::{Any, CorsLayer}, services::ServeDir
};

mod error;
mod workflow;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any)
        .allow_credentials(false);

    let api_router = Router::new()
        .route("/health", get(|| async { "OK" }))
        .route("/workflows", get(workflow::list))
        .route("/workflow", post(workflow::create_or_update))
        .route("/workflow/run", post(workflow::execute_workflow))
        .route("/workflow/{id}", get(workflow::get))
        .route("/workflow/{id}", delete(workflow::delete))
        .route("/workflow/{id}/run", get(workflow::execute))
        .route("/workflow/{id}/history", get(workflow::get_executions));

    let app = Router::new()
        .nest("/api", api_router)
        .fallback_service(ServeDir::new("../frontend/dist").append_index_html_on_directories(true))
        .layer(cors);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    axum::serve(listener, app).await?;
    Ok(())
}
