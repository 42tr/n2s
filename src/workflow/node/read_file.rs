use std::{convert::Infallible, fs};

use axum::response::sse::Event;
use chrono::Utc;
use tokio::sync::mpsc::UnboundedSender;

use super::super::{
    model::{Log, LogData, Node},
    sse::send_json,
};

pub async fn execute(
    node: &Node,
    sender: &Option<UnboundedSender<Result<Event, Infallible>>>,
) -> anyhow::Result<(Vec<Log>, String)> {
    let mut logs = vec![];
    let mut output = String::new();
    let path = node.config.get("path");
    if path.is_none() {
        let log_data = LogData {
            kind: "read-file-error".to_string(),
            data: Some("path 为空".to_string()),
            node_id: node.id.clone(),
            node_type: None,
            result: None,
        };
        logs.push(Log {
            timestamp: Utc::now(),
            data: log_data.clone(),
        });
        send_json(log_data, sender).unwrap();
    } else {
        let path = path.unwrap();
        match fs::read_to_string(path) {
            Ok(content) => {
                output.push_str(&content);
                let log_data = LogData {
                    kind: "output".to_string(),
                    data: Some(content.clone()),
                    node_id: node.id.clone(),
                    node_type: None,
                    result: Some(content.clone()),
                };
                logs.push(Log {
                    timestamp: Utc::now(),
                    data: log_data.clone(),
                });
                send_json(log_data, sender).unwrap();
            }
            Err(e) => {
                let log_data = LogData {
                    kind: "output".to_string(),
                    data: Some(format!("error: {}", e)),
                    node_id: node.id.clone(),
                    node_type: None,
                    result: None,
                };
                logs.push(Log {
                    timestamp: Utc::now(),
                    data: log_data.clone(),
                });
                send_json(log_data, sender).unwrap();
            }
        }
    }
    Ok((logs, output))
}
