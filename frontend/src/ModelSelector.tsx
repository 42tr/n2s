import React, { useState } from "react";

interface ModelSelectorProps {
  apiKey: string;
  baseUrl: string;
  selectedModel: string;
  onModelChange: (model: string) => void;
  isCustomProvider?: boolean;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onModelChange,
  isCustomProvider = false,
}) => {
  const [models] = useState<string[]>([]);
  const [loading] = useState(false);
  const [error] = useState("");

  const handleModelSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onModelChange(e.target.value);
  };

  const handleManualInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    onModelChange(e.target.value);
  };

  return (
    <div style={{ marginBottom: "8px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "2px",
        }}
      >
        <span style={{ fontSize: "12px", fontWeight: "bold" }}>模型:</span>
      </div>

      {error && (
        <div
          style={{
            fontSize: "10px",
            color: "#dc3545",
            marginBottom: "4px",
            padding: "2px 4px",
            background: "#fff5f5",
            borderRadius: "3px",
          }}
        >
          {error}
        </div>
      )}

      {models.length > 0 ? (
        <select
          value={selectedModel}
          onChange={handleModelSelect}
          style={{
            width: "100%",
            padding: "2px",
            fontSize: "12px",
            background: loading ? "#f8f9fa" : "white",
          }}
          disabled={loading}
        >
          <option value="">选择模型...</option>
          {models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={selectedModel}
          onChange={handleManualInput}
          placeholder={
            loading
              ? "正在获取模型列表..."
              : isCustomProvider
                ? "输入自定义模型名称"
                : "手动输入模型名称"
          }
          style={{
            width: "100%",
            padding: "2px",
            fontSize: "12px",
            background: loading ? "#f8f9fa" : "white",
          }}
          disabled={loading}
        />
      )}

      {!loading && models.length > 0 && (
        <div
          style={{
            fontSize: "10px",
            color: "#6c757d",
            marginTop: "2px",
          }}
        >
          找到 {models.length} 个可用模型
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
