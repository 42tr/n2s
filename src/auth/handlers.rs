use axum::{http::StatusCode, Json};
use super::{AuthResponse, LoginRequest, RegisterRequest, authenticate_user, create_jwt, register_user, REGISTRATION_CODE};

pub async fn login(Json(payload): Json<LoginRequest>) -> Result<Json<AuthResponse>, StatusCode> {
    match authenticate_user(&payload.username, &payload.password) {
        Ok(_) => {
            match create_jwt(&payload.username) {
                Ok(token) => Ok(Json(AuthResponse {
                    token,
                    message: "登录成功".to_string(),
                })),
                Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
            }
        }
        Err(_) => Err(StatusCode::UNAUTHORIZED),
    }
}

pub async fn register(Json(payload): Json<RegisterRequest>) -> Result<Json<AuthResponse>, StatusCode> {
    if payload.password.len() < 6 {
        return Err(StatusCode::BAD_REQUEST);
    }

    // 验证注册码
    if payload.registration_code != REGISTRATION_CODE {
        return Err(StatusCode::FORBIDDEN);
    }

    match register_user(payload.username.clone(), payload.password) {
        Ok(_) => {
            match create_jwt(&payload.username) {
                Ok(token) => Ok(Json(AuthResponse {
                    token,
                    message: "注册成功".to_string(),
                })),
                Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
            }
        }
        Err(_) => Err(StatusCode::CONFLICT),
    }
}