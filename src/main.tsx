import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import Dashboard from "./Dashboard";
import CreateProject from "./CreateProject";
import "./index.css";
import Layout from "./Layout";           // NEW
import { OrgProvider } from "./OrgContext"; // already added earlier


function Root() {
  return (
    <OrgProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<App />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/new" element={<CreateProject />} />
            {/* placeholders so you can play with the left nav */}
            <Route path="/projects" element={<div>Projects (WIP)</div>} />
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
