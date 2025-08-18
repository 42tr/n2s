use tower_http::cors::{Any, CorsLayer};
use axum::routing::{get, put, post, delete};

mod workflow;
mod error;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any)
        .allow_credentials(false);
    let app = axum::Router::new()
        .route("/health", get(|| async { "OK" }))
        .route("/workflows", get(workflow::list))
        .route("/workflows", put(workflow::create))
        .route("/workflows", post(workflow::update))
        .route("/workflows/{id}", get(workflow::get))
        .route("/workflows/{id}", delete(workflow::delete))
        .route("/workflows/{id}/run", get(workflow::execute))
        .layer(cors);
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    axum::serve(listener, app).await?;
    Ok(())
}
