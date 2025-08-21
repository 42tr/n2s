use std::convert::Infallible;

use axum::response::sse::Event;
use chrono::Utc;
use tokio::sync::mpsc::UnboundedSender;

use super::super::{
    model::{Log, LogData, Node}, sse
};

pub async fn execute(node: &Node, sender: &UnboundedSender<Result<Event, Infallible>>) -> anyhow::Result<Vec<Log>> {
    let log_data = LogData {
        kind: "input".to_string(),
        data: Some("默认输入内容".to_string()),
        node_id: node.id.clone(),
        node_type: None,
        result: None,
    };
    sse::send_json(log_data.clone(), sender)?;
    return Ok(vec![Log {
        timestamp: Utc::now(),
        data: log_data,
    }]);
}
