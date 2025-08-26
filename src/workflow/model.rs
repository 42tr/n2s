use std::collections::HashMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Position {
    pub x: f32,
    pub y: f32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Node {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub position: Position,
    pub config: HashMap<String, String>,
    pub label: Option<String>,
}

impl Node {
    pub fn reset_config(&mut self, input: &String) {
        for (_key, value) in self.config.iter_mut() {
            *value = value.replace("${input}", &input);
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Edge {
    pub source: String,
    pub target: String,
    #[serde(rename = "sourceHandle", skip_serializing_if = "Option::is_none")]
    pub source_handle: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Workflow {
    pub id: Option<String>,
    pub name: String,
    pub nodes: Vec<Node>,
    pub edges: Vec<Edge>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<DateTime<Utc>>,
    #[serde(rename = "updatedAt")]
    pub updated_at: Option<DateTime<Utc>>,
}

/// 执行历史

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Execution {
    pub id: String,
    #[serde(rename = "workflowId")]
    pub workflow_id: String,
    pub input: HashMap<String, String>,
    pub logs: Vec<Log>,
    pub duration: i64,
    pub status: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Log {
    pub timestamp: DateTime<Utc>,
    pub data: LogData,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LogData {
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(rename = "nodeId")]
    pub node_id: String,
    #[serde(rename = "nodeType")]
    pub node_type: Option<String>,
    pub result: Option<String>,
    pub data: Option<String>,
}

/// 执行请求

#[derive(Deserialize)]
pub struct WorkflowReqParam {
    pub input: Option<String>,
}
