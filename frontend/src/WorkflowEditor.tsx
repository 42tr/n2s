import React, { useState, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ReactFlow,
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import CustomNode from "./CustomNode";
import Sidebar from "./Sidebar";
import "./WorkflowEditor.css";

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

const WorkflowEditor: React.FC = () => {
  // 移除调试日志，避免干扰
  const navigate = useNavigate();
  const { id } = useParams(); // 获取路由参数中的工作流ID
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isExecuting, setIsExecuting] = useState(false);
  const [workflowName, setWorkflowName] = useState("");
  const [savedWorkflows, setSavedWorkflows] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const { screenToFlowPosition } = useReactFlow();

  // 包装的 onNodesChange 处理器，确保配置更新被正确处理
  const handleNodesChange = useCallback(
    (changes: any[]) => {
      onNodesChange(changes);
    },
    [onNodesChange],
  );

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type: "custom",
        position,
        data: {
          label: type,
          nodeType: type,
          config: {},
          status: "idle",
          // 添加强制更新机制
          forceUpdate: () => {
            setNodes((nds) =>
              nds.map((node) =>
                node.id === newNode.id
                  ? { ...node, data: { ...node.data, timestamp: Date.now() } }
                  : node,
              ),
            );
          },
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes],
  );

  const updateNodeStatus = (
    nodeId: string,
    status: "idle" | "running" | "completed" | "error",
    error?: string,
    output?: string,
  ) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                status,
                error,
                output: output || node.data.output,
              },
            }
          : node,
      ),
    );
  };

  const updateNodeConfig = useCallback(
    (nodeId: string, config: any) => {
      console.log("更新节点配置:", nodeId, config);
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  config: config,
                },
              }
            : node,
        ),
      );
    },
    [setNodes],
  );

  const appendNodeOutput = (nodeId: string, chunk: string) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: { ...node.data, output: (node.data.output || "") + chunk },
            }
          : node,
      ),
    );
  };

  // 定义节点类型，包含配置更新回调
  const nodeTypes = useMemo(
    () => ({
      custom: (props: any) => (
        <CustomNode {...props} onConfigChange={updateNodeConfig} />
      ),
    }),
    [updateNodeConfig],
  );

  const resetNodeStatuses = () => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: { ...node.data, status: "idle", output: "", error: undefined },
      })),
    );
  };

  const executeWorkflow = async () => {
    if (isExecuting) return;

    setIsExecuting(true);
    resetNodeStatuses();

    const workflowData = {
      id: id,
      name: workflowName,
      nodes: nodes.map((node) => ({
        id: node.id,
        type: node.data.nodeType,
        position: node.position,
        config: node.data.config,
      })),
      edges: edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
      })),
    };

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/workflow/run`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(workflowData),
        },
      );

      if (!response.ok) {
        throw new Error("执行工作流失败");
      }

      const reader = response.body?.getReader();
      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder("utf-8").decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              setIsExecuting(false);
              return;
            }

            try {
              const parsed = JSON.parse(data);
              console.log("SSE数据:", parsed);

              // 更新节点状态
              if (parsed.type === "node_start") {
                updateNodeStatus(parsed.nodeId, "running");
              } else if (parsed.type === "node_complete") {
                updateNodeStatus(parsed.nodeId, "completed");
              } else if (parsed.type === "node_error") {
                updateNodeStatus(parsed.nodeId, "error", parsed.error);
              } else if (parsed.type === "ai_response_chunk") {
                // 显示AI模型的流式输出
                console.log("AI输出片段:", parsed.data);
                appendNodeOutput(parsed.nodeId, parsed.data);
              } else if (parsed.type === "ai_response_complete") {
                // AI模型响应完成
                console.log("AI响应完成:", parsed.totalChunks, "个块");
              } else if (parsed.type === "input") {
                console.log("输入数据:", parsed.data);
                updateNodeStatus(
                  parsed.nodeId,
                  "running",
                  undefined,
                  parsed.data,
                );
              } else if (parsed.type === "output") {
                console.log("输出数据:", parsed.data);
                updateNodeStatus(
                  parsed.nodeId,
                  "running",
                  undefined,
                  parsed.data,
                );
              }
            } catch (e) {
              console.log("error", e);
              console.log("SSE文本:", data);
            }
          }
        }
      }
    } catch (error) {
      console.error("执行工作流出错:", error);
      setIsExecuting(false);
    }
  };

  const saveWorkflow = async () => {
    if (!workflowName.trim()) {
      alert("请输入工作流名称");
      return;
    }

    const workflowData = {
      id: id,
      name: workflowName,
      nodes: nodes.map((node) => ({
        id: node.id,
        type: node.data.nodeType,
        position: node.position,
        config: node.data.config,
      })),
      edges: edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
      })),
    };

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/workflow`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(workflowData),
        },
      );

      if (response.ok) {
        const result = await response.json();
        alert(`工作流已保存！API地址：/api/workflow/${result.id}/run`);
        loadSavedWorkflows();
        navigate(`/editor/${result.id}`);
      } else {
        throw new Error("保存失败");
      }
    } catch (error) {
      console.error("保存工作流出错:", error);
      alert("保存失败");
    }
  };

  const loadSavedWorkflows = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/workflows`,
      );
      if (response.ok) {
        const workflows = await response.json();
        setSavedWorkflows(workflows);
      }
    } catch (error) {
      console.error("加载工作流列表失败:", error);
    }
  };

  React.useEffect(() => {
    loadSavedWorkflows();

    // 检查是否从管理页面传来了要编辑的工作流
    const editWorkflowData = sessionStorage.getItem("editWorkflow");
    if (editWorkflowData && id) {
      try {
        const workflow = JSON.parse(editWorkflowData);
        // 加载工作流到编辑器
        loadWorkflowIntoEditor(workflow);
        // 清除sessionStorage中的数据
        sessionStorage.removeItem("editWorkflow");
      } catch (error) {
        console.error("加载编辑工作流失败:", error);
      }
    } else if (id) {
      // 如果有ID但没有sessionStorage数据，从服务器加载
      loadWorkflowById(id);
    }
  }, [id]);

  // 从服务器加载指定ID的工作流
  const loadWorkflowById = async (workflowId: string) => {
    try {
      const workflows = await fetch(
        `${import.meta.env.VITE_API_URL}/api/workflows`,
      );
      if (workflows.ok) {
        const data = await workflows.json();
        const workflow = data.find((w: any) => w.id === workflowId);
        if (workflow) {
          loadWorkflowIntoEditor(workflow);
        } else {
          alert("工作流不存在");
          navigate("/");
        }
      }
    } catch (error) {
      console.error("加载工作流失败:", error);
      alert("加载工作流失败");
      navigate("/");
    }
  };

  // 将工作流加载到编辑器中
  const loadWorkflowIntoEditor = (workflow: any) => {
    setWorkflowName(workflow.name);

    // 转换节点格式
    const loadedNodes = workflow.nodes.map((node: any) => ({
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

    // 转换边格式
    const loadedEdges = workflow.edges.map((edge: any) => ({
      id: `edge-${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
    }));

    setNodes(loadedNodes);
    setEdges(loadedEdges);
  };

  // 保存并返回管理页面
  const saveAndReturn = async () => {
    if (!workflowName.trim()) {
      alert("请输入工作流名称");
      return;
    }

    const workflowData = {
      id: id,
      name: workflowName,
      nodes: nodes.map((node) => ({
        id: node.id,
        type: node.data.nodeType,
        position: node.position,
        config: node.data.config,
      })),
      edges: edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
      })),
    };

    try {
      if (id) {
        // 更新现有工作流
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/workflow`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(workflowData),
          },
        );

        if (response.ok) {
          alert("工作流保存成功！");
          navigate("/");
        } else {
          throw new Error("保存失败");
        }
      } else {
        // 创建新工作流
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/workflow`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(workflowData),
          },
        );

        if (response.ok) {
          const result = await response.json();
          alert(`工作流已保存！API地址：${result.apiUrl}`);
          navigate("/");
        } else {
          throw new Error("保存失败");
        }
      }
    } catch (error) {
      console.error("保存工作流出错:", error);
      alert("保存失败");
    }
  };

  return (
    <div className="workflow-editor">
      <Sidebar />
      <div className="main-content">
        <div className="toolbar">
          <div className="toolbar-section">
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="工作流名称"
              className="workflow-name-input"
            />
            {id ? (
              <button onClick={saveAndReturn} className="save-btn">
                保存工作流
              </button>
            ) : (
              <button onClick={saveWorkflow} className="save-btn">
                保存为API
              </button>
            )}
          </div>
          <div className="toolbar-section">
            <button onClick={() => navigate("/")} className="back-btn">
              返回首页
            </button>
            <button
              onClick={executeWorkflow}
              className="execute-btn"
              disabled={isExecuting}
            >
              {isExecuting ? "执行中..." : "执行工作流"}
            </button>
            {!id && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="history-btn"
              >
                {showHistory ? "隐藏历史" : "查看历史"}
              </button>
            )}
          </div>
        </div>

        {showHistory && (
          <div className="history-panel">
            <h3>已保存的工作流</h3>
            <div className="workflow-list">
              {savedWorkflows.map((workflow) => (
                <div key={workflow.id} className="workflow-item">
                  <div className="workflow-info">
                    <strong>{workflow.name}</strong>
                    <div className="workflow-meta">
                      API: <code>/api/workflow/{workflow.id}/run</code>
                    </div>
                    <div className="workflow-meta">
                      创建时间: {new Date(workflow.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="workflow-actions">
                    <button
                      onClick={() =>
                        window.open(
                          `/api/workflow/${workflow.id}/history`,
                          "_blank",
                        )
                      }
                      className="view-history-btn"
                    >
                      查看调用历史
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
};

export default WorkflowEditor;
