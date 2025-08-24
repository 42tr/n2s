use std::convert::Infallible;

use axum::response::sse::Event;
use chrono::Utc;
use log::info;
use mlua::Lua;
use tokio::sync::mpsc::UnboundedSender;

use super::super::{
    model::{Log, LogData, Node}, sse
};

pub async fn execute(node: &Node, sender: &Option<UnboundedSender<Result<Event, Infallible>>>) -> anyhow::Result<(Vec<Log>, String)> {
    let script = node.config.get("script").map(|v| v.to_string()).unwrap_or("".to_string());
    let lua = Lua::new();

    info!("Lua script: {}", script);
    let result: String = lua.load(script).eval()?;
    info!("Lua script result: {}", result);

    let log_data = LogData { kind: "output".to_string(), data: Some(result.clone()), node_id: node.id.clone(), node_type: None, result: Some(result.clone()) };
    sse::send_json(log_data.clone(), sender)?;
    return Ok((vec![Log { timestamp: Utc::now(), data: log_data }], result));
}
