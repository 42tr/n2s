use std::{
    collections::HashMap, convert::Infallible, sync::{Arc, OnceLock}
};

use axum::{
    Json, body::Body, extract::{Path, Query}, http::header, response::{IntoResponse, Response, Sse, sse::Event}
};
use chrono::Utc;
use log::info;
use tokio::sync::{
    RwLock, mpsc, mpsc::{UnboundedReceiver, UnboundedSender}
};
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
use model::{Execution, Log, LogData, Node, Workflow, WorkflowReqParam};

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
    let (sender, receiver) = mpsc::unbounded_channel();
    tokio::spawn(async move {
        let _ = run_workflow(workflow, Some(sender), false, None).await;
    });

    sse_response(receiver)
}

pub async fn execute(Path(id): Path<String>, Query(param): Query<WorkflowReqParam>) -> Response<Body> {
    let data = WORKFLOWS.get_or_init(|| Arc::new(RwLock::new(load_config()))).read().await;
    let index = match data.iter().position(|w| w.id == Some(id.clone())) {
        Some(idx) => idx,
        None => {
            return (
                axum::http::StatusCode::OK,
                format!("工作流不存在：id={}", id),
            )
                .into_response();
        }
    };
    let workflow = data[index].clone(); // 克隆 workflow 以避免锁持有太久
    drop(data); // 尽早释放锁

    if workflow.nodes.iter().any(|node| node.kind == "output") {
        let output = run_workflow(workflow, None, true, param.input).await.unwrap();
        return (axum::http::StatusCode::OK, output).into_response();
    }

    let (sender, receiver) = mpsc::unbounded_channel();

    tokio::spawn(async move {
        let _ = run_workflow(workflow, Some(sender), true, param.input).await;
    });

    sse_response(receiver).into_response()
}

async fn run_workflow(workflow: Workflow, sender: Option<UnboundedSender<Result<Event, Infallible>>>, record_execution: bool, input: Option<String>) -> anyhow::Result<String> {
    let mut result = String::new();
    let edges = workflow.edges.clone();
    let next_node_map = edges.iter().map(|edge| (edge.source.clone(), edge.target.clone())).collect::<HashMap<String, String>>();
    let mut nodes = workflow.nodes.clone();

    // 找出起始节点（没有前驱的节点）
    let filter_nodes: Vec<String> = edges.iter().map(|edge| edge.target.clone()).collect();
    let mut start_nodes: Vec<String> = nodes.iter().filter(|node| !filter_nodes.contains(&node.id)).map(|node| node.id.clone()).collect();

    let mut input_map: HashMap<String, String> = HashMap::new();
    if let Some(input) = input {
        for node_id in start_nodes.clone() {
            input_map.insert(node_id, input.clone());
        }
    }

    let mut logs = Vec::new();
    let start_time = Utc::now();

    loop {
        let mut has_more = false;

        for node_id in &start_nodes {
            if let Some(node) = nodes.iter_mut().find(|n| n.id == *node_id) {
                if let Some(input) = input_map.get(node_id) {
                    node.reset_config(input);
                }
                match excute_node(node, &sender).await {
                    Ok((node_logs, output)) => {
                        logs.extend(node_logs);
                        if let Some(next_node) = next_node_map.get(node_id) {
                            input_map.insert(next_node.clone(), output.clone());
                        }
                        if node.kind == "output" {
                            result = output;
                        }
                    }
                    Err(e) => {
                        let _ = sse::send_error(format!("Node execution failed: {}", e), &sender);
                        return Err(e);
                    }
                }
                has_more = true;
            }
        }

        // 下一层节点：当前执行节点的所有后继
        start_nodes = edges.iter().filter(|edge| start_nodes.contains(&edge.source)).map(|edge| edge.target.clone()).collect();

        if !has_more || start_nodes.is_empty() {
            break;
        }
    }

    // 记录执行历史（仅当 record_execution 为 true）
    if record_execution {
        let end_time = Utc::now();
        let execution = Execution {
            id: Uuid::new_v4().to_string(),
            status: "completed".to_string(),
            workflow_id: workflow.id.unwrap_or_else(|| "unknown".to_string()),
            input: HashMap::new(),
            timestamp: start_time,
            duration: (end_time - start_time).num_milliseconds(),
            logs,
        };
        create_execution(execution).await;
    }

    // 发送完成信号
    let _ = sse::send_string("[DONE]".to_string(), &sender);
    Ok(result)
}

async fn excute_node(node: &Node, sender: &Option<UnboundedSender<Result<Event, Infallible>>>) -> anyhow::Result<(Vec<Log>, String)> {
    info!("Executing node: {:?}", node);
    let mut logs = vec![];
    let log_data = LogData { kind: "node_start".to_string(), node_id: node.id.clone(), node_type: Some(node.kind.clone()), result: None, data: None };
    logs.push(Log { timestamp: Utc::now(), data: log_data.clone() });
    sse::send_json(log_data, sender)?;
    let (node_logs, output) = match node.kind.as_str() {
        "input" => node::input::execute(node, sender).await?,
        "output" => node::output::execute(node, sender).await?,
        "ai-model" => node::llm::execute(node, sender).await?,
        "http-request" => node::http::execute(node, sender).await?,
        "lua-script" => node::lua_script::execute(node, sender).await?,
        "postgresql" => node::postgresql::execute(node, sender).await?,
        _ => (vec![], "".to_string()),
    };
    logs.extend(node_logs);
    let log_data = LogData { kind: "node_complete".to_string(), data: None, node_id: node.id.clone(), node_type: Some("input".to_string()), result: None };
    logs.push(Log { timestamp: Utc::now(), data: log_data.clone() });
    sse::send_json(log_data, sender).unwrap();
    Ok((logs, output))
}

fn sse_response(receiver: UnboundedReceiver<Result<Event, Infallible>>) -> impl IntoResponse {
    let stream = UnboundedReceiverStream::new(receiver);
    (
        [(header::CONTENT_TYPE, "text/event-stream; charset=utf-8"), (header::CACHE_CONTROL, "no-cache"), (header::CONNECTION, "keep-alive")],
        Sse::new(stream),
    )
}

// fn sse_response(receiver: UnboundedReceiver<Result<Event, Infallible>>) -> impl IntoResponse {
//     // 构建 HeaderMap
//     let mut headers = header::HeaderMap::new();
//     headers.insert(
//         header::CONTENT_TYPE,
//         "text/event-stream; charset=utf-8".parse().unwrap(),
//     );
//     headers.insert(header::CACHE_CONTROL, "no-cache".parse().unwrap());
//     headers.insert(header::CONNECTION, "keep-alive".parse().unwrap());

//     // 创建流
//     let stream = UnboundedReceiverStream::new(receiver);
//     let sse = Sse::new(stream).keep_alive(KeepAlive::default());

//     // 返回 (HeaderMap, Sse)
//     (headers, sse).into_response()
// }
