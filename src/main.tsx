// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import "./index.css";

import { OrgProvider } from "./OrgContext";
import Layout from "./Layout";

import App from "./App";
import Dashboard from "./Dashboard";
import ProjectPage from "./ProjectPage";
import OrgUsers from "./OrgUsers";
import Templates from "./Templates";
import AllocateCriteria from "./AllocateCriteria";


function Root() {
  return (
     <OrgProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<App />} />
            <Route path="/dashboard" element={<Dashboard />} />
			<Route path="/allocate" element={<AllocateCriteria />} />
            <Route path="/projects/:id" element={<ProjectPage />} />
            <Route path="/org-users" element={<OrgUsers />} />
            <Route path="/templates" element={<Templates />} />
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