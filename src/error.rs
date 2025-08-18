use std::fmt;
use anyhow::Error;
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
};

#[derive(Debug)]
pub enum AppError {
    /// 已存在
    Conflict(String),

    /// 资源未找到
    NotFound(String),

    /// 请求参数错误
    BadRequest(String),

    /// 未授权
    Unauthorized(String),

    /// 内部错误（保留 anyhow::Error 用于日志）
    Internal(Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            AppError::Conflict(msg) => (StatusCode::CONFLICT, format!("Conflict: {msg}")),
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, format!("Not Found: {msg}")),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, format!("Bad Request: {msg}")),
            AppError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, format!("Unauthorized: {msg}")),
            AppError::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Internal Server Error: {msg}")),
        };

        eprintln!("AppError: {:#}", self);

        (status, message).into_response()
    }
}

// 为 AppError 实现 fmt::Display（required for anyhow::Error）
impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::Conflict(msg) => write!(f, "Conflict: {}", msg),
            AppError::NotFound(msg) => write!(f, "Not Found: {}", msg),
            AppError::BadRequest(msg) => write!(f, "Bad Request: {}", msg),
            AppError::Unauthorized(msg) => write!(f, "Unauthorized: {}", msg),
            AppError::Internal(err) => write!(f, "Internal Error: {}", err),
        }
    }
}

// 为 std::io::Error 等实现 From
impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        // 你可以根据 io::Error 的 kind 做更精细判断
        match err.kind() {
            std::io::ErrorKind::NotFound => AppError::NotFound(err.to_string()),
            std::io::ErrorKind::PermissionDenied => AppError::Unauthorized(err.to_string()),
            _ => AppError::Internal(err.into()),
        }
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::BadRequest(format!("JSON 解析错误: {}", err))
    }
}

// 兜底：任何 Into<anyhow::Error> 都转为 Internal
// impl<E> From<E> for AppError
// where
//     E: Into<Error> + Send + Sync + 'static,
// {
//     fn from(err: E) -> Self {
//         AppError::Internal(err.into())
//     }
// }
