use std::{convert::Infallible, fs, path::Path};

use axum::response::sse::Event;
use chrono::Utc;
use tokio::sync::mpsc::UnboundedSender;

use super::super::{
    model::{Log, LogData, Node}, sse::send_json
};

pub async fn execute(node: &Node, sender: &Option<UnboundedSender<Result<Event, Infallible>>>) -> anyhow::Result<(Vec<Log>, String)> {
    let mut logs = vec![];
    let output = String::new();
    let path = node.config.get("path");
    let content = node.config.get("content");

    if path.is_none() || content.is_none() {
        let log_data = LogData { kind: "write-file-error".to_string(), data: Some("path 或 content 为空".to_string()), node_id: node.id.clone(), node_type: None, result: None };
        logs.push(Log { timestamp: Utc::now(), data: log_data.clone() });
        send_json(log_data, sender).unwrap();
    } else {
        let path = path.unwrap();
        let content = content.unwrap();
        if let Some(parent) = Path::new(path).parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)?;
            }
        }
        match fs::write(path, content) {
            Ok(_) => {
                let log_data =
                    LogData { kind: "output".to_string(), data: Some("文件写入成功".to_string()), node_id: node.id.clone(), node_type: None, result: Some("文件写入成功".to_string()) };
                logs.push(Log { timestamp: Utc::now(), data: log_data.clone() });
                send_json(log_data, sender).unwrap();
            }
            Err(e) => {
                let log_data = LogData { kind: "output".to_string(), data: Some(format!("error: {}", e)), node_id: node.id.clone(), node_type: None, result: None };
                logs.push(Log { timestamp: Utc::now(), data: log_data.clone() });
                send_json(log_data, sender).unwrap();
            }
        }
    }
    Ok((logs, output))
}
