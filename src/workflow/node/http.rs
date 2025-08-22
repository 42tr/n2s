use std::{convert::Infallible, str::FromStr};

use axum::response::sse::Event;
use chrono::Utc;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use tokio::sync::mpsc::UnboundedSender;

use super::super::{
    model::{Log, LogData, Node}, sse::send_json
};

pub async fn execute(node: &Node, sender: &UnboundedSender<Result<Event, Infallible>>) -> anyhow::Result<Vec<Log>> {
    let mut logs = vec![];
    let url = node.config.get("url");
    if url.is_none() {
        let log_data = LogData { kind: "http-request-error".to_string(), data: Some("url 为空".to_string()), node_id: node.id.clone(), node_type: None, result: None };
        logs.push(Log { timestamp: Utc::now(), data: log_data.clone() });
        send_json(log_data, sender).unwrap();
    } else {
        let url = url.unwrap();
        let method = node.config.get("method").map(|s| s.as_str()).unwrap_or("GET");
        let headers_str = node.config.get("headers").map(|s| s.as_str()).unwrap_or("");
        let body = node.config.get("body").cloned().unwrap_or_default();
        let client = reqwest::Client::new();
        let request = client.request(method.parse().unwrap(), url);
        let mut header_map = HeaderMap::new();
        if !headers_str.trim().is_empty() {
            for line in headers_str.trim().lines() {
                if let Some((k, v)) = line.split_once(':') {
                    let name = HeaderName::from_str(k.trim()).map_err(|_| "Invalid header name").unwrap();
                    let value = HeaderValue::from_str(v.trim()).map_err(|_| "Invalid header value").unwrap();
                    header_map.insert(name, value);
                }
            }
        }
        let request = request.headers(header_map);
        let request = request.body(body.clone());
        let response = request.send().await;
        match response {
            Ok(response) => {
                let text = response.text().await.unwrap_or_default();
                let log_data = LogData { kind: "output".to_string(), data: Some(text.clone()), node_id: node.id.clone(), node_type: None, result: Some(text.clone()) };
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
    Ok(logs)
}
