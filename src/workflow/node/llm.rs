use std::convert::Infallible;

use async_openai::{Client, config::OpenAIConfig, types::CreateCompletionRequestArgs};
use axum::response::sse::Event;
use chrono::Utc;
use futures::StreamExt;
use tokio::sync::mpsc::UnboundedSender;

use super::super::{
    model::{Log, LogData, Node}, sse
};

pub async fn execute(node: &Node, sender: &UnboundedSender<Result<Event, Infallible>>) -> anyhow::Result<Vec<Log>> {
    let mut logs = vec![];
    let config = OpenAIConfig::new()
        .with_api_key("None")
        .with_api_base("http://222.190.139.186:11436/v1");
    let client = Client::with_config(config);

    let request = CreateCompletionRequestArgs::default()
        .model("qwen3:14b")
        .n(1)
        .prompt("你好呀")
        .stream(true)
        .max_tokens(1024_u32)
        .build()?;

    let mut stream = client.completions().create_stream(request).await?;

    while let Some(response) = stream.next().await {
        match response {
            Ok(ccr) => ccr.choices.iter().for_each(|c| {
                let log_data = LogData {
                    kind: "ai_response_chunk".to_string(),
                    data: Some(c.text.clone()),
                    node_id: node.id.clone(),
                    node_type: None,
                    result: None,
                };
                logs.push(Log {
                    timestamp: Utc::now(),
                    data: log_data.clone(),
                });
                sse::send_json(log_data, sender).unwrap();
            }),
            Err(e) => eprintln!("{}", e),
        }
    }
    Ok(logs)
}
