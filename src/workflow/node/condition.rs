use std::convert::Infallible;

use axum::response::sse::Event;
use chrono::Utc;
use tokio::sync::mpsc::UnboundedSender;

use crate::workflow::{model::{Log, LogData, Node}, sse};

pub async fn execute(node: &Node, sender: &Option<UnboundedSender<Result<Event, Infallible>>>) -> anyhow::Result<(Vec<Log>, String)> {
    let mut logs = vec![];
    
    // 获取条件表达式
    let condition = node.config.get("condition").unwrap_or(&String::new()).clone();
    
    // 记录输入
    let log_data = LogData {
        kind: "input".to_string(),
        node_id: node.id.clone(),
        node_type: Some("condition".to_string()),
        result: None,
        data: Some(condition.clone()),
    };
    logs.push(Log {
        timestamp: Utc::now(),
        data: log_data.clone(),
    });
    sse::send_json(log_data, sender)?;
    
    // 评估条件表达式
    let result = evaluate_condition(&condition);
    
    // 记录输出
    let output = if result { "true" } else { "false" };
    let log_data = LogData {
        kind: "output".to_string(),
        node_id: node.id.clone(),
        node_type: Some("condition".to_string()),
        result: None,
        data: Some(output.to_string()),
    };
    logs.push(Log {
        timestamp: Utc::now(),
        data: log_data.clone(),
    });
    sse::send_json(log_data, sender)?;
    
    Ok((logs, output.to_string()))
}

// 简单的条件表达式评估函数
fn evaluate_condition(condition: &str) -> bool {
    // 这里实现一个简单的条件评估逻辑
    // 实际应用中可能需要更复杂的表达式解析器
    
    // 去除空格
    let condition = condition.trim();
    
    // 处理简单的布尔值
    if condition.eq_ignore_ascii_case("true") {
        return true;
    }
    if condition.eq_ignore_ascii_case("false") {
        return false;
    }
    
    // 处理简单的比较表达式
    if condition.contains("==") {
        let parts: Vec<&str> = condition.split("==").collect();
        if parts.len() == 2 {
            let left = parts[0].trim();
            let right = parts[1].trim();
            return left == right;
        }
    }
    
    if condition.contains("!=") {
        let parts: Vec<&str> = condition.split("!=").collect();
        if parts.len() == 2 {
            let left = parts[0].trim();
            let right = parts[1].trim();
            return left != right;
        }
    }
    
    // 处理数值比较
    if condition.contains(">") {
        let parts: Vec<&str> = condition.split(">").collect();
        if parts.len() == 2 {
            if let (Ok(left), Ok(right)) = (parts[0].trim().parse::<f64>(), parts[1].trim().parse::<f64>()) {
                return left > right;
            }
        }
    }
    
    if condition.contains("<") {
        let parts: Vec<&str> = condition.split("<").collect();
        if parts.len() == 2 {
            if let (Ok(left), Ok(right)) = (parts[0].trim().parse::<f64>(), parts[1].trim().parse::<f64>()) {
                return left < right;
            }
        }
    }
    
    // 默认返回 false
    false
}