use std::{
    collections::HashMap, convert::Infallible, sync::{Arc, OnceLock}
};

use async_openai::{Client, config::OpenAIConfig, types::CreateCompletionRequestArgs};
use axum::{
    Json, extract::Path, http::header, response::{IntoResponse, Sse, sse::Event}
};
use chrono::{DateTime, Utc};
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use tokio::sync::{RwLock, mpsc::UnboundedSender};
use tokio_stream::wrappers::UnboundedReceiverStream;
use uuid::Uuid;

use crate::error::AppError;

static WORKFLOWS: OnceLock<Arc<RwLock<Vec<Workflow>>>> = OnceLock::new();
static WORKFLOW_FILE: &'static str = "workflows.json";
static EXECUTIONS: OnceLock<Arc<RwLock<Vec<Execution>>>> = OnceLock::new();
static EXECUTION_FILE: &'static str = "executions.json";

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
    config: HashMap<String, String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Edge {
    source: String,
    target: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Workflow {
    id: String,
    name: String,
    nodes: Vec<Node>,
    edges: Vec<Edge>,
    #[serde(rename = "createdAt")]
    created_at: Option<DateTime<Utc>>,
    #[serde(rename = "updatedAt")]
    updated_at: Option<DateTime<Utc>>,
}

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
    let mut data = EXECUTIONS
        .get_or_init(|| Arc::new(RwLock::new(load_execution_config())))
        .write()
        .await;
    data.push(execution);
    save_execution_config(&data);
}

pub async fn get_executions(Path(id): Path<String>) -> Result<Json<Vec<Execution>>, AppError> {
    let data = EXECUTIONS
        .get_or_init(|| Arc::new(RwLock::new(load_execution_config())))
        .read()
        .await;
    let executions: Vec<Execution> = data
        .iter()
        .filter(|exe| exe.workflow_id == id)
        .map(|exe| exe.clone())
        .rev()
        .collect();
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

pub async fn create(Json(mut workflow): Json<Workflow>) -> Result<Json<Workflow>, AppError> {
    let created_at = Utc::now();
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
    let updated_at = Utc::now();
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

pub async fn execute_workflow(Json(workflow): Json<Workflow>) -> impl IntoResponse {
    let (sender, receiver) = tokio::sync::mpsc::unbounded_channel();
    tokio::spawn(async move {
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
                excute_node(node, &sender).await.unwrap();
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
        send_string("[DONE]".to_string(), &sender).unwrap();
    });

    let stream = UnboundedReceiverStream::new(receiver);
    (
        [
            (header::CONTENT_TYPE, "text/event-stream; charset=utf-8"),
            (header::CACHE_CONTROL, "no-cache"),
            (header::CONNECTION, "keep-alive"),
        ],
        Sse::new(stream),
    )
}

pub async fn execute(Path(id): Path<String>) -> impl IntoResponse {
    let start_time = Utc::now();
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

        let mut logs = vec![];
        loop {
            for node_id in &start_nodes {
                let node = nodes.iter().find(|node| node.id == *node_id).unwrap();
                logs.extend(excute_node(node, &sender).await.unwrap());
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
        send_string("[DONE]".to_string(), &sender).unwrap();
    });

    let stream = UnboundedReceiverStream::new(receiver);
    (
        [
            (header::CONTENT_TYPE, "text/event-stream; charset=utf-8"),
            (header::CACHE_CONTROL, "no-cache"),
            (header::CONNECTION, "keep-alive"),
        ],
        Sse::new(stream),
    )
}

async fn excute_node(node: &Node, sender: &UnboundedSender<Result<Event, Infallible>>) -> anyhow::Result<Vec<Log>> {
    let mut logs = vec![];
    logs.push(Log {
        timestamp: Utc::now(),
        data: LogData {
            kind: "node_start".to_string(),
            node_id: node.id.clone(),
            node_type: Some(node.kind.clone()),
            result: None,
            data: None,
        },
    });
    send_json(
        LogData {
            kind: "node_start".to_string(),
            node_id: node.id.clone(),
            node_type: Some(node.kind.clone()),
            result: None,
            data: None,
        },
        sender,
    )?;
    match node.kind.as_str() {
        "input" => {
            logs.push(Log {
                timestamp: Utc::now(),
                data: LogData {
                    kind: "input".to_string(),
                    data: Some("默认输入内容".to_string()),
                    node_id: node.id.clone(),
                    node_type: None,
                    result: None,
                },
            });
            send_json(
                LogData {
                    kind: "input".to_string(),
                    data: Some("默认输入内容".to_string()),
                    node_id: node.id.clone(),
                    node_type: None,
                    result: None,
                },
                sender,
            )?;
        }
        "ai-model" => {
            let config = OpenAIConfig::new()
                .with_api_key("None")
                .with_api_base("http://222.190.139.186:11436/v1");
            let client = Client::with_config(config);

            let request = CreateCompletionRequestArgs::default()
                .model("qwen3:14b")
                .n(1)
                .prompt("你好呀")
                .stream(true)
                .max_tokens(1024_u32)
                .build()?;

            let mut stream = client.completions().create_stream(request).await?;

            while let Some(response) = stream.next().await {
                match response {
                    Ok(ccr) => ccr.choices.iter().for_each(|c| {
                        logs.push(Log {
                            timestamp: Utc::now(),
                            data: LogData {
                                kind: "ai_response_chunk".to_string(),
                                data: Some(c.text.clone()),
                                node_id: node.id.clone(),
                                node_type: None,
                                result: None,
                            },
                        });
                        send_json(
                            LogData {
                                kind: "ai_response_chunk".to_string(),
                                data: Some(c.text.clone()),
                                node_id: node.id.clone(),
                                node_type: None,
                                result: None,
                            },
                            sender,
                        )
                        .unwrap();
                    }),
                    Err(e) => eprintln!("{}", e),
                }
            }
        }
        _ => {}
    }
    logs.push(Log {
        timestamp: Utc::now(),
        data: LogData {
            kind: "node_complete".to_string(),
            data: None,
            node_id: node.id.clone(),
            node_type: Some("input".to_string()),
            result: None,
        },
    });
    send_json(
        LogData {
            kind: "node_complete".to_string(),
            data: None,
            node_id: node.id.clone(),
            node_type: Some("input".to_string()),
            result: None,
        },
        sender,
    )?;
    Ok(logs)
}

fn send_json<T: Serialize>(data: T, sender: &UnboundedSender<Result<Event, Infallible>>) -> anyhow::Result<()> {
    let msg = Event::default().json_data(data)?;
    if sender.send(Ok(msg)).is_err() {
        log::info!("发送事件失败");
    }
    Ok(())
}

fn send_string(data: String, sender: &UnboundedSender<Result<Event, Infallible>>) -> anyhow::Result<()> {
    let msg = Event::default().data(data);
    if sender.send(Ok(msg)).is_err() {
        log::info!("发送事件失败");
    }
    Ok(())
}

/// 执行历史

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Execution {
    id: String,
    #[serde(rename = "workflowId")]
    workflow_id: String,
    input: HashMap<String, String>,
    logs: Vec<Log>,
    duration: i64,
    status: String,
    timestamp: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Log {
    timestamp: DateTime<Utc>,
    data: LogData,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LogData {
    #[serde(rename = "type")]
    kind: String,
    #[serde(rename = "nodeId")]
    node_id: String,
    #[serde(rename = "nodeType")]
    node_type: Option<String>,
    result: Option<String>,
    data: Option<String>,
}
