import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import ModelSelector from './ModelSelector';

interface CustomNodeProps {
  data: {
    label: string;
    nodeType: string;
    config: any;
    status?: 'idle' | 'running' | 'completed' | 'error';
    logs?: string[];
    error?: string;
    output?: string;
  };
  id: string;
  selected?: boolean;
}

const CustomNode: React.FC<CustomNodeProps> = ({ data, id, selected }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showErrorLog, setShowErrorLog] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0);
  
  // 直接使用data.config，不创建额外的本地状态
  const config = data.config || {};

  const getNodeStyle = (nodeType: string, status?: string) => {
    let borderColor = '#ddd';
    let backgroundColor = 'white';
    
    // 根据节点类型设置颜色
    switch (nodeType) {
      case 'ai-model':
        borderColor = '#4CAF50';
        break;
      case 'input':
        borderColor = '#2196F3';
        break;
      case 'output':
        borderColor = '#FF9800';
        break;
      case 'condition':
        borderColor = '#9C27B0';
        break;
    }

    // 根据执行状态覆盖样式
    switch (status) {
      case 'running':
        borderColor = '#ffc107';
        backgroundColor = '#fff8e1';
        break;
      case 'completed':
        borderColor = '#28a745';
        backgroundColor = '#f8fff8';
        break;
      case 'error':
        borderColor = '#dc3545';
        backgroundColor = '#fff5f5';
        break;
    }

    if (selected) {
      borderColor = '#007bff';
    }

    return {
      border: `2px solid ${borderColor}`,
      borderRadius: '8px',
      minWidth: '180px',
      background: backgroundColor,
      color: '#333',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      position: 'relative' as const,
    };
  };

  const getNodeIcon = (nodeType: string) => {
    switch (nodeType) {
      case 'ai-model': return '🤖';
      case 'input': return '📥';
      case 'output': return '📤';
      case 'condition': return '🔀';
      default: return '⚙️';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'running': return '⏳';
      case 'completed': return '✅';
      case 'error': return '❌';
      default: return '';
    }
  };

  const handleConfigChange = (key: string, value: string) => {
    console.log('配置更新:', key, '=', value);
    
    // 直接修改data.config对象
    if (!data.config) {
      data.config = {};
    }
    data.config[key] = value;
    
    // 强制组件重新渲染
    setForceUpdate(prev => prev + 1);
  };

  const renderConfigPanel = () => {
    if (!isEditing) return null;

    switch (data.nodeType) {
      case 'input':
        return (
          <div style={{ padding: '8px', borderTop: '1px solid #eee' }}>
            <div style={{ marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>输入内容:</div>
            <textarea
              value={config.input || ''}
              onChange={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleConfigChange('input', e.target.value);
              }}
              onFocus={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="请输入内容..."
              style={{
                width: '100%',
                minHeight: '60px',
                padding: '4px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '12px',
                resize: 'vertical',
                outline: 'none'
              }}
            />
          </div>
        );
      
      case 'ai-model':
        return (
          <div style={{ padding: '8px', borderTop: '1px solid #eee' }}>
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '2px' }}>模型提供商:</div>
              <select
                value={config.provider || 'openai'}
                onChange={(e) => {
                  console.log('Provider changed to:', e.target.value);
                  handleConfigChange('provider', e.target.value);
                  // 清空模型选择，因为不同提供商的模型不同
                  handleConfigChange('model', '');
                }}
                onFocus={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                style={{ 
                  width: '100%', 
                  padding: '4px 6px', 
                  fontSize: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '3px',
                  outline: 'none'
                }}
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="ollama">Ollama</option>
                <option value="custom">自定义提供商</option>
              </select>
            </div>
            
            {config.provider === 'custom' && (
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '2px' }}>提供商名称:</div>
                <input
                  type="text"
                  value={config.customProviderName || ''}
                  onChange={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleConfigChange('customProviderName', e.target.value);
                  }}
                  onFocus={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  placeholder="例: gemini, deepseek, qwen"
                  style={{ 
                    width: '100%', 
                    padding: '4px 6px', 
                    fontSize: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '3px',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
              </div>
            )}
            
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '2px' }}>
                Base URL {config.provider === 'custom' ? '' : '(可选)'}:
              </div>
              <input
                type="text"
                value={config.baseUrl || ''}
                onChange={(e) => {
                  console.log('BaseURL changed to:', e.target.value); // 调试日志
                  e.preventDefault();
                  e.stopPropagation();
                  handleConfigChange('baseUrl', e.target.value);
                  // 清空模型选择，因为base URL变化可能影响可用模型
                  handleConfigChange('model', '');
                }}
                onFocus={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder={
                  config.provider === 'custom' 
                    ? "https://api.example.com" 
                    : "https://api.openai.com"
                }
                style={{ 
                  width: '100%', 
                  padding: '4px 6px', 
                  fontSize: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '3px',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>
            
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '2px' }}>API Key:</div>
              <input
                type="text"
                value={config.apiKey || ''}
                onChange={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleConfigChange('apiKey', e.target.value);
                }}
                onFocus={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="API密钥"
                style={{ 
                  width: '100%', 
                  padding: '4px 6px', 
                  fontSize: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '3px',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>
            
            {config.provider === 'custom' && (
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '2px' }}>请求格式:</div>
                <select
                  value={config.requestFormat || 'openai'}
                  onChange={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleConfigChange('requestFormat', e.target.value);
                  }}
                  onFocus={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{ 
                    width: '100%', 
                    padding: '4px 6px', 
                    fontSize: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '3px',
                    outline: 'none'
                  }}
                >
                  <option value="openai">OpenAI格式</option>
                  <option value="anthropic">Anthropic格式</option>
                  <option value="ollama">Ollama格式</option>
                </select>
                <div style={{ fontSize: '10px', color: '#6c757d', marginTop: '2px' }}>
                  选择与您的API兼容的请求格式
                </div>
              </div>
            )}
            
            <ModelSelector
              provider={config.provider === 'custom' ? (config.requestFormat || 'openai') : config.provider || 'openai'}
              apiKey={config.apiKey || ''}
              baseUrl={config.baseUrl || ''}
              selectedModel={config.model || ''}
              onModelChange={(model) => handleConfigChange('model', model)}
              isCustomProvider={config.provider === 'custom'}
            />
            <div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '2px' }}>提示词:</div>
              <textarea
                value={config.prompt || ''}
                onChange={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleConfigChange('prompt', e.target.value);
                }}
                onFocus={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="请输入提示词..."
                style={{
                  width: '100%',
                  minHeight: '60px',
                  padding: '4px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '12px',
                  resize: 'vertical'
                }}
              />
            </div>
          </div>
        );
      
      case 'condition':
        return (
          <div style={{ padding: '8px', borderTop: '1px solid #eee' }}>
            <div style={{ marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>条件表达式:</div>
            <input
              type="text"
              value={config.condition || 'true'}
              onChange={(e) => handleConfigChange('condition', e.target.value)}
              placeholder="例: input.length > 10"
              style={{ width: '100%', padding: '4px', fontSize: '12px' }}
            />
          </div>
        );
      
      case 'output':
        return (
          <div style={{ padding: '8px', borderTop: '1px solid #eee' }}>
            <div style={{ marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>输出格式:</div>
            <input
              type="text"
              value={config.output || '输出完成'}
              onChange={(e) => handleConfigChange('output', e.target.value)}
              placeholder="输出格式"
              style={{ width: '100%', padding: '4px', fontSize: '12px' }}
            />
          </div>
        );
      
      default:
        return null;
    }
  };

  const showLeftHandle = data.nodeType !== 'input';
  const showRightHandle = data.nodeType !== 'output';

  return (
    <div style={{ position: 'relative' }}>
      {showLeftHandle && (
        <Handle 
          type="target" 
          position={Position.Left}
          style={{
            background: '#555',
            width: '8px',
            height: '8px',
            border: '2px solid white',
          }}
        />
      )}
      
      <div
        style={getNodeStyle(data.nodeType, data.status)}
        onDoubleClick={() => setIsEditing(!isEditing)}
        onMouseDown={(e) => {
          // 如果点击的是表单元素，阻止节点拖拽
          const target = e.target as HTMLElement;
          if (isEditing && (
            target.tagName === 'INPUT' || 
            target.tagName === 'SELECT' || 
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'BUTTON'
          )) {
            e.stopPropagation();
          }
        }}
      >
        <div style={{ padding: '12px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>
            <span style={{ fontSize: '18px' }}>{getNodeIcon(data.nodeType)}</span>
            {data.status && <span style={{ fontSize: '14px' }}>{getStatusIcon(data.status)}</span>}
          </div>
          <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '2px' }}>
            {data.label}
          </div>
          <div style={{ fontSize: '11px', color: '#666' }}>
            {data.nodeType}
          </div>
          {data.status && (
            <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
              {data.status === 'running' ? '执行中...' : 
               data.status === 'completed' ? '已完成' :
               data.status === 'error' ? (
                 <div>
                   <span>执行失败</span>
                   {data.error && (
                     <button
                       onClick={() => setShowErrorLog(!showErrorLog)}
                       style={{
                         marginLeft: '4px',
                         padding: '2px 6px',
                         background: '#dc3545',
                         color: 'white',
                         border: 'none',
                         borderRadius: '3px',
                         fontSize: '9px',
                         cursor: 'pointer'
                       }}
                     >
                       查看日志
                     </button>
                   )}
                 </div>
               ) : ''}
            </div>
          )}
          {Object.keys(config).length > 0 && !data.status && (
            <div style={{ fontSize: '10px', color: '#999', marginTop: '4px' }}>
              已配置
            </div>
          )}
        </div>
        
        {/* 错误日志显示 */}
        {showErrorLog && data.error && (
          <div style={{
            padding: '8px',
            borderTop: '1px solid #eee',
            background: '#fff5f5',
            borderRadius: '0 0 6px 6px',
            maxHeight: '150px',
            overflow: 'auto'
          }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#dc3545' }}>
              错误日志:
            </div>
            <div style={{
              fontSize: '11px',
              fontFamily: 'Monaco, Consolas, monospace',
              color: '#721c24',
              background: '#f8d7da',
              padding: '4px',
              borderRadius: '3px',
              whiteSpace: 'pre-wrap'
            }}>
              {data.error}
            </div>
            <button
              onClick={() => setShowErrorLog(false)}
              style={{
                marginTop: '4px',
                padding: '2px 6px',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                fontSize: '10px',
                cursor: 'pointer'
              }}
            >
              关闭
            </button>
          </div>
        )}
        
        {/* 实时输出显示 */}
        {data.output && (data.status === 'running' || data.status === 'completed') && (
          <div style={{
            padding: '8px',
            borderTop: '1px solid #eee',
            background: '#f8fff8',
            borderRadius: '0 0 6px 6px',
            maxHeight: '200px',
            overflow: 'auto'
          }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#28a745' }}>
              节点输出:
            </div>
            <div style={{
              fontSize: '11px',
              fontFamily: 'Monaco, Consolas, monospace',
              color: '#155724',
              background: '#d4edda',
              padding: '4px',
              borderRadius: '3px',
              whiteSpace: 'pre-wrap',
              lineHeight: '1.4'
            }}>
              {data.output}
            </div>
          </div>
        )}
        
        {renderConfigPanel()}
        
        {isEditing && (
          <div style={{ 
            padding: '8px', 
            borderTop: '1px solid #eee',
            background: '#f8f9fa',
            borderRadius: '0 0 6px 6px'
          }}>
            <div style={{ marginBottom: '8px', fontSize: '10px', color: '#666' }}>
              当前配置: {JSON.stringify(config)}
            </div>
            <button
              onClick={() => setIsEditing(false)}
              style={{
                width: '100%',
                padding: '4px',
                background: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              完成配置
            </button>
          </div>
        )}
      </div>

      {showRightHandle && (
        <Handle 
          type="source" 
          position={Position.Right}
          style={{
            background: '#555',
            width: '8px',
            height: '8px',
            border: '2px solid white',
          }}
        />
      )}
    </div>
  );
};

export default CustomNode;