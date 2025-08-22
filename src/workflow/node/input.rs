use std::convert::Infallible;

use axum::response::sse::Event;
use chrono::Utc;
use tokio::sync::mpsc::UnboundedSender;

use super::super::{
    model::{Log, LogData, Node}, sse
};

pub async fn execute(node: &Node, sender: &UnboundedSender<Result<Event, Infallible>>) -> anyhow::Result<(Vec<Log>, String)> {
    let input = node.config.get("input").map(|v| v.to_string());
    let log_data = LogData { kind: "input".to_string(), data: input.clone(), node_id: node.id.clone(), node_type: None, result: None };
    sse::send_json(log_data.clone(), sender)?;
    return Ok((
        vec![Log { timestamp: Utc::now(), data: log_data }],
        input.unwrap_or("".to_string()),
    ));
}
