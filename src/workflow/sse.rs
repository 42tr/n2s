use std::convert::Infallible;

use axum::response::sse::Event;
use serde::Serialize;
use tokio::sync::mpsc::UnboundedSender;

pub fn send_json<T: Serialize>(data: T, sender: &Option<UnboundedSender<Result<Event, Infallible>>>) -> anyhow::Result<()> {
    let msg = Event::default().json_data(data)?;
    if let Some(sender) = sender {
        if sender.send(Ok(msg)).is_err() {
            log::info!("发送事件失败");
        }
    }
    Ok(())
}

pub fn send_string(data: String, sender: &Option<UnboundedSender<Result<Event, Infallible>>>) -> anyhow::Result<()> {
    let msg = Event::default().data(data);
    if let Some(sender) = sender {
        if sender.send(Ok(msg)).is_err() {
            log::info!("发送事件失败");
        }
    }
    Ok(())
}

pub fn send_error(error: String, sender: &Option<UnboundedSender<Result<Event, Infallible>>>) -> anyhow::Result<()> {
    let event = Event::default().data(error).event("error");

    if let Some(sender) = sender {
        if sender.send(Ok(event)).is_err() {
            log::info!("发送错误事件失败");
        }
    }
    Ok(())
}
