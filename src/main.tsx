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
import Projects from "./Projects"; // tile view
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import NewProject from "./NewProject";  // add this near the top

// 🔔 Wire global certificate export handler once
import "./events/certificate";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <OrgProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>

              {/* ✅ when visiting "/" */}
              <Route index element={<Navigate to="/projects" replace />} />

              {/* Global pages */}
              <Route path="/projects" element={<Projects />} />
			  <Route path="/projects/new" element={<NewProject />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/org-users" element={<OrgUsers />} />

              {/* Project-scoped pages */}
              <Route path="/projects/:id" element={<ProjectLayout />}>
                <Route index element={<App />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="allocate" element={<AllocateCriteria />} />
                <Route path="settings" element={<ProjectPage />} />

              </Route>

              {/* ✅ any other unknown path */}
              <Route path="*" element={<Navigate to="/projects" replace />} />

            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </OrgProvider>
  </React.StrictMode>
);
