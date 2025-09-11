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
    let script = node.config.get("script").map(|v| v.to_string()).unwrap_or_default();
    let lua = Lua::new();

    info!("Lua script: {}", script);

    // 👇 注入 json.lua（纯 Lua 实现）
    let json_lua = include_str!("json.lua"); // 假设你把 json.lua 放在同一目录
    // if let Err(err) = lua.load(json_lua).eval::<()>() {
    //     info!("Failed to load json.lua: {}", err);
    // }
    let json_module: mlua::Table = match lua.load(json_lua).eval() {
        Ok(module) => module,
        Err(err) => {
            info!("Failed to load json.lua: {}", err);
            return Err(err.into());
        }
    };
    lua.globals().set("json", json_module)?;

    // 👇 注入用户脚本并执行
    // let result: mlua::Value = lua.load(script).eval()?;
    let result: mlua::Value = match lua.load(script).eval() {
        Ok(value) => value,
        Err(err) => {
            info!("Failed to execute Lua script: {}", err);
            mlua::Value::Nil
        }
    };

    // 安全转换为字符串
    let result_str = match result {
        mlua::Value::String(s) => s.to_str()?.to_string(),
        mlua::Value::Nil => "null".to_string(),
        mlua::Value::Boolean(b) => b.to_string(),
        mlua::Value::Number(n) => n.to_string(),
        _ => format!("<unsupported: {:?}>", result),
    };

    info!("Lua script result: {}", result_str);

    let log_data = LogData { kind: "output".to_string(), data: Some(result_str.clone()), node_id: node.id.clone(), node_type: None, result: Some(result_str.clone()) };
    sse::send_json(log_data.clone(), sender)?;

    Ok((
        vec![Log { timestamp: Utc::now(), data: log_data }],
        result_str,
    ))
}
