use std::{
    collections::HashMap, convert::Infallible, sync::{Arc, OnceLock}
};

use axum::{
    Json, extract::Path, http::header, response::{IntoResponse, Sse, sse::Event}
};
use chrono::Utc;
use log::info;
use tokio::sync::{RwLock, mpsc::UnboundedSender};
use tokio_stream::wrappers::UnboundedReceiverStream;
use uuid::Uuid;

use crate::error::AppError;

static WORKFLOWS: OnceLock<Arc<RwLock<Vec<Workflow>>>> = OnceLock::new();
static WORKFLOW_FILE: &'static str = "workflows.json";
static EXECUTIONS: OnceLock<Arc<RwLock<Vec<Execution>>>> = OnceLock::new();
static EXECUTION_FILE: &'static str = "executions.json";

mod model;
mod node;
mod sse;
use model::{Execution, Log, LogData, Node, Workflow};

/// 执行记录增查

fn load_execution_config() -> Vec<Execution> {
    if !std::path::Path::new(EXECUTION_FILE).exists() {
        return Vec::new();
    }
    let json_string = std::fs::read_to_string(EXECUTION_FILE).unwrap();
    serde_json::from_str(&json_string).unwrap()
}

fn save_execution_config(executions: &Vec<Execution>) {
    let json_string = serde_json::to_string_pretty(executions).unwrap();
    std::fs::write(EXECUTION_FILE, json_string).unwrap();
}

async fn create_execution(execution: Execution) {
    let mut data = EXECUTIONS.get_or_init(|| Arc::new(RwLock::new(load_execution_config()))).write().await;
    data.push(execution);
    save_execution_config(&data);
}

pub async fn get_executions(Path(id): Path<String>) -> Result<Json<Vec<Execution>>, AppError> {
    let data = EXECUTIONS.get_or_init(|| Arc::new(RwLock::new(load_execution_config()))).read().await;
    let executions: Vec<Execution> = data.iter().filter(|exe| exe.workflow_id == id).map(|exe| exe.clone()).rev().collect();
    Ok(Json(executions))
}

/// 工作流增删改查

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

pub async fn create_or_update(Json(mut workflow): Json<Workflow>) -> Result<Json<Workflow>, AppError> {
    if workflow.id.is_some() {
        let updated_at = Utc::now();
        workflow.updated_at = Some(updated_at);
        let mut data = WORKFLOWS.get_or_init(|| Arc::new(RwLock::new(load_config()))).write().await;
        if let Some(index) = data.iter().position(|w| w.id == workflow.id) {
            data[index] = workflow.clone();
            save_config(&data);
            return Ok(Json(workflow));
        } else {
            return Err(AppError::NotFound(format!(
                "Workflow 不存在: id={}",
                workflow.id.unwrap()
            )));
        }
    }
    workflow.id = Some(uuid::Uuid::new_v4().to_string());
    let created_at = Utc::now();
    let updated_at = created_at;
    workflow.created_at = Some(created_at);
    workflow.updated_at = Some(updated_at);
    let mut data = WORKFLOWS.get_or_init(|| Arc::new(RwLock::new(load_config()))).write().await;
    if let Some(_) = data.iter().position(|w| w.id == workflow.id) {
        Err(AppError::Conflict(format!(
            "Workflow 已存在: id={}",
            workflow.id.unwrap()
        )))
    } else {
        data.push(workflow.clone());
        save_config(&data);
        Ok(Json(workflow))
    }
}

pub async fn delete(Path(id): Path<String>) -> Result<(), AppError> {
    let mut data = WORKFLOWS.get_or_init(|| Arc::new(RwLock::new(load_config()))).write().await;
    if let Some(index) = data.iter().position(|w| w.id == Some(id.clone())) {
        data.remove(index);
        save_config(&data);
        Ok(())
    } else {
        Err(AppError::NotFound(format!("Workflow 不存在: id={}", id)))
    }
}

pub async fn list() -> Result<Json<Vec<Workflow>>, AppError> {
    let data = WORKFLOWS.get_or_init(|| Arc::new(RwLock::new(load_config()))).read().await;
    let mut response = data.clone();
    response.reverse();
    Ok(Json(response))
}

pub async fn get(Path(id): Path<String>) -> Result<Json<Workflow>, AppError> {
    let data = WORKFLOWS.get_or_init(|| Arc::new(RwLock::new(load_config()))).read().await;
    if let Some(workflow) = data.iter().find(|w| w.id == Some(id.clone())) { Ok(Json(workflow.clone())) } else { Err(AppError::NotFound(format!("Workflow 不存在: id={}", id))) }
}

