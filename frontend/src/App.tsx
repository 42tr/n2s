import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ReactFlowProvider } from "@xyflow/react";
import { AuthProvider } from "./AuthContext";
import PrivateRoute from "./PrivateRoute";
import WorkflowEditor from "./WorkflowEditor";
import WorkflowManagement from "./WorkflowManagement";
import ExecutionHistory from "./ExecutionHistory";
import "./App.css";

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <Router>
          <PrivateRoute>
            <Routes>
              <Route path="/" element={<WorkflowManagement />} />
              <Route
                path="/editor"
                element={
                  <ReactFlowProvider>
                    <WorkflowEditor />
                  </ReactFlowProvider>
                }
              />
              <Route
                path="/editor/:id"
                element={
                  <ReactFlowProvider>
                    <WorkflowEditor />
                  </ReactFlowProvider>
                }
              />
              <Route
                path="/history/:id"
                element={
                  <ReactFlowProvider>
                    <ExecutionHistory />
                  </ReactFlowProvider>
                }
              />
            </Routes>
          </PrivateRoute>
        </Router>
      </div>
    </AuthProvider>
  );
}

export default App;
