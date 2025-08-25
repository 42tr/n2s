use std::{collections::HashMap, sync::Mutex, fs, path::Path};

use axum::{
    extract::Request, http::{StatusCode, header}, middleware::Next, response::Response
};
use bcrypt::{DEFAULT_COST, hash, verify};
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation, decode, encode};
use log::info;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};

pub mod handlers;

const JWT_SECRET: &[u8] = b"your-secret-key";
const USERS_FILE: &str = "users.json";
const REGISTRATION_CODE: &str = "N2S2024";
static USERS: Lazy<Mutex<HashMap<String, User>>> = Lazy::new(|| {
    let users = load_users_from_file().unwrap_or_default();
    Mutex::new(users)
});

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub username: String,
    pub password_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub username: String,
    pub exp: usize,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub password: String,
    pub registration_code: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub message: String,
}

pub fn hash_password(password: &str) -> Result<String, bcrypt::BcryptError> {
    hash(password, DEFAULT_COST)
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool, bcrypt::BcryptError> {
    verify(password, hash)
}

pub fn create_jwt(username: &str) -> Result<String, jsonwebtoken::errors::Error> {
    let expiration = chrono::Utc::now().checked_add_signed(chrono::Duration::hours(24)).expect("valid timestamp").timestamp() as usize;

    let claims = Claims { username: username.to_string(), exp: expiration };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(JWT_SECRET),
    )
}

pub fn verify_jwt(token: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(JWT_SECRET),
        &Validation::default(),
    )
    .map(|data| data.claims)
}

pub async fn auth_middleware(mut request: Request, next: Next) -> Result<Response, StatusCode> {
    // 首先检查 Authorization header
    let auth_header = request.headers().get(header::AUTHORIZATION).and_then(|header| header.to_str().ok());
    
    if let Some(auth_header) = auth_header {
        if let Some(token) = auth_header.strip_prefix("Bearer ") {
            match verify_jwt(token) {
                Ok(claims) => {
                    request.extensions_mut().insert(claims);
                    return Ok(next.run(request).await);
                }
                Err(_) => {} // 继续检查URL参数
            }
        }
    }
    
    // 检查URL中的token参数
    let uri = request.uri();
    if let Some(query) = uri.query() {
        for param in query.split('&') {
            if let Some(token_value) = param.strip_prefix("token=") {
                // URL解码token
                let token = urlencoding::decode(token_value).unwrap_or_default();
                match verify_jwt(&token) {
                    Ok(claims) => {
                        request.extensions_mut().insert(claims);
                        return Ok(next.run(request).await);
                    }
                    Err(_) => {} // token无效，继续检查其他认证方式
                }
            }
        }
    }

    Err(StatusCode::UNAUTHORIZED)
}

pub fn register_user(username: String, password: String) -> Result<(), String> {
    let mut users = USERS.lock().unwrap();
    info!("exists user: {:?}", users);

    if users.contains_key(&username) {
        return Err("用户已存在".to_string());
    }

    let password_hash = hash_password(&password).map_err(|_| "密码加密失败")?;

    users.insert(username.clone(), User { username, password_hash });
    
    save_users_to_file(&users).map_err(|_| "保存用户数据失败")?;

    Ok(())
}

pub fn authenticate_user(username: &str, password: &str) -> Result<(), String> {
    let users = USERS.lock().unwrap();
    info!("users: {:?}", users);

    if let Some(user) = users.get(username) {
        if verify_password(password, &user.password_hash).map_err(|_| "密码验证失败")? { Ok(()) } else { Err("密码错误".to_string()) }
    } else {
        Err("用户不存在".to_string())
    }
}

fn load_users_from_file() -> Result<HashMap<String, User>, Box<dyn std::error::Error>> {
    if !Path::new(USERS_FILE).exists() {
        return Ok(HashMap::new());
    }
    
    let content = fs::read_to_string(USERS_FILE)?;
    let users: HashMap<String, User> = serde_json::from_str(&content)?;
    Ok(users)
}

fn save_users_to_file(users: &HashMap<String, User>) -> Result<(), Box<dyn std::error::Error>> {
    let content = serde_json::to_string_pretty(users)?;
    fs::write(USERS_FILE, content)?;
    Ok(())
}
