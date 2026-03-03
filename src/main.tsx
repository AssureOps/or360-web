import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

import { OrgProvider } from "./OrgContext";
import { ToastProvider } from "./toast";
import Layout from "./Layout";
import ProjectLayout from "./ProjectLayout";

import App from "./App";
import Dashboard from "./Dashboard";
import ProjectPage from "./ProjectPage";
import OrgUsers from "./OrgUsers";
import Templates from "./Templates";
import AllocateCriteria from "./AllocateCriteria";
import Projects from "./Projects";
import NewProject from "./NewProject";
import Login from "./Login";
import Join from "./Join";
import Organisations from "./Organisations";

import RequireAuth from "./components/RequireAuth";

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// 🔔 Wire global certificate export handler once
import "./events/certificate";
import { registerDashboardExportListener } from "./events/export-dashboard";
registerDashboardExportListener();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <OrgProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/join" element={<Join />} />

            {/* Protected app */}
            <Route
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="/projects" replace />} />

              {/* Global pages */}
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/new" element={<NewProject />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/org-users" element={<OrgUsers />} />
			  <Route path="/organisations" element={<Organisations />} />

              {/* Project-scoped pages */}
              <Route path="/projects/:id" element={<ProjectLayout />}>
                <Route index element={<App />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="allocate" element={<AllocateCriteria />} />
                <Route path="settings" element={<ProjectPage />} />
                {/* NOTE: If you want Evidence tab routing, add:
                    <Route path="evidence" element={<EvidencePage />} />
                 */}
              </Route>

              <Route path="*" element={<Navigate to="/projects" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </OrgProvider>
  </React.StrictMode>
);
