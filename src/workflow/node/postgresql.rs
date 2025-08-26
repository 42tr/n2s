use std::{convert::Infallible, time::Duration};

use axum::response::sse::Event;
use chrono::Utc;
use serde_json::{Value, json};
use tokio::sync::mpsc::UnboundedSender;
use tokio_postgres::{Client, NoTls};

use super::super::{
    model::{Log, LogData, Node}, sse::send_json
};

pub async fn execute(node: &Node, sender: &Option<UnboundedSender<Result<Event, Infallible>>>) -> anyhow::Result<(Vec<Log>, String)> {
    let mut logs = vec![];
    let mut output = String::new();

    // Get configuration parameters
    let host = node.config.get("host").map_or("localhost", |v| v.as_str());
    let port = node.config.get("port").map_or("5432", |v| v.as_str());
    let database = node.config.get("database");
    let username = node.config.get("username");
    let password = node.config.get("password");
    let query = node.config.get("query");

    // Validate required parameters
    if database.is_none() {
        let log_data = LogData { kind: "postgresql-error".to_string(), data: Some("数据库名称为空".to_string()), node_id: node.id.clone(), node_type: None, result: None };
        logs.push(Log { timestamp: Utc::now(), data: log_data.clone() });
        send_json(log_data, sender).unwrap();
        return Ok((logs, output));
    }

    if username.is_none() {
        let log_data = LogData { kind: "postgresql-error".to_string(), data: Some("用户名为空".to_string()), node_id: node.id.clone(), node_type: None, result: None };
        logs.push(Log { timestamp: Utc::now(), data: log_data.clone() });
        send_json(log_data, sender).unwrap();
        return Ok((logs, output));
    }

    if query.is_none() {
        let log_data = LogData { kind: "postgresql-error".to_string(), data: Some("SQL查询为空".to_string()), node_id: node.id.clone(), node_type: None, result: None };
        logs.push(Log { timestamp: Utc::now(), data: log_data.clone() });
        send_json(log_data, sender).unwrap();
        return Ok((logs, output));
    }

    let database = database.unwrap();
    let username = username.unwrap();
    let password = password.map_or("", |v| v.as_str());
    let query = query.unwrap();

    // Build connection string
    let conn_str = format!(
        "host={} port={} dbname={} user={} password={}",
        host, port, database, username, password
    );

    // Log connection attempt
    let log_data = LogData {
        kind: "postgresql-info".to_string(),
        data: Some(format!(
            "正在连接到 PostgreSQL 数据库: {}@{}:{}/{}",
            username, host, port, database
        )),
        node_id: node.id.clone(),
        node_type: None,
        result: None,
    };
    logs.push(Log { timestamp: Utc::now(), data: log_data.clone() });
    send_json(log_data, sender).unwrap();

    // Connect to database
    let (client, connection) = match tokio_postgres::connect(&conn_str, NoTls).await {
        Ok((client, connection)) => (client, connection),
        Err(e) => {
            let log_data = LogData { kind: "postgresql-error".to_string(), data: Some(format!("连接数据库失败: {}", e)), node_id: node.id.clone(), node_type: None, result: None };
            logs.push(Log { timestamp: Utc::now(), data: log_data.clone() });
            send_json(log_data, sender).unwrap();
            return Ok((logs, output));
        }
    };

    // Spawn connection task
    let _handle = tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("PostgreSQL connection error: {}", e);
        }
    });

    // Execute query with timeout
    let query_result = tokio::time::timeout(Duration::from_secs(30), execute_query(&client, query)).await;

    match query_result {
        Ok(Ok(result)) => {
            output = result.clone();
            let log_data = LogData { kind: "output".to_string(), data: Some(result.clone()), node_id: node.id.clone(), node_type: None, result: Some(result) };
            logs.push(Log { timestamp: Utc::now(), data: log_data.clone() });
            send_json(log_data, sender).unwrap();
        }
        Ok(Err(e)) => {
            let log_data = LogData { kind: "postgresql-error".to_string(), data: Some(format!("查询执行失败: {}", e)), node_id: node.id.clone(), node_type: None, result: None };
            logs.push(Log { timestamp: Utc::now(), data: log_data.clone() });
            send_json(log_data, sender).unwrap();
        }
        Err(_) => {
            let log_data = LogData { kind: "postgresql-error".to_string(), data: Some("查询超时".to_string()), node_id: node.id.clone(), node_type: None, result: None };
            logs.push(Log { timestamp: Utc::now(), data: log_data.clone() });
            send_json(log_data, sender).unwrap();
        }
    }

    Ok((logs, output))
}

async fn execute_query(client: &Client, query: &str) -> anyhow::Result<String> {
    let rows = client.query(query, &[]).await?;

    if rows.is_empty() {
        let result = json!({
            "success": true,
            "message": "查询执行成功，无结果返回",
            "columns": [],
            "data": [],
            "row_count": 0
        });
        return Ok(result.to_string());
    }

    // Get column names and types
    let columns = rows[0].columns();
    let column_info: Vec<Value> = columns
        .iter()
        .map(|col| {
            json!({
                "name": col.name(),
                "type": col.type_().name()
            })
        })
        .collect();

    // Extract data rows
    let mut data_rows = Vec::new();
    for row in &rows {
        let mut row_object = serde_json::Map::new();

        for (i, column) in columns.iter().enumerate() {
            let column_name = column.name();

            // Try to get value as different types
            let value = if let Ok(val) = row.try_get::<_, String>(i) {
                json!(val)
            } else if let Ok(val) = row.try_get::<_, i32>(i) {
                json!(val)
            } else if let Ok(val) = row.try_get::<_, i64>(i) {
                json!(val)
            } else if let Ok(val) = row.try_get::<_, f32>(i) {
                json!(val)
            } else if let Ok(val) = row.try_get::<_, f64>(i) {
                json!(val)
            } else if let Ok(val) = row.try_get::<_, bool>(i) {
                json!(val)
            } else if let Ok(val) = row.try_get::<_, chrono::NaiveDateTime>(i) {
                json!(val.format("%Y-%m-%d %H:%M:%S").to_string())
            } else if let Ok(val) = row.try_get::<_, chrono::NaiveDate>(i) {
                json!(val.format("%Y-%m-%d").to_string())
            } else {
                json!(null)
            };

            row_object.insert(column_name.to_string(), value);
        }

        data_rows.push(json!(row_object));
    }

    let result = json!({
        "success": true,
        "message": format!("查询执行成功，返回 {} 条记录", data_rows.len()),
        "columns": column_info,
        "data": data_rows,
        "row_count": data_rows.len()
    });

    Ok(result.to_string())
}
