use std::convert::Infallible;

use async_openai::{Client, config::OpenAIConfig, types::CreateCompletionRequestArgs};
use axum::response::sse::Event;
use chrono::Utc;
use futures::StreamExt;
use log::info;
use tokio::sync::mpsc::UnboundedSender;

use super::super::{
    model::{Log, LogData, Node}, sse
};

pub async fn execute(node: &Node, sender: &UnboundedSender<Result<Event, Infallible>>) -> anyhow::Result<(Vec<Log>, String)> {
    let base_url = node.config.get("baseUrl").map(|v| v.to_string()).unwrap_or("http://222.190.139.186:11436/v1".to_string());
    let api_key = node.config.get("apiKey").map(|v| v.to_string()).unwrap_or("None".to_string());
    let model = node.config.get("model").map(|v| v.to_string()).unwrap_or("qwen3:14b".to_string());
    let prompt = node.config.get("prompt").map(|v| v.to_string()).unwrap_or("你好呀".to_string());
    info!(
        "Executing LLM node with base_url: {}, api_key: {}, model: {}, prompt: {}",
        base_url, api_key, model, prompt
    );
    let mut logs = vec![];
    let mut output = String::new();
    let config = OpenAIConfig::new().with_api_key(api_key).with_api_base(base_url);
    let client = Client::with_config(config);

    let request = CreateCompletionRequestArgs::default().model(model).n(1).prompt(prompt).stream(true).max_tokens(1024_u32).build()?;

    let mut stream = client.completions().create_stream(request).await?;

    while let Some(response) = stream.next().await {
        match response {
            Ok(ccr) => ccr.choices.iter().for_each(|c| {
                let log_data = LogData { kind: "ai_response_chunk".to_string(), data: Some(c.text.clone()), node_id: node.id.clone(), node_type: None, result: None };
                logs.push(Log { timestamp: Utc::now(), data: log_data.clone() });
                sse::send_json(log_data, sender).unwrap();
                output.push_str(&c.text);
            }),
            Err(e) => eprintln!("{}", e),
        }
    }
    Ok((logs, output))
}
