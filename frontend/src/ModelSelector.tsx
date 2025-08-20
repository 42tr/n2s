import React, { useState, useEffect } from 'react';

interface ModelSelectorProps {
  provider: string;
  apiKey: string;
  baseUrl: string;
  selectedModel: string;
  onModelChange: (model: string) => void;
  isCustomProvider?: boolean;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  provider,
  apiKey,
  baseUrl,
  selectedModel,
  onModelChange,
  isCustomProvider = false
}) => {
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchModels = async () => {
    if (!provider) return;
    
    // 自定义提供商且没有base URL时不获取模型列表
    if (isCustomProvider && !baseUrl) {
      setModels([]);
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams({
        provider,
        ...(apiKey && { apiKey }),
        ...(baseUrl && { baseUrl })
      });
      
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/models?${params}`);
      
      if (!response.ok) {
        throw new Error('获取模型列表失败');
      }
      
      const data = await response.json();
      setModels(data.models || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取模型失败');
      setModels([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, [provider, apiKey, baseUrl]);

  const handleModelSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onModelChange(e.target.value);
  };

  const handleManualInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    onModelChange(e.target.value);
  };

  const showRefreshButton = !isCustomProvider || (isCustomProvider && baseUrl);

  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '2px' 
      }}>
        <span style={{ fontSize: '12px', fontWeight: 'bold' }}>模型:</span>
        {showRefreshButton && (
          <button
            onClick={fetchModels}
            disabled={loading}
            style={{
              padding: '2px 6px',
              fontSize: '10px',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? '刷新中...' : '刷新'}
          </button>
        )}
      </div>
      
      {isCustomProvider && !baseUrl && (
        <div style={{
          fontSize: '10px',
          color: '#ffc107',
          marginBottom: '4px',
          padding: '2px 4px',
          background: '#fff8e1',
          borderRadius: '3px'
        }}>
          请先输入Base URL以获取模型列表
        </div>
      )}
      
      {error && (
        <div style={{
          fontSize: '10px',
          color: '#dc3545',
          marginBottom: '4px',
          padding: '2px 4px',
          background: '#fff5f5',
          borderRadius: '3px'
        }}>
          {error}
        </div>
      )}
      
      {models.length > 0 ? (
        <select
          value={selectedModel}
          onChange={handleModelSelect}
          style={{ 
            width: '100%', 
            padding: '2px', 
            fontSize: '12px',
            background: loading ? '#f8f9fa' : 'white'
          }}
          disabled={loading}
        >
          <option value="">选择模型...</option>
          {models.map(model => (
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
            loading ? '正在获取模型列表...' : 
            isCustomProvider ? '输入自定义模型名称' :
            '手动输入模型名称'
          }
          style={{ 
            width: '100%', 
            padding: '2px', 
            fontSize: '12px',
            background: loading ? '#f8f9fa' : 'white'
          }}
          disabled={loading}
        />
      )}
      
      {!loading && models.length > 0 && (
        <div style={{
          fontSize: '10px',
          color: '#6c757d',
          marginTop: '2px'
        }}>
          找到 {models.length} 个可用模型
        </div>
      )}
    </div>
  );
};

export default ModelSelector;