/// 执行

pub async fn execute_workflow(Json(workflow): Json<Workflow>) -> impl IntoResponse {
    let (sender, receiver) = tokio::sync::mpsc::unbounded_channel();
    tokio::spawn(async move {
        let edges = workflow.edges.clone();
        let nodes = workflow.nodes.clone();
        let filter_nodes: Vec<String> = edges.iter().map(|edge| edge.target.clone()).collect();
        let mut start_nodes: Vec<String> = nodes.iter().filter(|node| !filter_nodes.contains(&node.id)).map(|node| node.id.clone()).collect();
        loop {
            for node_id in &start_nodes {
                let node = nodes.iter().find(|node| node.id == *node_id).unwrap();
                excute_node(node, &sender).await.unwrap();
            }
            start_nodes = edges.iter().filter(|edge| start_nodes.contains(&edge.source)).map(|edge| edge.target.clone()).collect();
            if start_nodes.is_empty() {
                break;
            }
        }
        sse::send_string("[DONE]".to_string(), &sender).unwrap();
    });

    let stream = UnboundedReceiverStream::new(receiver);
    (
        [(header::CONTENT_TYPE, "text/event-stream; charset=utf-8"), (header::CACHE_CONTROL, "no-cache"), (header::CONNECTION, "keep-alive")],
        Sse::new(stream),
    )
}

pub async fn execute(Path(id): Path<String>) -> impl IntoResponse {
    let start_time = Utc::now();
    let (sender, receiver) = tokio::sync::mpsc::unbounded_channel();
    tokio::spawn(async move {
        let data = WORKFLOWS.get_or_init(|| Arc::new(RwLock::new(load_config()))).write().await;
        let index = match data.iter().position(|w| w.id == Some(id.clone())) {
            Some(idx) => idx,
            None => {
                sse::send_error(format!("工作流不存在：id={}", id), &sender).unwrap();
                return;
            }
        };
        let workflow = &data[index];
        let edges = workflow.edges.clone();
        let nodes = workflow.nodes.clone();
        let filter_nodes: Vec<String> = edges.iter().map(|edge| edge.target.clone()).collect();
        let mut start_nodes: Vec<String> = nodes.iter().filter(|node| !filter_nodes.contains(&node.id)).map(|node| node.id.clone()).collect();

        let mut logs = vec![];
        loop {
            for node_id in &start_nodes {
                let node = nodes.iter().find(|node| node.id == *node_id).unwrap();
                logs.extend(excute_node(node, &sender).await.unwrap());
            }
            start_nodes = edges.iter().filter(|edge| start_nodes.contains(&edge.source)).map(|edge| edge.target.clone()).collect();
            if start_nodes.is_empty() {
                break;
            }
        }
        let end_time = Utc::now();
        let execution = Execution {
            id: Uuid::new_v4().to_string(),
            status: "completed".to_string(),
            workflow_id: id.to_string(),
            input: HashMap::new(),
            timestamp: start_time,
            duration: (end_time - start_time).num_milliseconds(),
            logs,
        };
        create_execution(execution).await;
        sse::send_string("[DONE]".to_string(), &sender).unwrap();
    });

    let stream = UnboundedReceiverStream::new(receiver);
    (
        [(header::CONTENT_TYPE, "text/event-stream; charset=utf-8"), (header::CACHE_CONTROL, "no-cache"), (header::CONNECTION, "keep-alive")],
        Sse::new(stream),
    )
}

async fn excute_node(node: &Node, sender: &UnboundedSender<Result<Event, Infallible>>) -> anyhow::Result<Vec<Log>> {
    info!("Executing node: {:?}", node);
    let mut logs = vec![];
    let log_data = LogData { kind: "node_start".to_string(), node_id: node.id.clone(), node_type: Some(node.kind.clone()), result: None, data: None };
    logs.push(Log { timestamp: Utc::now(), data: log_data.clone() });
    sse::send_json(log_data, sender)?;
    logs.extend(match node.kind.as_str() {
        "input" => node::input::execute(node, sender).await?,
        "ai-model" => node::llm::execute(node, sender).await?,
        "http-request" => node::http::execute(node, sender).await?,
        _ => vec![],
    });
    let log_data = LogData { kind: "node_complete".to_string(), data: None, node_id: node.id.clone(), node_type: Some("input".to_string()), result: None };
    logs.push(Log { timestamp: Utc::now(), data: log_data.clone() });
    sse::send_json(log_data, sender).unwrap();
    Ok(logs)
}
