import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

import { OrgProvider } from "./OrgContext";
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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <OrgProvider>
      <BrowserRouter>
        <Routes>
<Route element={<Layout />}>
  {/* ✅ when visiting "/" */}
  <Route index element={<Navigate to="/projects" replace />} />

  {/* Global pages */}
  <Route path="/projects" element={<Projects />} />
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
    </OrgProvider>
  </React.StrictMode>
);
