import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <OrgProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
  {/* Global pages */}
  <Route path="/projects" element={<Projects />} />
  <Route path="/templates" element={<Templates />} />
  <Route path="/org-users" element={<OrgUsers />} />

  {/* Project-scoped pages */}
  <Route path="/projects/:id" element={<ProjectLayout />}>
    <Route index element={<App />} />                 {/* ✅ Checklist */}
    <Route path="dashboard" element={<Dashboard />} />
    <Route path="allocate" element={<AllocateCriteria />} />
    <Route path="settings" element={<ProjectPage />} />
  </Route>
</Route>

        </Routes>
      </BrowserRouter>
    </OrgProvider>
  </React.StrictMode>
);
