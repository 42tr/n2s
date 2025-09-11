use std::convert::Infallible;

use async_openai::{
    Client, config::OpenAIConfig, types::{ChatCompletionRequestMessage, ChatCompletionRequestUserMessageArgs}
};
use axum::response::sse::Event;
use chrono::Utc;
use futures::StreamExt;
use log::info;
use tokio::sync::mpsc::UnboundedSender;

use super::super::{
    model::{Log, LogData, Node}, sse
};

pub async fn execute(node: &Node, sender: &Option<UnboundedSender<Result<Event, Infallible>>>) -> anyhow::Result<(Vec<Log>, String)> {
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

    let log_data = LogData { kind: "ai_response_chunk".to_string(), data: Some(format!("Input: {}\n\nOutput:", prompt.clone())), node_id: node.id.clone(), node_type: None, result: None };
    logs.push(Log { timestamp: Utc::now(), data: log_data.clone() });
    sse::send_json(log_data, sender).unwrap();

    let request = async_openai::types::CreateChatCompletionRequestArgs::default()
        .model(model)
        .messages(vec![ChatCompletionRequestMessage::User(
            ChatCompletionRequestUserMessageArgs::default().content(prompt).build()?,
        )])
        .build()?;

    let mut stream = client.chat().create_stream(request).await?;

    while let Some(response) = stream.next().await {
        match response {
            Ok(ccr) => ccr.choices.iter().for_each(|c| {
                let log_data = LogData { kind: "ai_response_chunk".to_string(), data: c.delta.content.clone(), node_id: node.id.clone(), node_type: None, result: None };
                logs.push(Log { timestamp: Utc::now(), data: log_data.clone() });
                sse::send_json(log_data, sender).unwrap();
                if let Some(content) = c.delta.content.as_ref() {
                    output.push_str(content);
                }
            }),
            Err(e) => {
                eprintln!("{}", e);
                break;
            }
        }
    }
    Ok((logs, output))
}
