use std::{
    convert::Infallible, sync::{Arc, OnceLock}
};

use axum::{
    Json, extract::Path, response::{Sse, sse::Event}
};
use futures::stream::Stream;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use tokio_stream::wrappers::UnboundedReceiverStream;

use crate::error::AppError;

static WORKFLOWS: OnceLock<Arc<RwLock<Vec<Workflow>>>> = OnceLock::new();
static WORKFLOW_FILE: &'static str = "workflows.json";

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Position {
    x: f32,
    y: f32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Node {
    id: String,
    #[serde(rename = "type")]
    kind: String,
    position: Position,
    config: std::collections::HashMap<String, String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Edge {
    source: String,
    target: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Workflow {
    id: String,
    nodes: Vec<Node>,
    edges: Vec<Edge>,
    created_at: Option<chrono::DateTime<chrono::Utc>>,
    updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// 增删改查

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
    let mut data = WORKFLOWS
        .get_or_init(|| Arc::new(RwLock::new(load_config())))
        .write()
        .await;
    if let Some(_) = data.iter().position(|w| w.id == workflow.id) {
        Err(AppError::Conflict(format!(
            "Workflow 已存在: id={}",
            workflow.id
        )))
    } else {
        data.push(workflow.clone());
        save_config(&data);
        Ok(Json(workflow))
    }
}

pub async fn update(Json(mut workflow): Json<Workflow>) -> Result<Json<Workflow>, AppError> {
    let updated_at = chrono::Utc::now();
    workflow.updated_at = Some(updated_at);
    let mut data = WORKFLOWS
        .get_or_init(|| Arc::new(RwLock::new(load_config())))
        .write()
        .await;
    if let Some(index) = data.iter().position(|w| w.id == workflow.id) {
        data[index] = workflow.clone();
        save_config(&data);
        Ok(Json(workflow))
    } else {
        Err(AppError::NotFound(format!(
            "Workflow 不存在: id={}",
            workflow.id
        )))
    }
}

pub async fn delete(Path(id): Path<String>) -> Result<(), AppError> {
    let mut data = WORKFLOWS
        .get_or_init(|| Arc::new(RwLock::new(load_config())))
        .write()
        .await;
    if let Some(index) = data.iter().position(|w| w.id == id) {
        data.remove(index);
        save_config(&data);
        Ok(())
    } else {
        Err(AppError::NotFound(format!("Workflow 不存在: id={}", id)))
    }
}

pub async fn list() -> Result<Json<Vec<Workflow>>, AppError> {
    let data = WORKFLOWS
        .get_or_init(|| Arc::new(RwLock::new(load_config())))
        .read()
        .await;
    Ok(Json(data.clone()))
}

pub async fn get(Path(id): Path<String>) -> Result<Json<Workflow>, AppError> {
    let data = WORKFLOWS
        .get_or_init(|| Arc::new(RwLock::new(load_config())))
        .read()
        .await;
    if let Some(workflow) = data.iter().find(|w| w.id == id) {
        Ok(Json(workflow.clone()))
    } else {
        Err(AppError::NotFound(format!("Workflow 不存在: id={}", id)))
    }
}

/// 执行

pub async fn execute(Path(id): Path<String>) -> Sse<impl Stream<Item=Result<Event, Infallible>>> {
    let (sender, receiver) = tokio::sync::mpsc::unbounded_channel();
    tokio::spawn(async move {
        let data = WORKFLOWS
            .get_or_init(|| Arc::new(RwLock::new(load_config())))
            .write()
            .await;
        let index = match data.iter().position(|w| w.id == id) {
            Some(idx) => idx,
            None => {
                let event = Event::default()
                    .data(format!("工作流不存在：id={}", id))
                    .event("error")
                    .id("0");

                if sender.send(Ok(event)).is_err() {
                    log::info!("发送错误事件失败");
                }
                return;
            }
        };
        let workflow = &data[index];
        let edges = workflow.edges.clone();
        let nodes = workflow.nodes.clone();
        let filter_nodes: Vec<String> = edges.iter().map(|edge| edge.target.clone()).collect();
        let mut start_nodes: Vec<String> = nodes
            .iter()
            .filter(|node| !filter_nodes.contains(&node.id))
            .map(|node| node.id.clone())
            .collect();
        loop {
            for node_id in &start_nodes {
                let node = nodes.iter().find(|node| node.id == *node_id).unwrap();
                let event = Event::default()
                    .data(format!("开始执行节点：{}", node.id))
                    .event("node_progress")
                    .id(node_id);

                if sender.send(Ok(event)).is_err() {
                    log::info!("发送开始事件失败");
                }
            }
            start_nodes = edges
                .iter()
                .filter(|edge| start_nodes.contains(&edge.source))
                .map(|edge| edge.target.clone())
                .collect();
            if start_nodes.is_empty() {
                break;
            }
        }
    });

    let stream = UnboundedReceiverStream::new(receiver);
    Sse::new(stream)
}
