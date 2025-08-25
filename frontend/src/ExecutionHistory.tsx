import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import CustomNode from "./CustomNode";
import "./ExecutionHistory.css";

const nodeTypes = {
  custom: CustomNode,
};

interface Execution {
  id: string;
  timestamp: string;
  input: any;
  output?: any;
  status: "completed" | "failed";
  duration?: number;
  error?: string;
  logs?: any[];
}

const ExecutionHistory: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const workflow = location.state?.workflow;

  const [executions, setExecutions] = useState<Execution[]>([]);
  const [selectedExecution, setSelectedExecution] = useState<Execution | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [executionsPerPage] = useState(10);

  // 加载执行历史
  const loadExecutions = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/workflow/${id}/history`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      if (response.ok) {
        const data = await response.json();
        const executionsList = data || [];
        setExecutions(executionsList);

        // 默认选中第一个执行记录
        if (executionsList.length > 0 && !selectedExecution) {
          setSelectedExecution(executionsList[0]);
        }
      }
    } catch (error) {
      console.error("加载执行历史失败:", error);
    } finally {
      setLoading(false);
    }
  };

  // 更新节点状态显示执行结果
  const updateNodesWithExecutionData = (execution: Execution) => {
    if (!workflow || !execution.logs || !nodes.length) return;

    console.log("更新节点状态，执行日志:", execution.logs);
    console.log("当前节点:", nodes);

    // 创建节点状态映射
    const nodeStatusMap = new Map();

    // 解析执行日志获取每个节点的状态
    execution.logs.forEach((log: any) => {
      if (log.data) {
        const { nodeId, type, data: logData, output, error } = log.data;

        if (nodeId) {
          const currentStatus = nodeStatusMap.get(nodeId) || {
            status: "idle",
            output: "",
            error: "",
          };

          switch (type) {
            case "node_start":
              currentStatus.status = "running";
              break;
            case "node_complete":
              currentStatus.status = "completed";
              if (output) currentStatus.output = output;
              break;
            case "node_error":
              currentStatus.status = "error";
              if (error) currentStatus.error = error;
              break;
            case "ai_response_chunk":
              // 累积AI输出
              if (logData) {
                currentStatus.output = (currentStatus.output || "") + logData;
              }
              break;
            case "ai_response_complete":
              // AI响应完成，确保状态为完成
              if (currentStatus.status === "running") {
                currentStatus.status = "completed";
              }
              break;
            case "output":
              if (logData) {
                currentStatus.output =
                  typeof logData === "string"
                    ? logData
                    : JSON.stringify(logData, null, 2);
              }
              break;
          }

          nodeStatusMap.set(nodeId, currentStatus);
        }
      }
    });

    console.log("节点状态映射:", nodeStatusMap);

    // 更新节点数据
    const updatedNodes = nodes.map((node) => {
      const nodeStatus = nodeStatusMap.get(node.id);
      if (nodeStatus) {
        console.log(`更新节点 ${node.id}:`, nodeStatus);
        return {
          ...node,
          data: {
            ...node.data,
            status: nodeStatus.status,
            output: nodeStatus.output,
            error: nodeStatus.error,
          },
        };
      }

      // 如果没有找到状态信息，重置为idle
      return {
        ...node,
        data: {
          ...node.data,
          status: "idle",
          output: "",
          error: "",
        },
      };
    });

    console.log("更新后的节点:", updatedNodes);
    setNodes(updatedNodes);
  };

  // 加载工作流到可视化区域
  const loadWorkflowVisualization = () => {
    if (!workflow) return;

    const loadedNodes = (workflow.nodes || []).map((node: any) => ({
      id: node.id,
      type: "custom",
      position: node.position || {
        x: Math.random() * 500,
        y: Math.random() * 300,
      },
      data: {
        label: node.type,
        nodeType: node.type,
        config: node.config || {},
        status: "idle",
      },
    }));

    const loadedEdges = (workflow.edges || []).map((edge: any) => ({
      id: `edge-${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
    }));

    setNodes(loadedNodes);
    setEdges(loadedEdges);
  };

  // 当选择的执行记录变化时，更新节点状态
  useEffect(() => {
    if (selectedExecution && nodes.length > 0) {
      updateNodesWithExecutionData(selectedExecution);
    } else if (!selectedExecution && nodes.length > 0) {
      // 没有选择执行记录时，重置所有节点状态
      const resetNodes = nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          status: "idle",
          output: "",
          error: "",
        },
      }));
      setNodes(resetNodes);
    }
  }, [selectedExecution, nodes.length]);

  useEffect(() => {
    loadExecutions();
    loadWorkflowVisualization();
  }, [id, workflow]);

  const formatDate = (dateString: string) => {
    if (!dateString) return "未知时间";
    try {
      return new Date(dateString).toLocaleString("zh-CN");
    } catch (error) {
      return "时间格式错误" + error;
    }
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return "未知";
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(1)}s`;
  };

  // 分页逻辑
  const indexOfLastExecution = currentPage * executionsPerPage;
  const indexOfFirstExecution = indexOfLastExecution - executionsPerPage;
  const currentExecutions = executions.slice(
    indexOfFirstExecution,
    indexOfLastExecution,
  );
  const totalPages = Math.ceil(executions.length / executionsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  return (
    <div className="execution-history">
      <div className="header">
        <div className="header-left">
          <button onClick={() => navigate("/")} className="back-btn">
            ← 返回首页
          </button>
          <h1>{workflow?.name || "工作流"} - 执行历史</h1>
        </div>
        <div className="header-stats">
          <span className="stat">总执行次数: {executions.length}</span>
          <span className="stat success">
            成功: {executions.filter((e) => e.status === "completed").length}
          </span>
          <span className="stat error">
            失败: {executions.filter((e) => e.status === "failed").length}
          </span>
        </div>
      </div>

      <div className="content">
        <div className="executions-panel">
          <div className="panel-header">
            <h2>执行记录</h2>
            <button
              onClick={loadExecutions}
              disabled={loading}
              className="refresh-btn"
            >
              {loading ? "加载中..." : "刷新"}
            </button>
          </div>

          {loading ? (
            <div className="loading">加载中...</div>
          ) : executions.length === 0 ? (
            <div className="no-executions">暂无执行记录</div>
          ) : (
            <>
              <div className="executions-list">
                {currentExecutions.map((execution, index) => (
                  <div
                    key={execution.id || index}
                    className={`execution-item ${execution.status} ${
                      selectedExecution?.id === execution.id ? "selected" : ""
                    }`}
                    onClick={() => setSelectedExecution(execution)}
                  >
                    <div className="execution-summary">
                      <div className="execution-time">
                        {formatDate(execution.timestamp)}
                      </div>
                      <div className="execution-meta">
                        <span className={`status-badge ${execution.status}`}>
                          {execution.status === "completed" ? "成功" : "失败"}
                        </span>
                        <span className="duration">
                          {formatDuration(execution.duration)}
                        </span>
                      </div>
                    </div>
                    {execution.error && (
                      <div className="execution-error-preview">
                        错误: {execution.error.substring(0, 100)}...
                      </div>
                    )}
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
            </>
          )}
        </div>

        <div className="visualization-panel">
          <div className="panel-header">
            <h2>工作流可视化</h2>
            {selectedExecution && (
              <div className="execution-info">
                <span>执行时间: {formatDate(selectedExecution.timestamp)}</span>
                <span className={`status ${selectedExecution.status}`}>
                  {selectedExecution.status === "completed" ? "成功" : "失败"}
                </span>
              </div>
            )}
          </div>

          <div className="workflow-container">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              fitView
              attributionPosition="bottom-left"
              nodesDraggable={true}
              nodesConnectable={false}
              elementsSelectable={true}
              panOnDrag={true}
              zoomOnScroll={true}
              nodesFocusable={true}
              edgesFocusable={false}
            >
              <Background />
              <Controls />
              <MiniMap />
            </ReactFlow>
          </div>

          {selectedExecution && (
            <div className="execution-details">
              <h3>执行详情</h3>

              {selectedExecution.input && (
                <div className="detail-section">
                  <h4>输入参数</h4>
                  <pre className="json-display">
                    {JSON.stringify(selectedExecution.input, null, 2)}
                  </pre>
                </div>
              )}

              {selectedExecution.logs && selectedExecution.logs.length > 0 && (
                <div className="detail-section">
                  <h4>执行日志</h4>
                  <div className="logs-container">
                    {selectedExecution.logs.map((log, index) => (
                      <div key={index} className="log-entry">
                        <span className="log-time">
                          {formatDate(log.timestamp)}
                        </span>
                        <pre className="log-data">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedExecution.error && (
                <div className="detail-section">
                  <h4>错误信息</h4>
                  <pre className="error-display">{selectedExecution.error}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExecutionHistory;
