import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./WorkflowManagement.css";

interface Workflow {
  id: string;
  name: string;
  nodes: any[];
  edges: any[];
  createdAt: string;
  updatedAt?: string;
}

interface Execution {
  id: string;
  timestamp: string;
  input: any;
  output?: any;
  status: "completed" | "failed";
  duration?: number;
  error?: string;
}

const WorkflowManagement: React.FC = () => {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(
    null,
  );
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [showNodeDetails, setShowNodeDetails] = useState(false);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [workflowsPerPage] = useState(6); // 每页显示6个工作流

  // 加载所有工作流
  const loadWorkflows = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/workflows`,
      );
      if (response.ok) {
        const data = await response.json();
        setWorkflows(data);
      }
    } catch (error) {
      console.error("加载工作流失败:", error);
    }
  };

  // 加载指定工作流的执行历史
  const loadExecutions = async (workflowId: string) => {
    try {
      setLoading(true);
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/workflow/${workflowId}/history`,
      );
      if (response.ok) {
        const data = await response.json();
        setExecutions(data.executions || []);
      }
    } catch (error) {
      console.error("加载执行历史失败:", error);
    } finally {
      setLoading(false);
    }
  };

  // 删除工作流
  const deleteWorkflow = async (workflowId: string) => {
    if (!confirm("确定要删除这个工作流吗？此操作不可恢复。")) {
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/workflow/${workflowId}`,
        {
          method: "DELETE",
        },
      );

      if (response.ok) {
        await loadWorkflows();
        if (selectedWorkflow?.id === workflowId) {
          setSelectedWorkflow(null);
          setExecutions([]);
        }
      } else {
        alert("删除失败");
      }
    } catch (error) {
      console.error("删除工作流失败:", error);
      alert("删除失败");
    }
  };

  // 更新工作流名称
  const updateWorkflowName = async (workflowId: string, newName: string) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/workflow/${workflowId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: newName }),
        },
      );

      if (response.ok) {
        await loadWorkflows();
        setEditingWorkflow(null);
        setNewWorkflowName("");
      } else {
        alert("更新失败");
      }
    } catch (error) {
      console.error("更新工作流失败:", error);
      alert("更新失败");
    }
  };

  // 在编辑器中打开工作流
  const openInEditor = (workflow?: Workflow) => {
    if (workflow) {
      // 编辑现有工作流
      sessionStorage.setItem("editWorkflow", JSON.stringify(workflow));
      navigate("/editor/" + workflow.id);
    } else {
      // 新建工作流
      navigate("/editor");
    }
  };

  // 运行工作流
  const runWorkflow = async (workflowId: string, inputData: any = {}) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/workflow/${workflowId}/run`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(inputData),
        },
      );

      if (response.ok) {
        // 刷新执行历史
        await loadExecutions(workflowId);
        alert("工作流执行完成");
      } else {
        alert("执行失败");
      }
    } catch (error) {
      console.error("执行工作流失败:", error);
      alert("执行失败");
    }
  };

  useEffect(() => {
    loadWorkflows();
  }, []);

  useEffect(() => {
    if (selectedWorkflow) {
      loadExecutions(selectedWorkflow.id);
    }
  }, [selectedWorkflow]);

  const formatDate = (dateString: string) => {
    if (!dateString) return "未知时间";
    try {
      return new Date(dateString).toLocaleString("zh-CN");
    } catch (error) {
      return "时间格式错误";
    }
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return "未知";
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(1)}s`;
  };

  // 分页逻辑
  const indexOfLastWorkflow = currentPage * workflowsPerPage;
  const indexOfFirstWorkflow = indexOfLastWorkflow - workflowsPerPage;
  const currentWorkflows = (workflows || []).slice(
    indexOfFirstWorkflow,
    indexOfLastWorkflow,
  );
  const totalPages = Math.ceil((workflows || []).length / workflowsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  // 查看执行历史
  const viewExecutionHistory = (workflow: Workflow) => {
    navigate(`/history/${workflow.id}`, { state: { workflow } });
  };

  return (
    <div className="workflow-management">
      <div className="header">
        <h1>AI工作流编排平台</h1>
        <button onClick={() => openInEditor()} className="new-workflow-btn">
          + 新建工作流
        </button>
      </div>

      <div className="content">
        <div className="workflows-panel">
          <h2>所有工作流 ({(workflows || []).length})</h2>
          <div className="workflows-list">
            {currentWorkflows.map((workflow) => (
              <div
                key={workflow.id}
                className={`workflow-card ${selectedWorkflow?.id === workflow.id ? "selected" : ""}`}
                onClick={() => setSelectedWorkflow(workflow)}
              >
                <div className="workflow-header">
                  {editingWorkflow?.id === workflow.id ? (
                    <div className="edit-name">
                      <input
                        type="text"
                        value={newWorkflowName}
                        onChange={(e) => setNewWorkflowName(e.target.value)}
                        onBlur={() => {
                          if (newWorkflowName.trim()) {
                            updateWorkflowName(
                              workflow.id,
                              newWorkflowName.trim(),
                            );
                          } else {
                            setEditingWorkflow(null);
                            setNewWorkflowName("");
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            if (newWorkflowName.trim()) {
                              updateWorkflowName(
                                workflow.id,
                                newWorkflowName.trim(),
                              );
                            }
                          } else if (e.key === "Escape") {
                            setEditingWorkflow(null);
                            setNewWorkflowName("");
                          }
                        }}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <h3>{workflow.name}</h3>
                  )}

                  <div className="workflow-actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingWorkflow(workflow);
                        setNewWorkflowName(workflow.name);
                      }}
                      className="edit-btn"
                      title="重命名"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openInEditor(workflow);
                      }}
                      className="edit-workflow-btn"
                      title="在编辑器中编辑"
                    >
                      📝
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        runWorkflow(workflow.id);
                      }}
                      className="run-btn"
                      title="运行"
                    >
                      ▶️
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteWorkflow(workflow.id);
                      }}
                      className="delete-btn"
                      title="删除"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="workflow-info">
                  <div className="info-item">
                    <span className="label">节点数:</span>
                    <span className="value">{workflow.nodes?.length || 0}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">连接数:</span>
                    <span className="value">{workflow.edges?.length || 0}</span>
                  </div>
                  <div className="info-item full-width">
                    <span className="label">更新时间:</span>
                    <span className="value">
                      {formatDate(workflow.updatedAt ?? workflow.createdAt)}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="label">API地址:</span>
                    <span className="value api-url">
                      /api/workflow/{workflow.id}/run
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 分页控件 */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
                className="pagination-btn"
              >
                上一页
              </button>

              <div className="page-numbers">
                {Array.from(
                  { length: totalPages },
                  (_, index) => index + 1,
                ).map((pageNumber) => (
                  <button
                    key={pageNumber}
                    onClick={() => paginate(pageNumber)}
                    className={`page-number ${currentPage === pageNumber ? "active" : ""}`}
                  >
                    {pageNumber}
                  </button>
                ))}
              </div>

              <button
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="pagination-btn"
              >
                下一页
              </button>
            </div>
          )}
        </div>

        <div className="details-panel">
          {selectedWorkflow ? (
            <div className="details-content">
              <div className="workflow-details">
                <h2>{selectedWorkflow.name}</h2>
                <div className="details-grid">
                  <div className="detail-item">
                    <span className="label">工作流ID:</span>
                    <span className="value">{selectedWorkflow.id}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">节点配置:</span>
                    <div className="nodes-summary">
                      {(selectedWorkflow.nodes || []).map((node, index) => (
                        <div key={index} className="node-summary-card">
                          <div className="node-header">
                            <span className="node-type">
                              {node.type || "未知类型"}
                            </span>
                            <span className="node-config">
                              {Object.keys(node.config || {}).length > 0
                                ? "已配置"
                                : "未配置"}
                            </span>
                            <div className="node-actions">
                              <button
                                onClick={() => {
                                  setSelectedNode({ ...node, index });
                                  setShowNodeDetails(true);
                                }}
                                className="view-node-btn"
                                title="查看节点详情"
                              >
                                👁️
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="executions-section">
                <div className="section-header">
                  <h3>执行历史</h3>
                  <div className="section-actions">
                    <button
                      onClick={() => viewExecutionHistory(selectedWorkflow)}
                      className="view-history-btn"
                    >
                      查看详细历史
                    </button>
                    <button
                      onClick={() => loadExecutions(selectedWorkflow.id)}
                      className="refresh-btn"
                      disabled={loading}
                    >
                      {loading ? "刷新中..." : "刷新"}
                    </button>
                  </div>
                </div>

                {loading ? (
                  <div className="loading">加载中...</div>
                ) : !executions || executions.length === 0 ? (
                  <div className="no-executions">暂无执行记录</div>
                ) : (
                  <div className="executions-list">
                    {executions.map((execution, index) => (
                      <div
                        key={execution.id || index}
                        className={`execution-card ${execution.status}`}
                      >
                        <div className="execution-header">
                          <div className="execution-time">
                            {formatDate(
                              execution.timestamp || new Date().toISOString(),
                            )}
                          </div>
                          <div className="execution-status">
                            <span
                              className={`status-badge ${execution.status || "failed"}`}
                            >
                              {execution.status === "completed"
                                ? "成功"
                                : "失败"}
                            </span>
                            <span className="duration">
                              {formatDuration(execution.duration)}
                            </span>
                          </div>
                        </div>

                        {execution.input && (
                          <div className="execution-input">
                            <strong>输入:</strong>
                            <pre>
                              {JSON.stringify(execution.input, null, 2)}
                            </pre>
                          </div>
                        )}

                        {execution.error && (
                          <div className="execution-error">
                            <strong>错误:</strong>
                            <pre>{execution.error}</pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="no-selection">
              <h2>选择一个工作流</h2>
              <p>从左侧列表中选择一个工作流来查看详细信息和执行历史</p>
            </div>
          )}
        </div>
      </div>

      {/* 节点详情模态框 */}
      {showNodeDetails && selectedNode && (
        <div
          className="modal-overlay"
          onClick={() => setShowNodeDetails(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>节点详情 - {selectedNode.type || "未知类型"}</h3>
              <button
                onClick={() => setShowNodeDetails(false)}
                className="close-btn"
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="node-detail-section">
                <h4>基本信息</h4>
                <div className="detail-grid">
                  <div className="detail-row">
                    <span className="label">节点类型:</span>
                    <span className="value">
                      {selectedNode.type || "未知类型"}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="label">节点ID:</span>
                    <span className="value">{selectedNode.id || "无ID"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">配置状态:</span>
                    <span
                      className={`value ${Object.keys(selectedNode.config || {}).length > 0 ? "configured" : "unconfigured"}`}
                    >
                      {Object.keys(selectedNode.config || {}).length > 0
                        ? "已配置"
                        : "未配置"}
                    </span>
                  </div>
                </div>
              </div>

              {selectedNode.config &&
                Object.keys(selectedNode.config).length > 0 && (
                  <div className="node-detail-section">
                    <h4>配置详情</h4>
                    <div className="config-display">
                      {Object.entries(selectedNode.config).map(
                        ([key, value]) => (
                          <div key={key} className="config-item">
                            <span className="config-key">{key}:</span>
                            <span className="config-value">
                              {typeof value === "string" && value.length > 100
                                ? `${value.substring(0, 100)}...`
                                : String(value)}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

              {selectedNode.position && (
                <div className="node-detail-section">
                  <h4>位置信息</h4>
                  <div className="detail-grid">
                    <div className="detail-row">
                      <span className="label">X坐标:</span>
                      <span className="value">{selectedNode.position.x}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Y坐标:</span>
                      <span className="value">{selectedNode.position.y}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                onClick={() => {
                  setShowNodeDetails(false);
                  if (selectedWorkflow) {
                    openInEditor(selectedWorkflow);
                  }
                }}
                className="edit-btn"
              >
                在编辑器中编辑
              </button>
              <button
                onClick={() => setShowNodeDetails(false)}
                className="close-btn"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowManagement;
