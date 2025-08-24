use std::convert::Infallible;

use axum::response::sse::Event;
use chrono::Utc;
use tokio::sync::mpsc::UnboundedSender;

use super::super::{
    model::{Log, LogData, Node}, sse
};

pub async fn execute(node: &Node, sender: &Option<UnboundedSender<Result<Event, Infallible>>>) -> anyhow::Result<(Vec<Log>, String)> {
    let output = node.config.get("output").map(|v| v.to_string());
    let log_data = LogData { kind: "output".to_string(), data: output.clone(), node_id: node.id.clone(), node_type: None, result: None };
    sse::send_json(log_data.clone(), sender)?;
    return Ok((
        vec![Log { timestamp: Utc::now(), data: log_data }],
        output.unwrap_or("".to_string()),
    ));
}
