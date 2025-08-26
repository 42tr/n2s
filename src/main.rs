use axum::{
    http::{StatusCode, Uri}, response::{IntoResponse, Response}, routing::{Router, delete, get, post}, middleware,
    extract::DefaultBodyLimit
};
use tower_http::cors::{Any, CorsLayer};
mod error;
mod workflow;
mod auth;
use mime_guess::from_path;
use rust_embed::RustEmbed;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 初始化 log4rs
    init_log().await;

    let cors = CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any).allow_credentials(false);

    let protected_routes = Router::new()
        .route("/workflows", get(workflow::list))
        .route("/workflow", post(workflow::create_or_update))
        .route("/workflow/run", post(workflow::execute_workflow))
        .route("/workflow/{id}", get(workflow::get))
        .route("/workflow/{id}", delete(workflow::delete))
        .route("/workflow/{id}/run", get(workflow::execute))
        .route("/workflow/{id}/history", get(workflow::get_executions))
        .route_layer(middleware::from_fn(auth::auth_middleware));

    let api_router = Router::new()
        .route("/health", get(|| async { "OK" }))
        .route("/login", post(auth::handlers::login))
        .route("/register", post(auth::handlers::register))
        .merge(protected_routes);

    let app = Router::new()
        .nest("/api", api_router)
        .fallback(get(frontend_router))
        .layer(DefaultBodyLimit::max(50 * 1024 * 1024)) // 50MB limit
        .layer(cors);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3333").await?;
    axum::serve(listener, app).await?;
    Ok(())
}

#[derive(RustEmbed)]
#[folder = "frontend/dist/"] // 静态文件目录
struct WebAssets;

// 路由匹配
async fn frontend_router(uri: Uri) -> Response {
    let path = uri.path();

    if path.starts_with("/") { serve_asset::<WebAssets>(path, "/").unwrap_or(not_found()) } else { not_found() }
}

fn not_found() -> Response {
    Response::builder().status(StatusCode::NOT_FOUND).body("404 Not Found".into()).unwrap()
}

// 通用静态文件处理函数
fn serve_asset<Asset: RustEmbed>(uri_path: &str, base_path: &str) -> Option<Response> {
    let sub_path = uri_path.trim_start_matches(base_path).trim_start_matches('/');
    let file = if sub_path.is_empty() { "index.html" } else { sub_path };

    Asset::get(file).map(|content| {
        let body = content.data.into_owned();
        let mime = from_path(file).first_or_octet_stream();
        ([("Content-Type", mime.to_string())], body).into_response()
    })
}

async fn init_log() {
    // // 创建一个 FileAppender
    // let logfile = FileAppender::builder()
    //     .encoder(Box::new(PatternEncoder::new("{d} - {m}{n}")))
    //     .build("logs/output.log")
    //     .unwrap();

    // // 构建日志配置
    // let config = Config::builder()
    //     .appender(Appender::builder().build("logfile", Box::new(logfile)))
    //     .build(Root::builder().appender("logfile").build(log::LevelFilter::Debug))
    //     .unwrap();

    // // 初始化 log4rs
    // log4rs::init_config(config).unwrap();

    // 创建一个控制台 Appender
    let stdout = log4rs::append::console::ConsoleAppender::builder()
        .encoder(Box::new(log4rs::encode::pattern::PatternEncoder::new(
            "{d(%Y-%m-%d %H:%M:%S)} [{t}] {h({l})} - {m}{n}",
        )))
        .build();

    // 构建 log4rs 配置
    let config = log4rs::config::Config::builder()
        .appender(log4rs::config::Appender::builder().build("stdout", Box::new(stdout)))
        .build(
            log4rs::config::Root::builder().appender("stdout").build(log::LevelFilter::Debug), // 设置日志级别
        )
        .expect("构建 log4rs 配置失败");

    // 初始化日志器
    log4rs::init_config(config).expect("初始化 log4rs 失败");
}
