import React, { useState } from "react";
import { Handle, Position } from "@xyflow/react";
import ModelSelector from "./ModelSelector";

interface CustomNodeProps {
  data: {
    label: string;
    nodeType: string;
    config: any;
    status?: "idle" | "running" | "completed" | "error";
    logs?: string[];
    error?: string;
    output?: string;
  };
  id: string;
  selected?: boolean;
  onConfigChange?: (nodeId: string, config: any) => void;
}

const CustomNode: React.FC<CustomNodeProps> = ({
  data,
  id,
  selected,
  onConfigChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showErrorLog, setShowErrorLog] = useState(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editedLabel, setEditedLabel] = useState(data.label);
  
  // 确保editedLabel与data.label保持同步
  React.useEffect(() => {
    setEditedLabel(data.label);
  }, [data.label]);

  // 直接使用data.config，不创建额外的本地状态
  const config = data.config || {};

  const getNodeStyle = (nodeType: string, status?: string) => {
    let borderColor = "#ddd";
    let backgroundColor = "white";

    // 根据节点类型设置颜色
    switch (nodeType) {
      case "ai-model":
        borderColor = "#4CAF50";
        break;
      case "input":
        borderColor = "#2196F3";
        break;
      case "output":
        borderColor = "#FF9800";
        break;
      case "condition":
        borderColor = "#9C27B0";
        break;
      case "http-request":
        borderColor = "#607D8B"; // Deep Grey for HTTP Request
        backgroundColor = "#ECEFF1"; // Light Grey background
        break;
      case "postgresql":
        borderColor = "#336791"; // PostgreSQL blue
        backgroundColor = "#E8F4FD"; // Light blue background
        break;
    }

    // 根据执行状态覆盖样式
    switch (status) {
      case "running":
        borderColor = "#ffc107";
        backgroundColor = "#fff8e1";
        break;
      case "completed":
        borderColor = "#28a745";
        backgroundColor = "#f8fff8";
        break;
      case "error":
        borderColor = "#dc3545";
        backgroundColor = "#fff5f5";
        break;
    }

    if (selected) {
      borderColor = "#007bff";
    }

    return {
      border: `2px solid ${borderColor}`,
      borderRadius: "8px",
      minWidth: "180px",
      maxWidth: "1000px",
      background: backgroundColor,
      color: "#333",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      position: "relative" as const,
    };
  };

  const getNodeIcon = (nodeType: string) => {
    switch (nodeType) {
      case "ai-model":
        return "🤖";
      case "input":
        return "📥";
      case "output":
        return "📤";
      case "condition":
        return "🔀";
      case "http-request":
        return "🌐";
      case "lua-script":
        return "🧩";
      case "postgresql":
        return "🐘";
      default:
        return "⚙️";
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "running":
        return "⏳";
      case "completed":
        return "✅";
      case "error":
        return "❌";
      default:
        return "";
    }
  };

  const truncateText = (text: string, maxLength: number = 444): string => {
    if (text && text.length > maxLength) {
      return text.substring(0, maxLength) + "...";
    }
    return text;
  };

  const handleConfigChange = (key: string, value: string) => {
    console.log("配置更新:", key, "=", value);

    // 创建新的配置对象
    const newConfig = {
      ...config,
      [key]: value,
    };

    console.log("新配置:", newConfig);

    // 通过回调函数通知父组件更新配置
    if (onConfigChange) {
      onConfigChange(id, newConfig);
    }
  };

  const renderConfigPanel = () => {
    if (!isEditing) return null;

    switch (data.nodeType) {
      case "input":
        return (
          <div style={{ padding: "8px", borderTop: "1px solid #eee" }}>
            <div
              style={{
                marginBottom: "4px",
                fontSize: "12px",
                fontWeight: "bold",
              }}
            >
              输入内容:
            </div>
            <textarea
              value={config.input || ""}
              onChange={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleConfigChange("input", e.target.value);
              }}
              onFocus={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="请输入内容..."
              style={{
                width: "100%",
                minHeight: "60px",
                padding: "4px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontSize: "12px",
                resize: "vertical",
                outline: "none",
              }}
            />
          </div>
        );

      case "lua-script":
        return (
          <div style={{ padding: "8px", borderTop: "1px solid #eee" }}>
            <div
              style={{
                marginBottom: "4px",
                fontSize: "12px",
                fontWeight: "bold",
              }}
            >
              脚本:
            </div>
            <textarea
              value={config.script || ""}
              onChange={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleConfigChange("script", e.target.value);
              }}
              onFocus={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="请输入内容..."
              style={{
                width: "100%",
                minHeight: "60px",
                padding: "4px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontSize: "12px",
                resize: "vertical",
                outline: "none",
              }}
            />
          </div>
        );

      case "ai-model":
        return (
          <div style={{ padding: "8px", borderTop: "1px solid #eee" }}>
            <div style={{ marginBottom: "8px" }}>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "bold",
                  marginBottom: "2px",
                }}
              >
                Base URL:
              </div>
              <input
                type="text"
                value={config.baseUrl || ""}
                onChange={(e) => {
                  console.log("BaseURL changed to:", e.target.value); // 调试日志
                  e.preventDefault();
                  e.stopPropagation();
                  handleConfigChange("baseUrl", e.target.value);
                }}
                onFocus={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder={"https://api.example.com"}
                style={{
                  width: "100%",
                  padding: "4px 6px",
                  fontSize: "12px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: "8px" }}>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "bold",
                  marginBottom: "2px",
                }}
              >
                API Key:
              </div>
              <input
                type="text"
                value={config.apiKey || ""}
                onChange={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleConfigChange("apiKey", e.target.value);
                }}
                onFocus={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="API密钥"
                style={{
                  width: "100%",
                  padding: "4px 6px",
                  fontSize: "12px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>

            <ModelSelector
              apiKey={config.apiKey || ""}
              baseUrl={config.baseUrl || ""}
              selectedModel={config.model || ""}
              onModelChange={(model) => handleConfigChange("model", model)}
              isCustomProvider={true}
            />
            <div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "bold",
                  marginBottom: "2px",
                }}
              >
                提示词:
              </div>
              <textarea
                value={config.prompt || ""}
                onChange={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleConfigChange("prompt", e.target.value);
                }}
                onFocus={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="请输入提示词..."
                style={{
                  width: "100%",
                  minHeight: "60px",
                  padding: "4px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "12px",
                  resize: "vertical",
                }}
              />
            </div>
          </div>
        );

      case "condition":
        return (
          <div style={{ padding: "8px", borderTop: "1px solid #eee" }}>
            <div
              style={{
                marginBottom: "4px",
                fontSize: "12px",
                fontWeight: "bold",
              }}
            >
              条件表达式:
            </div>
            <input
              type="text"
              value={config.condition || "true"}
              onChange={(e) => handleConfigChange("condition", e.target.value)}
              onFocus={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="例: input.length > 10"
              style={{ width: "100%", padding: "4px", fontSize: "12px" }}
            />
          </div>
        );

      case "output":
        return (
          <div style={{ padding: "8px", borderTop: "1px solid #eee" }}>
            <div
              style={{
                marginBottom: "4px",
                fontSize: "12px",
                fontWeight: "bold",
              }}
            >
              输出格式:
            </div>
            <input
              type="text"
              value={config.output || "输出完成"}
              onChange={(e) => handleConfigChange("output", e.target.value)}
              onFocus={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="输出格式"
              style={{ width: "100%", padding: "4px", fontSize: "12px" }}
            />
          </div>
        );

      case "http-request":
        return (
          <div style={{ padding: "8px", borderTop: "1px solid #eee" }}>
            <div style={{ marginBottom: "8px" }}>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "bold",
                  marginBottom: "2px",
                }}
              >
                URL:
              </div>
              <input
                type="text"
                value={config.url || ""}
                onChange={(e) => handleConfigChange("url", e.target.value)}
                onFocus={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="https://api.example.com/endpoint"
                style={{
                  width: "100%",
                  padding: "4px 6px",
                  fontSize: "12px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: "8px" }}>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "bold",
                  marginBottom: "2px",
                }}
              >
                方法:
              </div>
              <select
                value={config.method || "GET"}
                onChange={(e) => handleConfigChange("method", e.target.value)}
                onFocus={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  width: "100%",
                  padding: "4px 6px",
                  fontSize: "12px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                  outline: "none",
                }}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
                <option value="PATCH">PATCH</option>
              </select>
            </div>

            <div style={{ marginBottom: "8px" }}>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "bold",
                  marginBottom: "2px",
                }}
              >
                Headers (JSON):
              </div>
              <textarea
                value={config.headers || ""}
                onChange={(e) => handleConfigChange("headers", e.target.value)}
                onFocus={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder={`{
  "Content-Type": "application/json"
}`}
                style={{
                  width: "100%",
                  minHeight: "60px",
                  padding: "4px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "12px",
                  resize: "vertical",
                  outline: "none",
                }}
              />
            </div>

            <div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "bold",
                  marginBottom: "2px",
                }}
              >
                Body (JSON):
              </div>
              <textarea
                value={config.body || ""}
                onChange={(e) => handleConfigChange("body", e.target.value)}
                onFocus={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder={`{
  "key": "value"
}`}
                style={{
                  width: "100%",
                  minHeight: "60px",
                  padding: "4px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "12px",
                  resize: "vertical",
                  outline: "none",
                }}
              />
            </div>
          </div>
        );

      case "postgresql":
        return (
          <div style={{ padding: "8px", borderTop: "1px solid #eee" }}>
            <div style={{ marginBottom: "8px" }}>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "bold",
                  marginBottom: "2px",
                }}
              >
                主机地址:
              </div>
              <input
                type="text"
                value={config.host || "localhost"}
                onChange={(e) => handleConfigChange("host", e.target.value)}
                onFocus={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="localhost"
                style={{
                  width: "100%",
                  padding: "4px 6px",
                  fontSize: "12px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: "8px" }}>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "bold",
                  marginBottom: "2px",
                }}
              >
                端口:
              </div>
              <input
                type="text"
                value={config.port || "5432"}
                onChange={(e) => handleConfigChange("port", e.target.value)}
                onFocus={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="5432"
                style={{
                  width: "100%",
                  padding: "4px 6px",
                  fontSize: "12px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: "8px" }}>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "bold",
                  marginBottom: "2px",
                }}
              >
                数据库名:
              </div>
              <input
                type="text"
                value={config.database || ""}
                onChange={(e) => handleConfigChange("database", e.target.value)}
                onFocus={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="数据库名称"
                style={{
                  width: "100%",
                  padding: "4px 6px",
                  fontSize: "12px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: "8px" }}>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "bold",
                  marginBottom: "2px",
                }}
              >
                用户名:
              </div>
              <input
                type="text"
                value={config.username || ""}
                onChange={(e) => handleConfigChange("username", e.target.value)}
                onFocus={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="用户名"
                style={{
                  width: "100%",
                  padding: "4px 6px",
                  fontSize: "12px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: "8px" }}>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "bold",
                  marginBottom: "2px",
                }}
              >
                密码:
              </div>
              <input
                type="password"
                value={config.password || ""}
                onChange={(e) => handleConfigChange("password", e.target.value)}
                onFocus={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="密码"
                style={{
                  width: "100%",
                  padding: "4px 6px",
                  fontSize: "12px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: "8px" }}>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "bold",
                  marginBottom: "2px",
                }}
              >
                SQL 查询:
              </div>
              <textarea
                value={config.query || ""}
                onChange={(e) => handleConfigChange("query", e.target.value)}
                onFocus={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="SELECT * FROM table_name LIMIT 10;"
                style={{
                  width: "100%",
                  padding: "4px 6px",
                  fontSize: "12px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                  boxSizing: "border-box",
                  outline: "none",
                  minHeight: "60px",
                  resize: "vertical",
                  fontFamily: "monospace",
                }}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const showLeftHandle = data.nodeType !== "input";
  const showRightHandle = data.nodeType !== "output";
  
  // 条件节点的特殊处理，添加 true 和 false 两个输出
  const renderHandles = () => {
    if (data.nodeType === "condition") {
      return (
        <>
          <Handle
            type="target"
            position={Position.Left}
            style={{
              background: "#555",
              width: "8px",
              height: "8px",
              border: "2px solid white",
            }}
          />
          {/* True 输出 */}
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            style={{
              top: "30%",
              background: "#28a745", // 绿色表示 true
              width: "8px",
              height: "8px",
              border: "2px solid white",
            }}
          />
          {/* False 输出 */}
          <Handle
            type="source"
            position={Position.Right}
            id="false"
            style={{
              top: "70%",
              background: "#dc3545", // 红色表示 false
              width: "8px",
              height: "8px",
              border: "2px solid white",
            }}
          />
        </>
      );
    }
    
    return (
      <>
        {showLeftHandle && (
          <Handle
            type="target"
            position={Position.Left}
            style={{
              background: "#555",
              width: "8px",
              height: "8px",
              border: "2px solid white",
            }}
          />
        )}
        {showRightHandle && (
          <Handle
            type="source"
            position={Position.Right}
            style={{
              background: "#555",
              width: "8px",
              height: "8px",
              border: "2px solid white",
            }}
          />
        )}
      </>
    );
  };

  return (
    <div style={{ position: "relative" }}>
      {renderHandles()}

      <div
        style={getNodeStyle(data.nodeType, data.status)}
        onDoubleClick={() => setIsEditing(!isEditing)}
        onMouseDown={(e) => {
          // 如果点击的是表单元素，阻止节点拖拽
          const target = e.target as HTMLElement;
          if (
            isEditing &&
            (target.tagName === "INPUT" ||
              target.tagName === "SELECT" ||
              target.tagName === "TEXTAREA" ||
              target.tagName === "BUTTON")
          ) {
            e.stopPropagation();
          }
        }}
      >
        <div style={{ padding: "12px", textAlign: "center" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              marginBottom: "4px",
            }}
          >
            <span style={{ fontSize: "18px" }}>
              {getNodeIcon(data.nodeType)}
            </span>
            {data.status && (
              <span style={{ fontSize: "14px" }}>
                {getStatusIcon(data.status)}
              </span>
            )}
          </div>
          {isEditingLabel ? (
            <div style={{ marginBottom: "2px" }}>
              <input
                type="text"
                value={editedLabel}
                onChange={(e) => setEditedLabel(e.target.value)}
                onBlur={() => {
                  if (onConfigChange && editedLabel.trim() !== "") {
                    // 更新节点标签
                    onConfigChange(id, { ...config, label: editedLabel });
                    setIsEditingLabel(false);
                  } else {
                    // 如果没有提供更新回调或标签为空，恢复原标签
                    setEditedLabel(data.label);
                    setIsEditingLabel(false);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.blur();
                  } else if (e.key === "Escape") {
                    setEditedLabel(data.label);
                    setIsEditingLabel(false);
                  }
                  e.stopPropagation();
                }}
                autoFocus
                style={{
                  width: "100%",
                  padding: "2px 4px",
                  fontSize: "14px",
                  fontWeight: "bold",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                  textAlign: "center",
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          ) : (
            <div
              style={{
                fontWeight: "bold",
                fontSize: "14px",
                marginBottom: "2px",
                cursor: "pointer",
              }}
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingLabel(true);
              }}
              title="点击编辑节点名称"
            >
              {data.label}
            </div>
          )}
          <div style={{ fontSize: "11px", color: "#666" }}>{data.nodeType}</div>
          {data.status && (
            <div style={{ fontSize: "10px", color: "#666", marginTop: "2px" }}>
              {data.status === "running" ? (
                "执行中..."
              ) : data.status === "completed" ? (
                "已完成"
              ) : data.status === "error" ? (
                <div>
                  <span>执行失败</span>
                  {data.error && (
                    <button
                      onClick={() => setShowErrorLog(!showErrorLog)}
                      style={{
                        marginLeft: "4px",
                        padding: "2px 6px",
                        background: "#dc3545",
                        color: "white",
                        border: "none",
                        borderRadius: "3px",
                        fontSize: "9px",
                        cursor: "pointer",
                      }}
                    >
                      查看日志
                    </button>
                  )}
                </div>
              ) : (
                ""
              )}
            </div>
          )}
          {Object.keys(config).length > 0 && !data.status && (
            <div style={{ fontSize: "10px", color: "#999", marginTop: "4px" }}>
              已配置
            </div>
          )}
        </div>

        {/* 错误日志显示 */}
        {showErrorLog && data.error && (
          <div
            style={{
              padding: "8px",
              borderTop: "1px solid #eee",
              background: "#fff5f5",
              borderRadius: "0 0 6px 6px",
              maxHeight: "150px",
              overflow: "auto",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: "bold",
                marginBottom: "4px",
                color: "#dc3545",
              }}
            >
              错误日志:
            </div>
            <div
              style={{
                fontSize: "11px",
                fontFamily: "Monaco, Consolas, monospace",
                color: "#721c24",
                background: "#f8d7da",
                padding: "4px",
                borderRadius: "3px",
                whiteSpace: "pre-wrap",
              }}
            >
              {data.error}
            </div>
            <button
              onClick={() => setShowErrorLog(false)}
              style={{
                marginTop: "4px",
                padding: "2px 6px",
                background: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "3px",
                fontSize: "10px",
                cursor: "pointer",
              }}
            >
              关闭
            </button>
          </div>
        )}

        {/* 实时输出显示 */}
        {data.output &&
          (data.status === "running" || data.status === "completed") && (
            <div
              style={{
                padding: "8px",
                borderTop: "1px solid #eee",
                background: "#f8fff8",
                borderRadius: "0 0 6px 6px",
                maxHeight: "200px",
                overflow: "auto",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "bold",
                  marginBottom: "4px",
                  color: "#28a745",
                }}
              >
                节点输出:
              </div>
              <div
                style={{
                  fontSize: "11px",
                  fontFamily: "Monaco, Consolas, monospace",
                  color: "#155724",
                  background: "#d4edda",
                  padding: "4px",
                  borderRadius: "3px",
                  whiteSpace: "pre-wrap",
                  lineHeight: "1.4",
                }}
              >
                {data.nodeType === "input" ? truncateText(data.output) : data.output}
              </div>
            </div>
          )}

        {renderConfigPanel()}

        {isEditing && (
          <div
            style={{
              padding: "8px",
              borderTop: "1px solid #eee",
              background: "#f8f9fa",
              borderRadius: "0 0 6px 6px",
            }}
          >
            <div
              style={{ 
                marginBottom: "8px", 
                fontSize: "10px", 
                color: "#666",
                wordBreak: "break-all",
                overflowWrap: "break-word"
              }}
            >
              当前配置: {data.nodeType === "input" && config.input ? 
                JSON.stringify({...config, input: truncateText(config.input)}) : 
                JSON.stringify(config)}
            </div>
            <button
              onClick={() => setIsEditing(false)}
              style={{
                width: "100%",
                padding: "4px",
                background: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "4px",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              完成配置
            </button>
          </div>
        )}
      </div>

      {/* 移除这里的Handle，因为已经在renderHandles函数中处理了 */}
    </div>
  );
};

export default CustomNode;
