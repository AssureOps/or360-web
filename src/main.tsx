// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import "./index.css";

import { OrgProvider } from "./OrgContext";
import Layout from "./Layout";

import App from "./App";
import Dashboard from "./Dashboard";
import CreateProject from "./CreateProject";
import ProjectPage from "./ProjectPage";
import OrgUsers from "./OrgUsers";

function Root() {
  return (
    <OrgProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>

            {/* Primary */}
            <Route path="/" element={<App />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/new" element={<CreateProject />} />

            {/* Org */}
            <Route path="/org-users" element={<OrgUsers />} />

            {/* Projects */}
            <Route path="/projects/:id" element={<ProjectPage />} />

            {/* Placeholders so you can play with the left nav */}
            <Route path="/templates" element={<div>Templates (WIP)</div>} />
            <Route path="/admin" element={<div>Admin (WIP)</div>} />

          </Route>
        </Routes>
      </BrowserRouter>
    </OrgProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
