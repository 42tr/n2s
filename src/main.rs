use axum::routing::{Router, delete, get, post};
use tower_http::{
    cors::{Any, CorsLayer}, services::ServeDir
};
mod error;
mod workflow;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 初始化 log4rs
    init_log().await;

    let cors = CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any).allow_credentials(false);

    let api_router = Router::new()
        .route("/health", get(|| async { "OK" }))
        .route("/workflows", get(workflow::list))
        .route("/workflow", post(workflow::create_or_update))
        .route("/workflow/run", post(workflow::execute_workflow))
        .route("/workflow/{id}", get(workflow::get))
        .route("/workflow/{id}", delete(workflow::delete))
        .route("/workflow/{id}/run", get(workflow::execute))
        .route("/workflow/{id}/history", get(workflow::get_executions));

    let app = Router::new().nest("/api", api_router).fallback_service(ServeDir::new("../frontend/dist").append_index_html_on_directories(true)).layer(cors);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    axum::serve(listener, app).await?;
    Ok(())
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
