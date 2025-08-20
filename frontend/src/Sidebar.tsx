import React from 'react';

const Sidebar: React.FC = () => {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const nodeTypes = [
    { type: 'input', label: '输入节点', icon: '📥' },
    { type: 'ai-model', label: 'AI模型', icon: '🤖' },
    { type: 'condition', label: '条件判断', icon: '🔀' },
    { type: 'output', label: '输出节点', icon: '📤' },
  ];

  return (
    <div className="sidebar">
      <h3>组件库</h3>
      <div className="node-list">
        {nodeTypes.map((node) => (
          <div
            key={node.type}
            className="node-item"
            draggable
            onDragStart={(e) => onDragStart(e, node.type)}
          >
            <span className="node-icon">{node.icon}</span>
            <span className="node-label">{node.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;