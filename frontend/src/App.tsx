import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import WorkflowEditor from './WorkflowEditor';
import WorkflowManagement from './WorkflowManagement';
import ExecutionHistory from './ExecutionHistory';
import './App.css';

function App() {
  return (
    <div className="App">
      <Router>
        <Routes>
          <Route 
            path="/" 
            element={<WorkflowManagement />} 
          />
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
      </Router>
    </div>
  );
}

export default App
