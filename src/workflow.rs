use serde::{Deserialize, Serialize};
use std::sync::{OnceLock};
use crate::error::AppError;
use tokio::sync::RwLock;
use std::sync::Arc;
use axum::Json;
use axum::extract::Path;

// 定义全局可变静态变量，用 OnceLock 延迟初始化
static WORKFLOWS: OnceLock<Arc<RwLock<Vec<Workflow>>>> = OnceLock::new();
static WORKFLOW_FILE: &'static str = "workflows.json";

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Node {
    id: u32,
    kind: String,
    position: (f32, f32),
    config: std::collections::HashMap<String, String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Edge {
    source_id: u32,
    target_id: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Workflow {
    id: u32,
    nodes: Vec<Node>,
    edges: Vec<Edge>,
    created_at: Option<chrono::DateTime<chrono::Utc>>,
    updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

// 模拟一个初始化函数
fn load_config() -> Vec<Workflow> {
    if !std::path::Path::new(WORKFLOW_FILE).exists() {
        return Vec::new();
    }
    let json_string = std::fs::read_to_string(WORKFLOW_FILE).unwrap();
    serde_json::from_str(&json_string).unwrap()
}

fn save_config(workflows: &Vec<Workflow>) {
    let json_string = serde_json::to_string_pretty(workflows).unwrap();
    std::fs::write(WORKFLOW_FILE, json_string).unwrap();
}

pub async fn create(Json(mut workflow): Json<Workflow>) -> Result<Json<Workflow>, AppError> {
    let created_at = chrono::Utc::now();
    let updated_at = created_at;
    workflow.created_at = Some(created_at);
    workflow.updated_at = Some(updated_at);
    let mut data = WORKFLOWS.get_or_init(|| Arc::new(RwLock::new(load_config()))).write().await;
    data.push(workflow.clone());
    save_config(&data);
    Ok(Json(workflow))
}

pub async fn update(Json(mut workflow): Json<Workflow>) -> Result<Json<Workflow>, AppError> {
    let updated_at = chrono::Utc::now();
    workflow.updated_at = Some(updated_at);
    let mut data = WORKFLOWS.get_or_init(|| Arc::new(RwLock::new(load_config()))).write().await;
    if let Some(index) = data.iter().position(|w| w.id == workflow.id) {
        data[index] = workflow.clone();
        save_config(&data);
        Ok(Json(workflow))
    } else {
        Err(AppError::NotFound(format!("Workflow 不存在: id={}", workflow.id)))
    }
}

pub async fn delete(Path(id): Path<u32>) -> Result<(), AppError> {
    let mut data = WORKFLOWS.get_or_init(|| Arc::new(RwLock::new(load_config()))).write().await;
    if let Some(index) = data.iter().position(|w| w.id == id) {
        data.remove(index);
        save_config(&data);
        Ok(())
    } else {
        Err(AppError::NotFound(format!("Workflow 不存在: id={}", id)))
    }
}

pub async fn list() -> Result<Json<Vec<Workflow>>, AppError> {
    let data = WORKFLOWS.get_or_init(|| Arc::new(RwLock::new(load_config()))).read().await;
    Ok(Json(data.clone()))
}

pub async fn get(Path(id): Path<u32>) -> Result<Json<Workflow>, AppError> {
    let data = WORKFLOWS.get_or_init(|| Arc::new(RwLock::new(load_config()))).read().await;
    if let Some(workflow) = data.iter().find(|w| w.id == id) {
        Ok(Json(workflow.clone()))
    } else {
        Err(AppError::NotFound(format!("Workflow 不存在: id={}", id)))
    }
}
